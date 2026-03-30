import { Pool } from 'pg';

// Supabase pooler (port 6543, PgBouncer transaction mode) requires
// rejectUnauthorized: false — the connection is still TLS-encrypted,
// but certificate hostname verification must be disabled for this endpoint.
// Also cap connections to 1 per serverless function instance (Vercel).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
