import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { chatId, message } = await request.json();

    if (!chatId || !message) {
      return NextResponse.json({ error: 'ChatId and Message are required' }, { status: 400 });
    }

    const n8nUrl = `https://satcomla.app.n8n.cloud/webhook/SendUserMessage?ChatId=${chatId}&Mensaje=${encodeURIComponent(message)}`;
    
    const response = await fetch(n8nUrl, {
      method: 'GET', // Following the user's example URL format which uses query params
    });

    if (!response.ok) {
      throw new Error(`n8n responded with ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending message to n8n:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
