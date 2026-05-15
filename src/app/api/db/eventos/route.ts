import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') || 'hoy';
    const evento = searchParams.get('evento');

    // Llamar a la función optimizada directamente en Postgres
    const result = await pool.query(
      'SELECT * FROM mysatcom.get_bitacora_eventos($1, $2)',
      [evento, range]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error in Eventos API:', error);
    return NextResponse.json({ error: 'Failed to fetch events from database' }, { status: 500 });
  }
}
