"""
sara_pdf_ingest_v3.py — RAG 2ª Generación
==========================================
Mejoras sobre v2:
  1. Chunking semántico (RecursiveCharacterTextSplitter propio, sin dependencias extra)
  2. Embeddings en paralelo con asyncio.gather + asyncio.to_thread
  3. Imágenes → Supabase Storage bucket 'rag-images' (sin base64 en metadata)
  4. Errores de embedding loggeados correctamente (no silenciados)
  5. Deduplicación por source_url: elimina vectores previos antes de reingestar
  6. Batch inserts (compatible con v2)

Uso:
    python sara_pdf_ingest_v3.py --pdf "/path/to/file.pdf" --source "Google Drive" \\
        --url "https://..." [--webhook "https://..."] [--user "email@"] [--keep] [--no-dedup]
"""

import os
import uuid
import time
import asyncio
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv
import fitz  # PyMuPDF
from supabase import create_client
from google import genai
from google.genai import types

# ── Configuración ────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

EMBEDDING_MODEL = "gemini-embedding-2-preview"
GENERATION_MODEL = "gemini-2.5-flash"   # Para contextual headers
EMBEDDING_DIMS = 3072
BATCH_INSERT_SIZE = 100
EMBED_BATCH_SIZE = 20       # requests concurrentes a Gemini
STORAGE_BUCKET = "rag-images"
MAX_CONCURRENCY = 20        # Límite global de operaciones de red simultáneas
sem = asyncio.Semaphore(MAX_CONCURRENCY)

# Parámetros de chunking semántico
CHUNK_SIZE = 1200           # chars (~300 tokens para el modelo de embedding)
CHUNK_OVERLAP = 200         # overlap entre chunks adyacentes
SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", ", ", " ", ""]


# ════════════════════════════════════════════════════════════════════
# 1. CHUNKING SEMÁNTICO
# ════════════════════════════════════════════════════════════════════

def recursive_split(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    separators: list = None,
) -> list[str]:
    """
    Divide texto recursivamente respetando separadores semánticos en orden de prioridad:
    párrafos > líneas > oraciones > palabras > caracteres.
    Implementación de RecursiveCharacterTextSplitter sin dependencia de langchain.
    """
    if separators is None:
        separators = SEPARATORS

    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    # Encontrar el separador más semántico disponible en el texto
    chosen_sep = ""
    remaining_seps = []
    for i, sep in enumerate(separators):
        if sep == "":          # último recurso: carácter a carácter
            chosen_sep = ""
            remaining_seps = []
            break
        if sep in text:
            chosen_sep = sep
            remaining_seps = separators[i + 1:]
            break

    # Si no hay separador (fallback a caracteres), dividir directamente
    if chosen_sep == "" and not remaining_seps:
        result = []
        for i in range(0, len(text), chunk_size - chunk_overlap):
            result.append(text[i : i + chunk_size].strip())
        return [c for c in result if c]

    raw_splits = [s for s in text.split(chosen_sep) if s.strip()]

    # Fusionar splits en chunks respetando chunk_size con overlap
    chunks = []
    current_parts: list[str] = []
    current_len = 0

    for split in raw_splits:
        split = split.strip()
        if not split:
            continue

        sep_len = len(chosen_sep) if current_parts else 0
        split_len = len(split)

        if current_len + sep_len + split_len > chunk_size and current_parts:
            # Persistir chunk actual
            chunk_text = chosen_sep.join(current_parts).strip()
            if chunk_text:
                chunks.append(chunk_text)

            # Calcular overlap desde el final del chunk actual
            overlap_parts: list[str] = []
            overlap_len = 0
            for part in reversed(current_parts):
                part_sep_len = len(chosen_sep) if overlap_parts else 0
                if overlap_len + part_sep_len + len(part) > chunk_overlap:
                    break
                overlap_parts.insert(0, part)
                overlap_len += part_sep_len + len(part)

            current_parts = overlap_parts
            current_len = overlap_len

        current_parts.append(split)
        current_len += (len(chosen_sep) if len(current_parts) > 1 else 0) + split_len

    # Persistir último chunk
    if current_parts:
        chunk_text = chosen_sep.join(current_parts).strip()
        if chunk_text:
            chunks.append(chunk_text)

    # Recursión: dividir chunks que aún superen chunk_size con los separadores restantes
    if remaining_seps:
        final: list[str] = []
        for chunk in chunks:
            if len(chunk) > chunk_size:
                final.extend(
                    recursive_split(chunk, chunk_size, chunk_overlap, remaining_seps)
                )
            else:
                final.append(chunk)
        return final

    return chunks


