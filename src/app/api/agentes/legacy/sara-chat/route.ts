// Proxy del comparador hacia el webhook viejo de SARA (n8n).
// Recibe el mismo payload JSON {prompt, conversation_id} que el endpoint
// nuevo /api/agentes/v1/agents/.../invoke/stream y traduce el NDJSON del
// webhook legacy a SSE compatible con streamOnePanel (event: data | done | error).
//
// Webhook legacy: https://sara.mysatcomla.com/webhook/sara-chat
//   - Entrada: multipart/form-data { query, sessionId, userName?, userEmail?, imageUrl? }
//   - Salida : application/x-ndjson — una línea por token:
//        {"type":"item","content":"texto..."}
//        {"type":"error","content":"detalle"}
//     Puede incluir un marcador final {"type":"item","content":"[[IMGS]]:url1|url2"}
//     que aquí convertimos a markdown inline al cerrar el stream.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const LEGACY_WEBHOOK =
  process.env.SARA_LEGACY_WEBHOOK_URL ??
  'https://sara.mysatcomla.com/webhook/sara-chat';

type LegacyEvent = { type?: string; content?: string } & Record<string, unknown>;

function sseChunk(event: string, payload: string): Uint8Array {
  // SSE separa eventos por línea en blanco. Los saltos dentro del payload
  // se mandan como múltiples `data:` (el cliente los reensambla con \n).
  const lines = payload.split('\n').map(l => `data: ${l}`).join('\n');
  return new TextEncoder().encode(`event: ${event}\n${lines}\n\n`);
}

export async function POST(request: Request) {
  let prompt = '';
  let conversationId = '';
  try {
    const body = await request.json();
    prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!prompt.trim()) {
    return new Response('Empty prompt', { status: 400 });
  }

  const form = new FormData();
  form.append('query', prompt);
  if (conversationId) form.append('sessionId', conversationId);

  const t0 = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(LEGACY_WEBHOOK, { method: 'POST', body: form });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch error';
    return new Response(
      `event: error\ndata: No se pudo contactar el webhook legacy: ${msg}\n\n` +
        `event: done\ndata: {"duration_ms":${Date.now() - t0}}\n\n`,
      {
        status: 502,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      },
    );
  }

  if (!upstream.ok) {
    const errBody = await upstream.text().catch(() => '');
    return new Response(
      `event: error\ndata: Webhook legacy respondió ${upstream.status}: ${errBody.slice(0, 200)}\n\n` +
        `event: done\ndata: {"duration_ms":${Date.now() - t0}}\n\n`,
      {
        status: upstream.status,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      },
    );
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    return new Response(
      `event: error\ndata: Webhook legacy sin cuerpo\n\nevent: done\ndata: {"duration_ms":${Date.now() - t0}}\n\n`,
      {
        status: 502,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = '';
      let pendingImages: string[] = [];

      const handleLine = (raw: string) => {
        const line = raw.trim();
        if (!line) return;
        let evt: LegacyEvent;
        try {
          evt = JSON.parse(line) as LegacyEvent;
        } catch {
          // Si una línea no es JSON, la pasamos como texto plano
          controller.enqueue(sseChunk('data', line));
          return;
        }
        const content = typeof evt.content === 'string' ? evt.content : '';
        if (evt.type === 'error') {
          controller.enqueue(sseChunk('error', content || 'error legacy'));
          return;
        }
        // Marcador [[IMGS]]:url|url — lo retenemos para el final
        const imgMatch = content.match(/^\[\[IMGS\]\]:(.+)$/);
        if (imgMatch) {
          pendingImages = imgMatch[1].split('|').map(s => s.trim()).filter(Boolean);
          return;
        }
        if (content) controller.enqueue(sseChunk('data', content));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nlIdx: number;
          while ((nlIdx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nlIdx);
            buffer = buffer.slice(nlIdx + 1);
            handleLine(line);
          }
        }
        if (buffer.trim()) handleLine(buffer);

        if (pendingImages.length > 0) {
          const md = '\n\n' + pendingImages.map(u => `![imagen](${u})`).join('\n');
          controller.enqueue(sseChunk('data', md));
        }

        controller.enqueue(
          new TextEncoder().encode(
            `event: done\ndata: {"duration_ms":${Date.now() - t0}}\n\n`,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream error';
        controller.enqueue(sseChunk('error', msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
