import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, sessionId } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const n8nWebhookUrl = process.env.SARA_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.error('SARA_WEBHOOK_URL is not set in environment variables');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, sessionId }),
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
