import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const query = formData.get('query');
    const sessionId = formData.get('sessionId');
    const image = formData.get('image');

    if (!query && !image) {
      return NextResponse.json({ error: 'Query or Image is required' }, { status: 400 });
    }

    const n8nWebhookUrl = process.env.SARA_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.error('SARA_WEBHOOK_URL is not set in environment variables');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    // Reenviamos el FormData completo a n8n. 
    // fetch establecerá automáticamente el Content-Type adecuado con el boundary para multipart/form-data.
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n webhook error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json({ error: 'Error communicating with SARA' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
