import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Función auxiliar para asegurar que la tabla existe
async function asegurarTabla() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sat_monitoreo.rabbit_alertas_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ambiente TEXT NOT NULL,
      nombre_cola TEXT NOT NULL,
      limite_mensajes INTEGER NOT NULL DEFAULT 100,
      esta_activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET() {
  try {
    await asegurarTabla();
    const result = await pool.query(
      'SELECT * FROM sat_monitoreo.rabbit_alertas_config ORDER BY creado_en DESC'
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching rabbit alerts config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await asegurarTabla();
    const payload = await req.json();
    const result = await pool.query(
      `INSERT INTO sat_monitoreo.rabbit_alertas_config (
        ambiente, nombre_cola, limite_mensajes, esta_activo
      ) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        payload.ambiente || 'V5-EC',
        payload.nombre_cola || '*',
        payload.limite_mensajes !== undefined ? Number(payload.limite_mensajes) : 100,
        payload.esta_activo !== false
      ]
    );
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating rabbit alert config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await asegurarTabla();
    const payload = await req.json();
    if (!payload.id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    const keys = Object.keys(payload).filter(k => k !== 'id');
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    const values = keys.map(k => payload[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    
    const result = await pool.query(
      `UPDATE sat_monitoreo.rabbit_alertas_config SET ${setClause} WHERE id = $1 RETURNING *`,
      [payload.id, ...values]
    );
    
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating rabbit alert config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await asegurarTabla();
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM sat_monitoreo.rabbit_alertas_config WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting rabbit alert config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
