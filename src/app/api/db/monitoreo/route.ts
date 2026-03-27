import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await pool.query(
      `SELECT
          fecha_evento AS fecha_ecuador,
          key,
          num_eventos,
          pais,
          detalle_evento
      FROM mySatcom.bitacora_eventos
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM mySatcom.bitacora_eventos`
    );

    return NextResponse.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in Monitoreo widget API:', error);
    return NextResponse.json({ error: 'Failed to fetch Monitoreo data' }, { status: 500 });
  }
}
