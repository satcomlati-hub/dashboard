"""
zoho_learn_ingest.py
====================
Script exclusivo para procesar links de Zoho Learn (manuales enteros o artículos individuales).
Extrae el contenido directamente desde Zoho, lo convierte a PDF temporalmente y lo
vectoriza utilizando las funciones optimizadas de sara_pdf_ingest_v2.py.

Uso:
    python zoho_learn_ingest.py --url "https://learn.zohopublic.com/..." --webhook "https://..."

Requiere la instalación previa de playwright (con navegadores instalados) y 
las librerías presentes en sara_pdf_ingest_v2.py
"""

import asyncio
import argparse
import os
import uuid
import re
import requests
import redis
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Redis: URL leída desde variable de entorno para no hardcodear credenciales
# Ejemplo: export REDIS_URL="redis://default:PASSWORD@host:port"
_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get(
            "REDIS_URL",
            "redis://default:LHV5rHVsQvzKRLYwVBzVPjwVsTe9dyVW@redis-17553.c16.us-east-1-3.ec2.cloud.redislabs.com:17553",
        )
        _redis_client = redis.from_url(redis_url, decode_responses=True)
    return _redis_client

# Importamos las funciones base de la ingestora v3 (RAG 2ª Generación)
# v3 añade: chunking semántico, embeddings paralelos, imágenes en Supabase Storage
from sara_pdf_ingest_v3 import (
    init_clients,
    extract_chunks_async as extract_chunks,
    insert_to_supabase,
    delete_existing_vectors,
    send_webhook,
)

def fetch_article_author(manual_id: str, article_id: str, fallback: str) -> str:
    """
    Consulta la API de Zoho Learn para obtener el correo del autor del artículo.
    Prioridad: userDetails.mailId → authorDetails.lastModifiedMailId → authorDetails.mailId → fallback.
    Lee el token Bearer desde Redis (clave 'TokenZoho') para garantizar que siempre
    está vigente (se renueva cada 45 min).
    """
    try:
        token = get_redis_client().get("TokenZoho") or ""
    except Exception as e:
        print(f"⚠️  No se pudo leer TokenZoho desde Redis: {e}", flush=True)
        token = ""
    portal = os.environ.get("ZOHO_PORTAL", "SATCOMLA")

    if not token or not manual_id or not article_id:
        return fallback

    url = f"https://learn.zoho.com/learn/api/v1/portal/{portal}/manual/{manual_id}/article/{article_id}"
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"⚠️  Zoho Learn API respondió {resp.status_code} al obtener autor. Usando fallback.", flush=True)
            return fallback

        data = resp.json()
        article = data.get("article", {})
        user_details = article.get("userDetails", {})
        author_details = article.get("authorDetails", {})

        email = (
            user_details.get("mailId")
            or author_details.get("lastModifiedMailId")
            or author_details.get("mailId")
        )
        if email:
            print(f"👤 Autor resuelto desde Zoho Learn API: {email}", flush=True)
            return email
    except Exception as e:
        print(f"⚠️  Error al consultar autor en Zoho Learn: {e}", flush=True)

    return fallback


def extract_collection_id(url: str) -> str | None:
    """Extrae el collection hash del parámetro ?p= en URLs de Zoho Learn."""
    match = re.search(r"[?&]p=([a-f0-9]+)", url)
    return match.group(1) if match else None

def extract_zoho_ids(url):
    """Extrae el ID del manual y del artículo de una URL de Zoho Learn."""
    # Buscar manual/ID hasta el próximo /, ?, # o fin de cadena
    manual_match = re.search(r"/manual/([^/?#]+)", url)
    # Buscar article/ID hasta el próximo /, ?, # o fin de cadena
    article_match = re.search(r"/article/([^/?#]+)", url)
    
    m_id = manual_match.group(1) if manual_match else None
    a_id = article_match.group(1) if article_match else None
    
    return m_id, a_id

def register_collection_item(sb_client, url, created_by):
    """
    Registra o actualiza la entrada en mm_collections_v2.

    Para Zoho Learn la URL es estable (mismo link siempre apunta al mismo artículo),
    por lo que el caso habitual es encontrarlo por source_url y actualizar
    modified_by / modified_at. El fallback por (manual, articulo) cubre situaciones
    donde el mismo artículo fue registrado con una URL canónica diferente.
    """
    from datetime import datetime, timezone
    manual_id, article_id = extract_zoho_ids(url)

    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # ── Paso 1: buscar por URL exacta (caso habitual en Zoho) ──────
        by_url = (
            sb_client.table("mm_collections_v2")
            .select("id")
            .eq("source_url", url)
            .execute()
        )

        if by_url.data:
            print(f"📝 Actualizando mm_collections_v2 (modificación): {url}")
            sb_client.table("mm_collections_v2").update({
                "modified_by": created_by,
                "modified_at": now_iso,
            }).eq("source_url", url).execute()
            return

        # ── Paso 2: fallback por (manual, articulo) ────────────────────
        if manual_id and article_id:
            by_name = (
                sb_client.table("mm_collections_v2")
                .select("id")
                .eq("articulo", article_id)
                .eq("manual", manual_id)
                .execute()
            )
            if by_name.data:
                print(f"📝 Actualizando mm_collections_v2 (nueva URL para '{article_id}'): {url}")
                sb_client.table("mm_collections_v2").update({
                    "source_url": url,
                    "modified_by": created_by,
                    "modified_at": now_iso,
                }).eq("articulo", article_id).eq("manual", manual_id).execute()
                return

        # ── Paso 3: registro nuevo ─────────────────────────────────────
        print(f"📝 Registrando mm_collections_v2 (nuevo): {url}")
        sb_client.table("mm_collections_v2").insert({
            "source_url": url,
            "created_by": created_by,
            "manual": manual_id,
            "articulo": article_id,
        }).execute()

    except Exception as e:
        print(f"⚠️ Error registrando en mm_collections_v2: {e}")


