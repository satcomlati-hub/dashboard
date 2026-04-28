import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT session_id, title, preview,
            EXTRACT(EPOCH FROM updated_at) * 1000 AS timestamp
       FROM sara_sessions_index
      WHERE user_email = $1
      ORDER BY updated_at DESC
      LIMIT 100`,
    [email],
  );

  return NextResponse.json({
    sessions: rows.map(r => ({
      id: r.session_id,
      title: r.title ?? 'Sesión',
      preview: r.preview ?? '',
      timestamp: Number(r.timestamp),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const userName = session?.user?.name ?? null;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, title, preview } = await request.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  await pool.query(
    `INSERT INTO sara_sessions_index (session_id, user_email, user_name, title, preview, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (session_id) DO UPDATE
         SET title      = COALESCE(EXCLUDED.title,   sara_sessions_index.title),
             preview    = COALESCE(EXCLUDED.preview, sara_sessions_index.preview),
             user_name  = COALESCE(EXCLUDED.user_name, sara_sessions_index.user_name),
             updated_at = now()
         WHERE sara_sessions_index.user_email = EXCLUDED.user_email`,
    [sessionId, email, userName, title ?? null, preview ?? null],
  );

  return NextResponse.json({ success: true });
}
