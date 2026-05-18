import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { rows } = await query('SELECT * FROM mysatcom.catalogo_eventos_manuales ORDER BY evento ASC');
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { evento, programar_evento, afecta_uptime, severidad, activo } = body;

    const { rows } = await query(
      `INSERT INTO mysatcom.catalogo_eventos_manuales 
       (evento, programar_evento, afecta_uptime, severidad, activo) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [evento, programar_evento, afecta_uptime, severidad, activo]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, evento, programar_evento, afecta_uptime, severidad, activo } = body;

    const { rows } = await query(
      `UPDATE mysatcom.catalogo_eventos_manuales 
       SET evento = $1, programar_evento = $2, afecta_uptime = $3, severidad = $4, activo = $5
       WHERE id = $6 RETURNING *`,
      [evento, programar_evento, afecta_uptime, severidad, activo, id]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
