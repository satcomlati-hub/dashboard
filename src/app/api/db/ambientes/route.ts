import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { rows } = await query('SELECT * FROM mysatcom.catalogo_ambientes WHERE activo = true ORDER BY ambiente ASC');
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
