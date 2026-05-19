import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM sat_monitoreo.monitoreo_config ORDER BY creado_en DESC'
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching monitoreo config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await pool.query(
      `INSERT INTO sat_monitoreo.monitoreo_config (
        nombre, ambientes, proceso_sp, frecuencia, 
        reglas_ids, esta_activo
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        payload.nombre,
        payload.ambientes || [],
        payload.proceso_sp,
        payload.frecuencia,
        payload.reglas_ids || [],
        payload.esta_activo !== false
      ]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating monitoreo config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload.id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    const keys = Object.keys(payload).filter(k => k !== 'id');
    const values = keys.map(k => payload[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    
    const result = await pool.query(
      `UPDATE sat_monitoreo.monitoreo_config SET ${setClause} WHERE id = $1 RETURNING *`,
      [payload.id, ...values]
    );
    
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating monitoreo config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM sat_monitoreo.monitoreo_config WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting monitoreo config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
