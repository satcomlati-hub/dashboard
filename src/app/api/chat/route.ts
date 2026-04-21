import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const query = formData.get('query');
    const image = formData.get('image');

    if (!query && !image) {
      return NextResponse.json({ error: 'Query or Image is required' }, { status: 400 });
    }

    const n8nWebhookUrl = process.env.SARA_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.error('SARA_WEBHOOK_URL is not set in environment variables');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n webhook error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json({ error: 'Error communicating with SARA' }, { status: response.status });
    }

    // n8n streaming devuelve Transfer-Encoding: chunked sin Content-Type explícito.
    // Forzamos application/x-ndjson para que el cliente detecte el modo stream.
    const upstreamType = response.headers.get('content-type') || '';
    const contentType = upstreamType || 'application/x-ndjson';

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
