export const dynamic = 'force-dynamic';

const API_URL = (process.env.AGENTES_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API_TOKEN = process.env.AGENTES_API_TOKEN ?? '';

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${API_URL}/${path.join('/')}${incoming.search}`;

  const headers = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (!['host', 'connection', 'transfer-encoding'].includes(k.toLowerCase())) {
      headers.set(k, v);
    }
  }
  // Inyectar token admin solo si el cliente no envió su propio Authorization
  // (el playground manda el token del agente directamente)
  if (API_TOKEN && !request.headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${API_TOKEN}`);
  }
  headers.set('Content-Type', 'application/json');

  const init: RequestInit & { duplex?: string } = { method: request.method, headers };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
    init.duplex = 'half';
  }

  const upstream = await fetch(target, init);

  if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive',
      },
    });
  }

  const resHeaders = new Headers(upstream.headers);
  resHeaders.delete('transfer-encoding');
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

export function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
