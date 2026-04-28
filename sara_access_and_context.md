---
description: Guía de acceso y contexto técnico del servidor SARA (Satcom)
---

// turbo-all
# Contexto Técnico: Entornos Satcom (SARA y Producción)

Este documento define la separación de entornos para el RAG Multimodal de Satcom.

## 1. Entorno SARA (Desarrollo e Ingesta Pesada)
- **Host**: `129.146.162.57` (Ubuntu)
- **Función**: Procesamiento de archivos PDF, extracción de imágenes y ejecución de scripts Python.
- **n8n SARA**: Instancia local para pruebas de ingesta.

## 2. Entorno Producción (n8n Cloud/Final)
- **Función**: Punto de entrada final para despliegues validados.
- **n8n Producción**: Instancia principal de Satcom.

## Detalles de Conexión (SARA)
- **Usuario**: `ubuntu`
- **Llave SSH**: `ssh-key-2025-05-26.key` (Ubicada en `C:/Users/jesus/.gemini/antigravity/scratch/SARA/Keys/`)
- **Comando de Acceso**:
  ```bash
  ssh -i "C:/Users/jesus/.gemini/antigravity/scratch/SARA/Keys/ssh-key-2025-05-26.key" ubuntu@129.146.162.57
  ```

## Scripts de Ingesta (RAG2)
Directorio: `C:/Users/jesus/.gemini/antigravity/RAG2/implementacion_SARA/`

### `sara_pdf_ingest_v3.py` — Ingesta de PDFs
- **Uso**: Documentos PDF externos (Google Drive, archivos subidos manualmente).
- **Tabla destino**: `zoho_learn_vectors`
- **Características**:
  - Chunking semántico con `RecursiveCharacterTextSplitter` propio
  - Embeddings en paralelo (`asyncio.gather`)
  - Imágenes → Supabase Storage bucket `rag-images`
  - Context Prepending si se pasa `--manual-name` y `--article-title`
  - Deduplicación paginada (elimina lotes de 500 IDs, soporta >1000 vectores)
  - `ingestion_version: "v3-pdf"` en metadata
- **CLI**:
  ```bash
  python sara_pdf_ingest_v3.py \
    --pdf "/ruta/al/archivo.pdf" \
    --source "Google Drive" \
    --url "https://drive.google.com/..." \
    --webhook "https://..." \
    --user "email@satcomla.com" \
    [--manual-name "nombre-manual"] \
    [--article-title "Título del artículo"] \
    [--keep] [--no-dedup]
  ```

### `zoho_learn_ingest.py` — Ingesta de Zoho Learn (v5.2 Markdown-first)
- **Uso**: Artículos y manuales completos de Zoho Learn.
- **Tabla destino**: `zoho_learn_vectors`
- **Tabla de colecciones**: `mm_collections_v2` (registro automático)
- **Características**:
  - HTML → Markdown directo con `markdownify` (preserva tablas y encabezados)
  - Context Prepending automático (`[CONTEXTO: Manual: X | Artículo: Y]`)
  - Soporte de artículo individual o manual completo (detección automática por URL)
  - Deduplicación paginada antes de insertar
  - `ingestion_version: "v5.2-markdown"` en metadata
- **CLI**:
  ```bash
  # Artículo individual
  python zoho_learn_ingest.py \
    --url "https://learn.zohopublic.com/external/manual/X/article/Y?p=..." \
    --user "email@satcomla.com" \
    [--webhook "https://..."]

  # Manual completo (detecta automáticamente si no hay /article/ en la URL)
  python zoho_learn_ingest.py \
    --url "https://learn.zohopublic.com/external/manual/nombre-manual?p=..." \
    --user "email@satcomla.com"
  ```

## Variables de Entorno
Archivo: `C:/Users/jesus/.gemini/antigravity/RAG2/.env`

```env
GEMINI_API_KEY=...          # API key de Google AI Studio (puede expirar)
SUPABASE_URL=https://wpzfbpvtxrfyejoqjecu.supabase.co
SUPABASE_KEY=...            # Service role key de Supabase
DIRECT_LINK=postgresql://...  # Conexión directa PostgreSQL
```

## Base de Datos (Supabase)
- **Proyecto**: `wpzfbpvtxrfyejoqjecu`
- **Tabla principal**: `zoho_learn_vectors` (pgvector, 3072 dims)
- **Tabla colecciones**: `mm_collections_v2` (control de visibilidad y responsables)
- **Backup actual**: `zoho_learn_vectors_backup_20260421` (11,993 registros pre-limpieza)
- **Funciones RPC**:
  - `match_zoho_learn_vectors_v4` — búsqueda semántica en base privada
  - `match_mm_base_publica` — búsqueda semántica en base pública