def ensure_author_in_editors(sb_client, url: str, author_email: str):
    """
    Garantiza que author_email aparezca en allowed_editors del artículo.
    Si ya está presente (como created_by o en el array), no hace nada.
    """
    if not author_email:
        return
    try:
        result = (
            sb_client.table("mm_collections_v2")
            .select("created_by, allowed_editors")
            .eq("source_url", url)
            .execute()
        )
        if not result.data:
            return

        row = result.data[0]
        # Si ya es el creador no hace falta agregarlo como editor
        if row.get("created_by") == author_email:
            return

        editors = row.get("allowed_editors") or []
        if author_email not in editors:
            editors.append(author_email)
            sb_client.table("mm_collections_v2").update(
                {"allowed_editors": editors}
            ).eq("source_url", url).execute()
            print(f"👤 Autor '{author_email}' agregado a allowed_editors de: {url}", flush=True)
    except Exception as e:
        print(f"⚠️  Error actualizando allowed_editors: {e}", flush=True)


async def goto_with_retry(page, url, wait_until="domcontentloaded", timeout=60000, retries=3, delay=4):
    """Navega a una URL con reintentos ante errores de red transitorios (ERR_NETWORK_CHANGED, etc.)."""
    last_error = None
    for attempt in range(retries):
        try:
            await page.goto(url, wait_until=wait_until, timeout=timeout)
            return
        except Exception as e:
            last_error = e
            if any(tag in str(e) for tag in ["ERR_NETWORK_CHANGED", "ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED", "ERR_INTERNET_DISCONNECTED", "net::"]):
                if attempt < retries - 1:
                    print(f"⚠️  Error de red transitorio (intento {attempt+1}/{retries}): {str(e)[:100]}. Reintentando en {delay}s...", flush=True)
                    await asyncio.sleep(delay)
                    continue
            raise
    raise last_error


async def scroll_to_bottom(page):
    """Hace scroll para cargar imágenes perezosas (lazy loading)."""
    await page.evaluate("""
        async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 500;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 50);
            });
        }
    """)

