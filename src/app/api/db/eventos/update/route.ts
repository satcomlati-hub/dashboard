import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, estado } = body;

    if (!key) {
      return NextResponse.json({ error: 'Falta el parámetro key' }, { status: 400 });
    }
    if (!estado) {
      return NextResponse.json({ error: 'Falta el parámetro estado' }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE mysatcom.bitacora_eventos 
       SET estado = $1 
       WHERE key = $2 
       RETURNING *`,
      [estado, key]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
