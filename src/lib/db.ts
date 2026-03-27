import { Pool } from 'pg';

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: isProduction,
  },
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
