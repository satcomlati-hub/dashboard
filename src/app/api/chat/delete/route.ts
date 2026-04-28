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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM n8n_chat_histories WHERE session_id = $1', [sessionId]);
      await client.query('DELETE FROM sara_sessions_index WHERE session_id = $1', [sessionId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: 'Chat history deleted' });
  } catch (error) {
    console.error('Delete Chat Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
