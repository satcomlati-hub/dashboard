import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  const owner = await pool.query(
    'SELECT 1 FROM sara_sessions_index WHERE session_id = $1 AND user_email = $2',
    [sessionId, email],
  );
  if (owner.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { rows } = await pool.query(
    `SELECT id, message
       FROM n8n_chat_histories
      WHERE session_id = $1
      ORDER BY id ASC`,
    [sessionId],
  );

  const messages = rows
    .map(r => {
      const m = r.message ?? {};
      const type = m.type ?? m.role;
      const role: 'user' | 'assistant' | null =
        type === 'human' || type === 'user' ? 'user'
        : type === 'ai' || type === 'assistant' ? 'assistant'
        : null;
      if (!role) return null;
      return {
        id: String(r.id),
        role,
        content: typeof m.content === 'string' ? m.content : '',
      };
    })
    .filter(Boolean);

  return NextResponse.json({ messages });
}
