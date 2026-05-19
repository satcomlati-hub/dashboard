import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM sat_monitoreo.reglas_alertas ORDER BY creado_en DESC'
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching rules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await pool.query(
      `INSERT INTO sat_monitoreo.reglas_alertas (
        nombre, ambiente, expresion_estado, expresion_motivo, 
        minimo_eventos, modo, frecuencia, prioridad_ticket, 
        departamento_id, esta_activa, configuracion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        payload.nombre,
        payload.ambiente || 'Todos',
        payload.expresion_estado,
        payload.expresion_motivo,
        payload.minimo_eventos || 1,
        payload.modo || 'POR_EMISOR',
        payload.frecuencia || 'DIARIO',
        payload.prioridad_ticket || 'Media',
        payload.departamento_id || null,
        payload.esta_activa !== false,
        payload.configuracion || {}
      ]
    );
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating rule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload.id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    // Partial update based on keys provided
    const keys = Object.keys(payload).filter(k => k !== 'id');
    const values = keys.map(k => payload[k]);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    
    const result = await pool.query(
      `UPDATE sat_monitoreo.reglas_alertas SET ${setClause} WHERE id = $1 RETURNING *`,
      [payload.id, ...values]
    );
    
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating rule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM sat_monitoreo.reglas_alertas WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting rule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