# ════════════════════════════════════════════════════════════════════
# 2. INICIALIZACIÓN
# ════════════════════════════════════════════════════════════════════

def init_clients():
    if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY]):
        raise RuntimeError(
            "❌ Faltan variables de entorno (SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY)"
        )
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    gemini = genai.Client(api_key=GEMINI_API_KEY)
    return sb, gemini


# ════════════════════════════════════════════════════════════════════
# 3. WEBHOOK
# ════════════════════════════════════════════════════════════════════

def send_webhook(webhook_url: str, message: str, level: str = "info"):
    if not webhook_url:
        return
    try:
        requests.post(
            webhook_url,
            json={"message": message, "level": level, "timestamp": time.time()},
            timeout=5,
        )
    except Exception as e:
        print(f"⚠️ Webhook error: {e}", flush=True)


# ════════════════════════════════════════════════════════════════════
# 4. EMBEDDINGS PARALELOS
# ════════════════════════════════════════════════════════════════════

def _embed_sync(gemini_client, contents, is_image: bool = False, max_retries: int = 10):
    """Llamada síncrona al SDK de Gemini, diseñada para ejecutarse en un thread pool."""
    for attempt in range(max_retries):
        try:
            payload = (
                types.Part.from_bytes(data=contents, mime_type="image/jpeg")
                if is_image
                else contents
            )
            res = gemini_client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=payload,
                config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMS),
            )
            return res.embeddings[0].values
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (2 ** attempt) + 5
                time.sleep(wait)
            else:
                raise


async def embed_async(gemini_client, contents, is_image: bool = False) -> list[float]:
    """Envuelve la llamada síncrona en asyncio.to_thread para no bloquear el event loop, respetando el semáforo."""
    async with sem:
        return await asyncio.to_thread(_embed_sync, gemini_client, contents, is_image)


async def embed_batch_async(
    gemini_client,
    items: list[dict],   # cada item: {"contents": ..., "is_image": bool, "meta": any}
    webhook_url: str = None,
    label: str = "items",
) -> list[tuple]:
    """
    Genera embeddings en paralelo en lotes de EMBED_BATCH_SIZE.
    Retorna lista de (meta, embedding | Exception).
    """
    results = []
    total = len(items)

    for i in range(0, total, EMBED_BATCH_SIZE):
        batch = items[i : i + EMBED_BATCH_SIZE]
        tasks = [
            embed_async(gemini_client, item["contents"], item.get("is_image", False))
            for item in batch
        ]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        results.extend(zip([item["meta"] for item in batch], batch_results))

        done = min(i + EMBED_BATCH_SIZE, total)
        if done < total:
            send_webhook(webhook_url, f"⏳ Embeddings {label}: {done}/{total}")

    return results


# ════════════════════════════════════════════════════════════════════
# 5. SUPABASE STORAGE
# ════════════════════════════════════════════════════════════════════

async def upload_image_to_storage_async(
    sb_client,
    image_bytes: bytes,
    ext: str,
    source_slug: str,
) -> str | None:
    """Sube imagen al bucket rag-images y retorna la URL pública (con semáforo y reintentos)."""
    # Extensiones soportadas directamente; jpeg es el fallback
    mime_map = {"png": "image/png", "gif": "image/gif", "webp": "image/webp"}
    ext_lower = ext.lower()
    content_type = mime_map.get(ext_lower, "image/jpeg")

    path = f"{source_slug}/{uuid.uuid4().hex}.{ext_lower}"

    async with sem:
        for attempt in range(3):
            try:
                sb_client.storage.from_(STORAGE_BUCKET).upload(
                    path=path,
                    file=image_bytes,
                    file_options={"content-type": content_type, "upsert": "true"},
                )
                return sb_client.storage.from_(STORAGE_BUCKET).get_public_url(path)
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                print(f"⚠️ Error subiendo imagen a Storage ({path}): {e}", flush=True)
                return None


# ════════════════════════════════════════════════════════════════════
# 6. DEDUPLICACIÓN
# ════════════════════════════════════════════════════════════════════

