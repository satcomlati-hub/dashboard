import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Obtener todos los errores ignorados activos (no expirados)
export async function GET() {
  try {
    // Asegurar que exista la tabla sat_monitoreo.seq_errores_ignorados
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_errores_ignorados (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        patron          TEXT         NOT NULL UNIQUE,
        expira_en       TIMESTAMPTZ,
        opcion_tiempo   TEXT         NOT NULL, -- 'hoy', 'semana', 'mes', 'manual'
        creado_por      TEXT         DEFAULT 'sistema@mysatcomla.com',
        creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Limpiar automáticamente los registros expirados (opcional, pero limpio)
    // No eliminamos físicamente a menos que se quiera, o simplemente filtramos en la consulta.
    // Filtrar los que no han expirado aún
    const { rows } = await query(
      `SELECT id, patron, expira_en, opcion_tiempo, creado_por, creado_en 
       FROM sat_monitoreo.seq_errores_ignorados 
       WHERE expira_en IS NULL OR expira_en > NOW() 
       ORDER BY creado_en DESC`
    );

    const mapped = rows.map((item: any) => ({
      id: item.id,
      pattern: item.patron,
      expiresAt: item.expira_en,
      timeOption: item.opcion_tiempo,
      createdBy: item.creado_por,
      createdAt: item.creado_en
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error al obtener errores ignorados:', error);
    return NextResponse.json(
      { error: 'Error al obtener errores ignorados', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar un error ignorado
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email || 'anonimo@mysatcomla.com';

    // Asegurar que exista la tabla
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_errores_ignorados (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        patron          TEXT         NOT NULL UNIQUE,
        expira_en       TIMESTAMPTZ,
        opcion_tiempo   TEXT         NOT NULL,
        creado_por      TEXT         DEFAULT 'sistema@mysatcomla.com',
        creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    const body = await request.json();
    const { pattern, expiresAt, timeOption } = body;

    if (!pattern || !timeOption) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: pattern y timeOption son obligatorios.' },
        { status: 400 }
      );
    }

    // Insertar o actualizar si ya existe el mismo patrón
    const result = await query(
      `INSERT INTO sat_monitoreo.seq_errores_ignorados (patron, expira_en, opcion_tiempo, creado_por)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patron) 
       DO UPDATE SET expira_en = EXCLUDED.expira_en, opcion_tiempo = EXCLUDED.opcion_tiempo, creado_por = EXCLUDED.creado_por, creado_en = NOW()
       RETURNING *`,
      [pattern, expiresAt ? new Date(expiresAt) : null, timeOption, userEmail]
    );

    const row = result.rows[0];
    return NextResponse.json({
      id: row.id,
      pattern: row.patron,
      expiresAt: row.expira_en,
      timeOption: row.opcion_tiempo,
      createdBy: row.creado_por,
      createdAt: row.creado_en
    });
  } catch (error: any) {
    console.error('Error al guardar error ignorado:', error);
    return NextResponse.json(
      { error: 'Error al guardar error ignorado', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar un patrón de la lista de ignorados
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Falta el parámetro id' },
        { status: 400 }
      );
    }

    await query('DELETE FROM sat_monitoreo.seq_errores_ignorados WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar error ignorado:', error);
    return NextResponse.json(
      { error: 'Error al eliminar error ignorado', details: error.message },
      { status: 500 }
    );
  }
}
