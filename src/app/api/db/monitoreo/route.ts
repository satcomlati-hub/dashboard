import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT 
          TO_CHAR(created_at - interval '5 hours', 'DD-MM-YYYY HH24:MI:SS') AS fecha_ecuador, 
          key, 
          num_eventos, 
          pais, 
          detalle_evento 
      FROM mySatcom.bitacora_eventos
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error in Monitoreo widget API:', error);
    return NextResponse.json({ error: 'Failed to fetch Monitoreo data' }, { status: 500 });
  }
}
