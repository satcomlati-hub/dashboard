import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Obtener todas las notificaciones pendientes (leido = false)
export async function GET() {
  try {
    // Asegurar que exista la tabla de notificaciones primero
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_alertas_notificaciones (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tarea_id UUID REFERENCES sat_monitoreo.seq_tareas(id) ON DELETE CASCADE,
        mensaje TEXT NOT NULL,
        leido BOOLEAN DEFAULT false,
        creado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const { rows } = await query(
      `SELECT id, tarea_id, mensaje, creado_en 
       FROM sat_monitoreo.seq_alertas_notificaciones 
       WHERE leido = false 
       ORDER BY creado_en DESC`
    );

    const mapped = rows.map((item: any) => ({
      id: item.id,
      taskId: item.tarea_id,
      message: item.mensaje,
      createdAt: item.creado_en
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error al obtener notificaciones de Seq:', error);
    return NextResponse.json(
      { error: 'Error al obtener notificaciones', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Marcar notificaciones como leídas
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ids } = body;

    let result;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Marcar una lista de IDs específicos
      result = await query(
        `UPDATE sat_monitoreo.seq_alertas_notificaciones 
         SET leido = true 
         WHERE id = ANY($1::uuid[]) 
         RETURNING id`,
        [ids]
      );
    } else {
      // Marcar todas como leídas
      result = await query(
        `UPDATE sat_monitoreo.seq_alertas_notificaciones 
         SET leido = true 
         WHERE leido = false 
         RETURNING id`
      );
    }

    return NextResponse.json({ success: true, count: result.rowCount });
  } catch (error: any) {
    console.error('Error al marcar notificaciones como leídas:', error);
    return NextResponse.json(
      { error: 'Error al marcar notificaciones como leídas', details: error.message },
      { status: 500 }
    );
  }
}
