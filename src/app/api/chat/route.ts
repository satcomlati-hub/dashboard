import { NextResponse } from 'next/server';

export const maxDuration = 120;

// ── Config ───────────────────────────────────────────────────────────
// Por defecto apunta al agente SARA V6 desplegado en SARA.
// Override via env (Vercel / .env.local):
//   SARA_V6_AGENT_URL    = base URL del endpoint /invoke/stream
//   SARA_V6_AGENT_TOKEN  = Bearer token (de ag_api_keys)
//   SARA_WEBHOOK_URL     = fallback al webhook n8n viejo (opcional)
// Usamos el endpoint /invoke (no /stream) porque hace post-procesamiento
// de la respuesta (cierra links rotos, restaura URLs truncadas). El streaming
// real se simula del lado servidor con chunks de 80 chars.
const DEFAULT_AGENT_URL =
  'https://sara.mysatcomla.com/agentes/v1/agents/ab68c7cf-e593-4219-8240-a4d93171f5e7/invoke';

// Si en producción la env var aún apunta a /invoke/stream (deploys viejos),
// la normalizamos a /invoke porque el flujo nuevo espera JSON, no SSE.
function normalizeAgentUrl(raw: string | undefined): string {
  const url = raw || DEFAULT_AGENT_URL;
  return url.replace(/\/invoke\/stream(?:\/)?$/, '/invoke');
}

const AGENT_URL = normalizeAgentUrl(process.env.SARA_V6_AGENT_URL);
const AGENT_TOKEN = process.env.SARA_V6_AGENT_TOKEN || '';
const LEGACY_WEBHOOK = process.env.SARA_WEBHOOK_URL || '';

// Si por alguna razón se quiere volver al webhook viejo:
//   USE_LEGACY_WEBHOOK=1 en env
const USE_LEGACY = process.env.USE_LEGACY_WEBHOOK === '1';

// ── Utilidades ──────────────────────────────────────────────────────

const STORAGE_URL_RE =
  /https:\/\/[^\s)\]"']+supabase\.co\/storage\/v1\/object\/public\/rag-images\/[^\s)\]"']+\.(?:png|jpe?g|gif|webp|svg)/gi;

function extractRagImages(text: string): string[] {
  const found = text.match(STORAGE_URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of found) {
    const clean = url.replace(/[.,;]+$/, '');
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function ndjsonItem(content: string): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ type: 'item', content }) + '\n',
  );
}

function ndjsonError(content: string): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ type: 'error', content }) + '\n',
  );
}

// ── Handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const query = (formData.get('query') as string) || '';
    const image = formData.get('image');
    const imageUrl = (formData.get('imageUrl') as string) || '';
    const sessionId = (formData.get('sessionId') as string) || '';
    const userName = (formData.get('userName') as string) || '';
    const userEmail = (formData.get('userEmail') as string) || '';

    if (!query && !image && !imageUrl) {
      return NextResponse.json(
        { error: 'Query or Image is required' },
        { status: 400 },
      );
    }

    // ─ Modo legacy (n8n) si se forzó por env ──────────────────────
    if (USE_LEGACY && LEGACY_WEBHOOK) {
      const r = await fetch(LEGACY_WEBHOOK, { method: 'POST', body: formData });
      const ct = r.headers.get('content-type') || 'application/x-ndjson';
      return new Response(r.body, {
        status: r.status,
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ─ Modo SARA V6 ──────────────────────────────────────────────
    if (!AGENT_TOKEN) {
      console.error(
        'SARA_V6_AGENT_TOKEN no está configurado en las variables de entorno',
      );
      return NextResponse.json(
        { error: 'Configuración del agente incompleta' },
        { status: 500 },
      );
    }

    // Construir prompt con metadata del usuario.
    // La URL de imagen NO va en el texto: se pasa en `image_urls` para que
    // el backend la descargue y la inyecte como adjunto multimodal al modelo.
    const parts: string[] = [];
    if (userName || userEmail) {
      const firstName = (userName || '').trim().split(/\s+/)[0] || '';
      const meta: string[] = [];
      if (firstName) meta.push(`nombre_corto=${firstName}`);
      if (userName) meta.push(`nombre_completo=${userName}`);
      if (userEmail) meta.push(`email=${userEmail}`);
      parts.push(`[USUARIO ACTUAL: ${meta.join(' | ')}]`);
    }
    // Si el usuario solo subió imagen sin texto, generar un prompt por defecto.
    const userQuery = query.trim() || (imageUrl ? 'Describe lo que ves en esta imagen y, si reconoces algo de los manuales SARA, complementa.' : '');
    if (userQuery) parts.push(userQuery);
    const prompt = parts.join('\n\n');

    const body: {
      prompt: string;
      conversation_id?: string;
      image_urls?: string[];
    } = {
      prompt,
      conversation_id: sessionId || undefined,
    };
    if (imageUrl) {
      body.image_urls = [imageUrl];
    }

    const upstream = await fetch(AGENT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '');
      console.error(
        `Agent V6 error ${upstream.status} (url=${AGENT_URL}): ${errBody.slice(0, 400)}`,
      );
      return NextResponse.json(
        {
          error: `Error comunicando con SARA V6 (HTTP ${upstream.status})`,
          detail: errBody.slice(0, 400),
        },
        { status: upstream.status || 500 },
      );
    }

    // Upstream es endpoint /invoke (no /stream): la respuesta viene como JSON
    // completo y ya post-procesado por el backend (links rotos arreglados,
    // URLs truncadas restauradas, fuentes ordenadas). Hacemos "fake streaming"
    // troceando el texto en chunks de ~80 chars para mantener UX.
    type InvokeResponse = {
      response?: string;
      run_id?: string;
      duration_ms?: number;
      error?: unknown;
    };

    let upstreamJson: InvokeResponse;
    try {
      upstreamJson = (await upstream.json()) as InvokeResponse;
    } catch (err) {
      console.error(`Agent V6 JSON parse failed (url=${AGENT_URL}):`, err);
      return NextResponse.json(
        {
          error: 'Respuesta del agente no es JSON válido',
          hint: 'Si AGENT_URL termina en /invoke/stream debe ser /invoke',
        },
        { status: 502 },
      );
    }
    const fullText = (upstreamJson.response ?? '').toString();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (!fullText) {
            controller.enqueue(ndjsonError('Respuesta vacía del agente'));
            controller.close();
            return;
          }

          const CHUNK_SIZE = 80;
          let i = 0;
          while (i < fullText.length) {
            let end = Math.min(i + CHUNK_SIZE, fullText.length);
            // ajustar al siguiente whitespace o salto si no estamos al final
            if (end < fullText.length) {
              const lookahead = fullText.slice(end, end + 40);
              const nextBreak = lookahead.search(/[\s\n]/);
              if (nextBreak > 0) end += nextBreak;
            }
            const chunk = fullText.slice(i, end);
            controller.enqueue(ndjsonItem(chunk));
            i = end;
            await new Promise((r) => setTimeout(r, 18));
          }

          // Marker de imágenes — fallback si el agente NO las puso inline
          const hasInlineImages = /!\[[^\]]*\]\(https?:\/\/[^)]+\)/.test(fullText);
          if (!hasInlineImages) {
            const imgs = extractRagImages(fullText);
            if (imgs.length > 0) {
              controller.enqueue(ndjsonItem(`[[IMGS]]:${imgs.join('|')}`));
            }
          }
        } catch (err) {
          controller.enqueue(
            ndjsonError(`Error de streaming: ${String(err).slice(0, 200)}`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