async def generate_contextual_header(
    gemini_client,
    manual_name: str,
    article_title: str,
    first_chunk: str,
) -> str:
    """
    Genera un contextual header de ≤100 palabras usando Gemini Flash (temp=0.1).
    Si falla, retorna una cadena vacía para no bloquear la ingesta.
    """
    prompt = (
        f"Dado el manual '{manual_name or 'desconocido'}' y artículo '{article_title or 'desconocido'}', "
        f"con este contenido inicial:\n\n{first_chunk[:800]}\n\n"
        "Genera un contextual header de máximo 100 palabras en español describiendo "
        "de qué trata este artículo y en qué contexto se usa. "
        "Solo devuelve el header, sin formato ni comillas."
    )
    try:
        async with sem:
            response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model=GENERATION_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=500),
            )
            return (response.text or "").strip()
    except Exception as e:
        print(f"⚠️ Error generando contextual header: {e}", flush=True)
        return ""


def delete_existing_vectors(sb_client, source_url: str, webhook_url: str = None):
    """Elimina vectores previos con el mismo source_url para reingestión idempotente."""
    try:
        result = (
            sb_client.table("zoho_learn_vectors")
            .delete()
            .eq("metadata->>source_url", source_url)
            .execute()
        )
        count = len(result.data) if result.data else 0
        if count > 0:
            msg = f"🗑️  Eliminados {count} vectores previos de: {source_url}"
            print(msg, flush=True)
            send_webhook(webhook_url, msg)
    except Exception as e:
        print(f"⚠️ Error en deduplicación (no fatal): {e}", flush=True)


# ════════════════════════════════════════════════════════════════════
# 7. EXTRACCIÓN + EMBEDDING PARALELO (función principal)
# ════════════════════════════════════════════════════════════════════

async def extract_chunks_async(
    pdf_path: str,
    gemini_client,
    sb_client,
    source_name: str,
    source_url: str,
    webhook_url: str = None,
    created_by: str = None,
    manual_name: str = None,
    article_title: str = None,
    collection_id: str = None,
) -> list[dict]:
    """
    Lee el PDF, aplica chunking semántico al texto, sube imágenes a Storage,
    genera todos los embeddings en paralelo y retorna la lista de chunks
    lista para insertar en Supabase.
    """
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    source_slug = Path(pdf_path).stem[:30].replace(" ", "_").lower()

    msg = f"📖 Procesando {total_pages} páginas de '{Path(pdf_path).name}'..."
    print(msg, flush=True)
    send_webhook(webhook_url, msg)

    # ── FASE 1: Escanear PDF y recolectar texto e imágenes ────────
    text_items: list[dict] = []    # {"page": int, "chunk_index": int, "text": str}
    image_items: list[dict] = []   # {"page": int, "img_idx": int, "bytes": bytes, "ext": str}

    for page_idx in range(total_pages):
        if page_idx % 5 == 0 and page_idx > 0:
            send_webhook(webhook_url, f"⏳ Escaneando página {page_idx + 1}/{total_pages}...")

        page = doc[page_idx]
        raw_text = page.get_text().strip().replace("\x00", "")

        # Texto → chunking semántico
        if raw_text:
            chunks = recursive_split(raw_text)
            for chunk_idx, chunk in enumerate(chunks):
                text_items.append(
                    {"page": page_idx + 1, "chunk_index": chunk_idx, "text": chunk}
                )

        # Imágenes
        for img_idx, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_items.append(
                {
                    "page": page_idx + 1,
                    "img_idx": img_idx + 1,
                    "bytes": base_image["image"],
                    "ext": base_image["ext"],
                }
            )

    doc.close()

    total_text = len(text_items)
    total_imgs = len(image_items)
    msg = (
        f"📊 Encontrados {total_text} chunks de texto y {total_imgs} imágenes. "
        f"Generando embeddings en paralelo..."
    )
    print(msg, flush=True)
    send_webhook(webhook_url, msg)

    # ── FASE 1.5: Generar contextual header (una llamada LLM por documento) ──
    contextual_header = ""
    if text_items:
        first_text = text_items[0]["text"]
        contextual_header = await generate_contextual_header(
            gemini_client, manual_name, article_title, first_text
        )
        if contextual_header:
            print(f"📝 Contextual header generado para '{article_title or source_url}'", flush=True)

    # ── FASE 2: Embeddings de texto en paralelo ───────────────────
    text_embed_items = [
        {"contents": item["text"], "is_image": False, "meta": item}
        for item in text_items
    ]
    text_results = await embed_batch_async(
        gemini_client, text_embed_items, webhook_url, label="texto"
    )

    chunks: list[dict] = []

    for meta, result in text_results:
        if isinstance(result, Exception):
            print(
                f"⚠️ Error embedding texto (pág {meta['page']}, chunk {meta['chunk_index']}): {result}",
                flush=True,
            )
            send_webhook(
                webhook_url,
                f"⚠️ Error embedding texto pág {meta['page']}: {result}",
                "warning",
            )
            continue

        chunks.append(
            {
                "id": str(uuid.uuid4()),
                "content": meta["text"],
                "type": "text",
                "embedding": result,
                "created_by": created_by,
                "metadata": {
                    "source": source_name,
                    "source_url": source_url,
                    "page_number": meta["page"],
                    "chunk_index": meta["chunk_index"],
                    "original_content": meta["text"],
                    # V4 enriched metadata
                    "manual_name": manual_name,
                    "article_title": article_title,
                    "collection_id": collection_id,
                    "contextual_header": contextual_header or None,
                },
            }
        )

    # ── FASE 3: Imágenes — upload a Storage + embedding en paralelo ─
    if image_items:
        # Subir imágenes a Storage y generar embeddings concurrentemente
        upload_tasks = [
            upload_image_to_storage_async(
                sb_client,
                item["bytes"],
                item["ext"],
                source_slug,
            )
            for item in image_items
        ]
        embed_tasks = [
            embed_async(gemini_client, item["bytes"], is_image=True)
            for item in image_items
        ]

        all_results = await asyncio.gather(
            *upload_tasks, *embed_tasks, return_exceptions=True
        )
        upload_results = all_results[: len(image_items)]
        embed_results = all_results[len(image_items) :]

        for item, url_result, embed_result in zip(
            image_items, upload_results, embed_results
        ):
            img_filename = f"image_p{item['page']}_{item['img_idx']}.{item['ext']}"

            if isinstance(embed_result, Exception):
                print(
                    f"⚠️ Error embedding imagen {img_filename}: {embed_result}",
                    flush=True,
                )
                send_webhook(
                    webhook_url,
                    f"⚠️ Error embedding imagen {img_filename}: {embed_result}",
                    "warning",
                )
                continue

            image_url = (
                url_result if not isinstance(url_result, Exception) else None
            )
            if isinstance(url_result, Exception):
                print(
                    f"⚠️ Error Storage imagen {img_filename}: {url_result}", flush=True
                )

            chunks.append(
                {
                    "id": str(uuid.uuid4()),
                    "content": f"[Imagen: {img_filename}]",
                    "type": "image",
                    "embedding": embed_result,
                    "created_by": created_by,
                    "metadata": {
                        "source": source_name,
                        "source_url": source_url,
                        "page_number": item["page"],
                        "image_filename": img_filename,
                        "image_url": image_url,  # URL pública en Storage (no base64)
                    },
                }
            )

    return chunks


