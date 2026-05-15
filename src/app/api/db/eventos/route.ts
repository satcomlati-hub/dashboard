import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') || 'hoy';
    const evento = searchParams.get('evento');

    // Usamos "mySatcom" con casing exacto como en el resto del proyecto
    const result = await pool.query(
      'SELECT * FROM mysatcom.get_bitacora_eventos($1, $2)',
      [evento, range]
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error in Eventos API:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch events from database',
      details: error.message,
      code: error.code
    }, { status: 500 });
  }
}