async def process_article(browser, article_url, gemini_client, sb_client, webhook_url, created_by=None):
    """Convierte un único artículo a PDF temporal, lo vectoriza y lo inserta."""
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    )
    page = await context.new_page()
    
    send_webhook(webhook_url, f"▶️ Descargando artículo: {article_url}", "info")
    print(f"▶️ Descargando artículo: {article_url}", flush=True)

    try:
        await goto_with_retry(page, article_url)
        try:
            await page.wait_for_selector("zlearn-article-content", timeout=20000)
        except:
            print(f"⚠️  Timeout esperando zlearn-article-content en {article_url}. Abortando.")
            await browser.close()
            return None
            
        await scroll_to_bottom(page)
        await asyncio.sleep(1)
        
        raw_title = await page.title()
        title = raw_title.split(" - ")[0].strip()

        # Extraer campos de metadata enriquecida para V4
        manual_name, article_slug = extract_zoho_ids(article_url)
        article_title = title  # título real de la página (más legible que el slug)
        collection_id = extract_collection_id(article_url)
        
        article_element = await page.query_selector("zlearn-article-content")
        if article_element:
            content_html = await article_element.inner_html()
        else:
            content_html = await page.inner_html("#zid-manual-wrapper")
            
        soup = BeautifulSoup(content_html, "html.parser")
        
        # Eliminar menú, sidebar y botones innecesarios
        for tag in soup.select("nav, .zln-sidebar, .zln-header, button, .zln-footer, #zid-left-panel, .zln-article-toc, .zln-manual-left-layout, lyte-tree"):
            tag.decompose()
            
        # Generar HTML base
        final_html = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; padding: 40px; }}
                h1 {{ color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }}
                img {{ max-width: 100%; height: auto; display: block; margin: 20px 0; border: 1px solid #ddd; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background-color: #f8f9fa; }}
                pre, code {{ background-color: #f4f4f4; padding: 2px 5px; }}
            </style>
        </head>
        <body>
            <h1>{title}</h1>
            {str(soup)}
        </body>
        </html>
        """
        
        temp_pdf = f"/tmp/zoho_temp_{uuid.uuid4().hex[:8]}.pdf"
        await page.set_content(final_html)
        await page.pdf(path=temp_pdf, format="A4", margin={"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"})
        await context.close()
        
        send_webhook(webhook_url, f"⚙️ Extrayendo vectores y procesando embeddings para: {article_url}", "info")

        # Resolver el autor real desde la API de Zoho Learn (sobreescribe el fallback --user)
        resolved_author = fetch_article_author(manual_name, article_slug, fallback=created_by)

        # Registrar en la tabla de colecciones ANTES de procesar los vectores
        register_collection_item(sb_client, article_url, resolved_author)

        # Asegurar que el autor de Zoho aparece en "Responsables de actualización"
        ensure_author_in_editors(sb_client, article_url, resolved_author)

        # Eliminar vectores previos del mismo artículo para evitar duplicados
        delete_existing_vectors(sb_client, article_url, webhook_url)

        # Ingesta usando la lógica reutilizable (v4: incluye metadata enriquecida)
        chunks = await extract_chunks(
            temp_pdf, gemini_client, sb_client,
            source_name="Zoho Learn",
            source_url=article_url,
            webhook_url=webhook_url,
            created_by=resolved_author,
            manual_name=manual_name,
            article_title=article_title,
            collection_id=collection_id,
        )
        insert_to_supabase(sb_client, chunks, webhook_url)
        
        # Borrar PDF temporal
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)
            
    except Exception as e:
        msg = f"❌ Error procesando {article_url}: {str(e)}"
        print(msg, flush=True)
        send_webhook(webhook_url, msg, "error")
        await context.close()


async def main_async(url, webhook_url, created_by=None):
    send_webhook(webhook_url, f"🚀 Iniciando proceso Zoho Learn... (Usuario: {created_by})", "info")
    
    # Init BD y Gemini
    try:
        sb_client, gemini_client = init_clients()
    except Exception as e:
        send_webhook(webhook_url, f"❌ Error inicializando clientes: {e}", "error")
        return

    is_manual = "/manual/" in url and "/article/" not in url
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        if not is_manual:
            send_webhook(webhook_url, f"📌 Modo detectado: Artículo Individual (Usuario: {created_by})", "info")
            await process_article(browser, url, gemini_client, sb_client, webhook_url, created_by=created_by)
            send_webhook(webhook_url, "✅ Ingesta de artículo individual completada.", "success")
        else:
            send_webhook(webhook_url, "📚 Modo detectado: Manual Completo", "info")
            # Extraer links del manual
            context = await browser.new_context()
            page = await context.new_page()
            
            send_webhook(webhook_url, "Buscando índice de artículos...", "info")
            await goto_with_retry(page, url)
            await asyncio.sleep(2)
            await page.wait_for_selector("#zid-manual-wrapper", timeout=30000)
            
            # Expandir todas las secciones
            try:
                expand_btn = await page.query_selector("button.zls-hover-underline")
                if expand_btn and "Expand all" in await expand_btn.inner_text():
                    await expand_btn.click()
                    await asyncio.sleep(3)
                
                arrows = await page.query_selector_all("button.zln-arrow")
                for arrow in arrows:
                    try:
                        await arrow.click(timeout=1000)
                        await asyncio.sleep(0.2)
                    except:
                        pass
            except:
                pass
                
            links = await page.query_selector_all("lyte-tree-content a[href*='/article/']")
            if not links:
                links = await page.query_selector_all("a.zln-article-link")
                
            urls_to_visit = []
            for link in links:
                href = await link.get_attribute("href")
                if href and "/article/" in href:
                    if href.startswith("/"):
                        full_url = f"https://learn.zohopublic.com{href}"
                    elif not href.startswith("http"):
                        full_url = f"https://learn.zohopublic.com/external{href}"
                    else:
                        full_url = href
                    if full_url not in urls_to_visit:
                        urls_to_visit.append(full_url)
            
            await context.close()
            total_urls = len(urls_to_visit)
            
            if total_urls == 0:
                send_webhook(webhook_url, "❌ No se encontraron artículos en el manual.", "error")
            else:
                send_webhook(webhook_url, f"🔍 Indexados {total_urls} artículos. Iniciando ingesta batch...", "info")
                for i, article_url in enumerate(urls_to_visit):
                    send_webhook(webhook_url, f"📊 Procesando artículo {i+1}/{total_urls}: {article_url}", "info")
                    await process_article(browser, article_url, gemini_client, sb_client, webhook_url, created_by=created_by)
                    
                send_webhook(webhook_url, f"✅ Ingesta de manual completa ({total_urls} artículos procesados).", "success")

        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingesta inteligente de Zoho Learn a Supabase")
    parser.add_argument("--url", required=True, help="URL del artículo o manual de Zoho Learn")
    parser.add_argument("--webhook", required=False, help="URL de webhook para reportar progreso")
    parser.add_argument("--user", required=False, help="Email del usuario que realiza la ingesta")
    args = parser.parse_args()
    
    asyncio.run(main_async(args.url, args.webhook, created_by=args.user))