# ════════════════════════════════════════════════════════════════════
# 8. INSERT A SUPABASE
# ════════════════════════════════════════════════════════════════════

def insert_to_supabase(sb_client, chunks: list[dict], webhook_url: str = None):
    total = len(chunks)
    if total == 0:
        send_webhook(webhook_url, "⚠️ No hay chunks para insertar.", "warning")
        return

    send_webhook(webhook_url, f"💾 Insertando {total} vectores en Supabase...")
    for i in range(0, total, BATCH_INSERT_SIZE):
        batch = chunks[i : i + BATCH_INSERT_SIZE]
        sb_client.table("zoho_learn_vectors").insert(batch).execute()

    send_webhook(webhook_url, f"✅ {total} vectores insertados exitosamente.", "success")


# ════════════════════════════════════════════════════════════════════
# 9. ENTRYPOINT
# ════════════════════════════════════════════════════════════════════

def register_collection_item(sb_client, url, created_by, manual_id, article_id):
    """
    Registra o actualiza la entrada en mm_collections_v2 para seguimiento en el Dashboard.

    Estrategia de búsqueda en dos pasos para cubrir el caso de actualización PDF
    donde Google Drive genera una URL nueva en cada re-subida:
      1. Buscar por source_url exacto (re-ingesta Zoho o mismo archivo Drive)
      2. Si no aparece, buscar por (articulo, manual) → actualizar source_url al nuevo valor
      3. Si tampoco existe, insertar como entrada nueva.
    """
    from datetime import datetime, timezone

    if not manual_id:
        manual_id = "PDF Externo"
    if not article_id:
        article_id = "Documento General"

    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # ── Paso 1: buscar por URL exacta ──────────────────────────────
        by_url = (
            sb_client.table("mm_collections_v2")
            .select("id")
            .eq("source_url", url)
            .execute()
        )

        if by_url.data:
            # Mismo URL → solo actualizar metadatos de modificación
            print(f"📝 Actualizando mm_collections_v2 (misma URL): {url}", flush=True)
            sb_client.table("mm_collections_v2").update({
                "modified_by": created_by,
                "modified_at": now_iso,
            }).eq("source_url", url).execute()
            return

        # ── Paso 2: buscar por (articulo, manual) ─────────────────────
        # Cubre el caso PDF donde el Drive URL cambia en cada re-subida
        by_name = (
            sb_client.table("mm_collections_v2")
            .select("id")
            .eq("articulo", article_id)
            .eq("manual", manual_id)
            .execute()
        )

        if by_name.data:
            # Encontrado por nombre → actualizar source_url al nuevo valor + metadatos
            print(
                f"📝 Actualizando mm_collections_v2 (nueva URL Drive para '{article_id}'): {url}",
                flush=True,
            )
            sb_client.table("mm_collections_v2").update({
                "source_url": url,
                "modified_by": created_by,
                "modified_at": now_iso,
            }).eq("articulo", article_id).eq("manual", manual_id).execute()
            return

        # ── Paso 3: registro nuevo ─────────────────────────────────────
        print(f"📝 Registrando mm_collections_v2 (nuevo): {url}", flush=True)
        sb_client.table("mm_collections_v2").insert({
            "source_url": url,
            "created_by": created_by,
            "manual": manual_id,
            "articulo": article_id,
        }).execute()

    except Exception as e:
        print(f"⚠️ Error registrando en mm_collections_v2: {e}", flush=True)


