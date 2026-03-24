import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query('SELECT * FROM get_recent_active_chats();');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error in chats route:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}
