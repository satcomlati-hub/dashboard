import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { rows } = await query('SELECT * FROM mysatcom.catalogo_ambientes ORDER BY ambiente ASC');
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ambiente, activo } = body;

    const { rows } = await query(
      `INSERT INTO mysatcom.catalogo_ambientes (ambiente, activo) VALUES ($1, $2) RETURNING *`,
      [ambiente, activo !== undefined ? activo : true]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ambiente, activo } = body;

    const { rows } = await query(
      `UPDATE mysatcom.catalogo_ambientes SET ambiente = $1, activo = $2 WHERE id = $3 RETURNING *`,
      [ambiente, activo, id]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
