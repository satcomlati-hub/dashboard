import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Lista de conversaciones de Telegram del agente SARA Público (visor de chat + handoff).
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_sara_publico_chats();');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error in sara-chats route:', error);
    return NextResponse.json({ error: 'Failed to fetch SARA chats' }, { status: 500 });
  }
}
