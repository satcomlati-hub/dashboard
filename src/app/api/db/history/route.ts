import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chat_id');

  if (!chatId) {
    return NextResponse.json({ error: 'chat_id is required' }, { status: 400 });
  }

  try {
    const result = await query('SELECT * FROM get_chat_history($1);', [chatId]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error in history route:', error);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}
