import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await pool.query('SELECT sync_public_articles() AS synced');
    const synced: number = result.rows[0]?.synced ?? 0;
    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error('Error syncing public articles:', error);
    return NextResponse.json({ error: 'Failed to sync public articles' }, { status: 500 });
  }
}