async def main_async():
    parser = argparse.ArgumentParser(
        description="Ingesta RAG v3 — chunking semántico + embeddings paralelos + Storage"
    )
    parser.add_argument("--pdf", required=True, help="Ruta al archivo PDF")
    parser.add_argument("--source", required=True, help="Nombre de la fuente (ej: 'Google Drive')")
    parser.add_argument("--url", required=True, help="URL canónica del documento")
    parser.add_argument("--webhook", required=False, help="URL de webhook para reportar progreso")
    parser.add_argument("--user", required=False, help="Email del usuario que ingesta")
    parser.add_argument("--keep", action="store_true", help="No borrar el PDF tras la ingesta")
    parser.add_argument(
        "--no-dedup",
        action="store_true",
        help="Omitir eliminación de vectores previos con el mismo source_url",
    )
    # V4 enriched metadata (opcionales para PDFs externos)
    parser.add_argument("--manual-name", required=False, help="Nombre del manual (slug, ej: 'mysatcom-v6')")
    parser.add_argument("--article-title", required=False, help="Título del artículo")
    parser.add_argument("--collection-id", required=False, help="ID de colección Zoho Learn")
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        send_webhook(args.webhook, f"❌ El archivo '{args.pdf}' no existe.", "error")
        print(f"❌ El archivo '{args.pdf}' no existe.", flush=True)
        exit(1)

    try:
        sb_client, gemini_client = init_clients()
    except RuntimeError as e:
        print(str(e), flush=True)
        exit(1)

    send_webhook(
        args.webhook,
        f"🚀 Iniciando ingesta RAG v3: {Path(args.pdf).name} (Usuario: {args.user})",
    )

    try:
        # Deduplicación antes de insertar
        if not args.no_dedup:
            delete_existing_vectors(sb_client, args.url, args.webhook)

        # Registro en mm_collections_v2 para la vista general
        register_collection_item(
            sb_client, 
            args.url, 
            args.user, 
            args.manual_name, 
            args.article_title
        )

        chunks = await extract_chunks_async(
            args.pdf,
            gemini_client,
            sb_client,
            args.source,
            args.url,
            args.webhook,
            created_by=args.user,
            manual_name=args.manual_name,
            article_title=args.article_title,
            collection_id=args.collection_id,
        )
        insert_to_supabase(sb_client, chunks, args.webhook)
        send_webhook(
            args.webhook,
            f"✨ Ingesta v3 completada: {len(chunks)} vectores de '{Path(args.pdf).name}'",
            "success",
        )
        print(f"✨ Ingesta completada: {len(chunks)} vectores.", flush=True)

    except Exception as e:
        send_webhook(args.webhook, f"🔥 Error crítico en ingesta v3: {e}", "error")
        print(f"🔥 Error crítico: {e}", flush=True)
        raise

    finally:
        if not args.keep and os.path.exists(args.pdf):
            os.remove(args.pdf)


if __name__ == "__main__":
    asyncio.run(main_async())
