import { NextResponse } from 'next/server';

export const maxDuration = 60;

// ── Config ───────────────────────────────────────────────────────────
// Por defecto apunta al agente SARA V6 desplegado en SARA.
// Override via env (Vercel / .env.local):
//   SARA_V6_AGENT_URL    = base URL del endpoint /invoke/stream
//   SARA_V6_AGENT_TOKEN  = Bearer token (de ag_api_keys)
//   SARA_WEBHOOK_URL     = fallback al webhook n8n viejo (opcional)
const DEFAULT_AGENT_URL =
  'https://sara.mysatcomla.com/agentes/v1/agents/ab68c7cf-e593-4219-8240-a4d93171f5e7/invoke/stream';

const AGENT_URL = process.env.SARA_V6_AGENT_URL || DEFAULT_AGENT_URL;
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

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => '');
      console.error(
        `Agent V6 error ${upstream.status}: ${errBody.slice(0, 300)}`,
      );
      return NextResponse.json(
        { error: 'Error comunicando con SARA V6' },
        { status: upstream.status || 500 },
      );
    }

    // Convertir SSE Antigravity → NDJSON del formato del frontend.
    // Formato upstream:
    //   data: <chunk>\n\n            ← texto plano del modelo
    //   event: error\ndata: <msg>\n\n
    //   event: done\ndata: {json}\n\n
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        const emit = (chunk: string) => {
          fullText += chunk;
          controller.enqueue(ndjsonItem(chunk));
        };

        const processBlock = (block: string) => {
          // Un bloque SSE puede contener varias líneas "field: value"
          const lines = block.split('\n');
          let event: string | null = null;
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              // Concatenar líneas data: respetando que upstream las
              // separa con \n cuando son multi-línea.
              const piece = line.slice(5).startsWith(' ')
                ? line.slice(6)
                : line.slice(5);
              data += (data ? '\n' : '') + piece;
            }
          }
          if (!data) return;

          if (event === 'error') {
            controller.enqueue(ndjsonError(data));
            return;
          }
          if (event === 'done') {
            return; // metadata final, no se muestra
          }
          // Evento default = mensaje del agente
          emit(data);
        };

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() ?? '';
            for (const block of blocks) {
              if (block.trim()) processBlock(block);
            }
          }
          if (buffer.trim()) processBlock(buffer);

          // Marker de imágenes — SOLO como fallback si el agente no las
          // insertó inline con ![](url). Si ya las puso inline, ReactMarkdown
          // las renderiza dentro del flujo del texto y NO queremos duplicarlas
          // como thumbnails al final.
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
          try {
            reader.releaseLock();
          } catch {
            /* ignore */
          }
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
