import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const query = 'DELETE FROM sara_chat_memory WHERE session_id = $1';
    await pool.query(query, [sessionId]);

    return NextResponse.json({ success: true, message: 'Chat history deleted' });
  } catch (error) {
    console.error('Delete Chat Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
