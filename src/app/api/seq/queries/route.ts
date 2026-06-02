import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Obtener todas las consultas y alertas de SEQ centralizadas
export async function GET() {
  try {
    // Asegurar que exista la tabla sat_monitoreo.seq_alertas_config
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_alertas_config (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre          TEXT         NOT NULL,
        query_filter    TEXT         NOT NULL,
        conexiones_ids  UUID[]       DEFAULT NULL,
        umbrales        JSONB        NOT NULL DEFAULT '{
          "timeWindowMinutes": 1,
          "clientEventsThreshold": 5,
          "serverEventsThreshold": 30,
          "serverClientsThreshold": 1
        }',
        es_activo       BOOLEAN      NOT NULL DEFAULT true,
        creado_por      TEXT         DEFAULT 'sistema@mysatcomla.com',
        actualizado_por TEXT         DEFAULT 'sistema@mysatcomla.com',
        creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Asegurar que las columnas creado_por y actualizado_por existan
    await query(`
      ALTER TABLE sat_monitoreo.seq_alertas_config 
      ADD COLUMN IF NOT EXISTS creado_por TEXT DEFAULT 'sistema@mysatcomla.com',
      ADD COLUMN IF NOT EXISTS actualizado_por TEXT DEFAULT 'sistema@mysatcomla.com';
    `);

    const { rows } = await query(
      `SELECT id, nombre, query_filter, conexiones_ids, umbrales, es_activo, creado_por, actualizado_por, creado_en, actualizado_en 
       FROM sat_monitoreo.seq_alertas_config 
       ORDER BY creado_en DESC`
    );

    const mapped = rows.map((item: any) => ({
      id: item.id,
      name: item.nombre,
      filter: item.query_filter,
      conexionesIds: item.conexiones_ids || [],
      alertConfig: item.umbrales ? {
        timeWindowMinutes: item.umbrales.timeWindowMinutes ?? 10,
        clientEventsThreshold: item.umbrales.clientEventsThreshold ?? 30,
        serverEventsThreshold: item.umbrales.serverEventsThreshold ?? 30,
        serverClientsThreshold: item.umbrales.serverClientsThreshold ?? 3,
        includeVersion: item.umbrales.includeVersion ?? true,
        includeApp: item.umbrales.includeApp ?? true,
        includeHostname: item.umbrales.includeHostname ?? true,
        includeCliente: item.umbrales.includeCliente ?? true,
        isActive: item.es_activo
      } : undefined,
      createdBy: item.creado_por,
      updatedBy: item.actualizado_por,
      createdAt: item.creado_en,
      updatedAt: item.actualizado_en
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error al obtener consultas de Seq:', error);
    return NextResponse.json(
      { error: 'Error al obtener consultas', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar una consulta y alerta de SEQ
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email || 'anonimo@mysatcomla.com';

    // Asegurar que exista la tabla sat_monitoreo.seq_alertas_config
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_alertas_config (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre          TEXT         NOT NULL,
        query_filter    TEXT         NOT NULL,
        conexiones_ids  UUID[]       DEFAULT NULL,
        umbrales        JSONB        NOT NULL DEFAULT '{
          "timeWindowMinutes": 1,
          "clientEventsThreshold": 5,
          "serverEventsThreshold": 30,
          "serverClientsThreshold": 1
        }',
        es_activo       BOOLEAN      NOT NULL DEFAULT true,
        creado_por      TEXT         DEFAULT 'sistema@mysatcomla.com',
        actualizado_por TEXT         DEFAULT 'sistema@mysatcomla.com',
        creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    const body = await request.json();
    const {
      id,
      name,
      filter,
      conexionesIds,
      alertConfig
    } = body;

    if (!name || filter === undefined) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: name y filter son obligatorios.' },
        { status: 400 }
      );
    }

    const umbrales = alertConfig ? {
      timeWindowMinutes: parseInt(alertConfig.timeWindowMinutes, 10) || 10,
      clientEventsThreshold: parseInt(alertConfig.clientEventsThreshold, 10) || 30,
      serverEventsThreshold: parseInt(alertConfig.serverEventsThreshold, 10) || 30,
      serverClientsThreshold: parseInt(alertConfig.serverClientsThreshold, 10) || 3,
      includeVersion: !!alertConfig.includeVersion,
      includeApp: !!alertConfig.includeApp,
      includeHostname: !!alertConfig.includeHostname,
      includeCliente: !!alertConfig.includeCliente
    } : {
      timeWindowMinutes: 10,
      clientEventsThreshold: 30,
      serverEventsThreshold: 30,
      serverClientsThreshold: 3,
      includeVersion: true,
      includeApp: true,
      includeHostname: true,
      includeCliente: true
    };

    const isActive = alertConfig ? !!alertConfig.isActive : true;

    let result;
    if (id && id.startsWith('q-custom-') === false) {
      // Es una consulta guardada existente en la base de datos (con un UUID válido)
      result = await query(
        `UPDATE sat_monitoreo.seq_alertas_config 
         SET nombre = $1, query_filter = $2, conexiones_ids = $3, umbrales = $4, es_activo = $5, actualizado_por = $6, actualizado_en = NOW() 
         WHERE id = $7 
         RETURNING *`,
        [
          name,
          filter,
          conexionesIds && conexionesIds.length > 0 ? conexionesIds : null,
          JSON.stringify(umbrales),
          isActive,
          userEmail,
          id
        ]
      );
    } else {
      // Insertar nueva consulta/alerta
      result = await query(
        `INSERT INTO sat_monitoreo.seq_alertas_config (
          nombre, query_filter, conexiones_ids, umbrales, es_activo, creado_por, actualizado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          name,
          filter,
          conexionesIds && conexionesIds.length > 0 ? conexionesIds : null,
          JSON.stringify(umbrales),
          isActive,
          userEmail,
          userEmail
        ]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'No se pudo guardar la consulta.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: row.id,
      name: row.nombre,
      filter: row.query_filter,
      conexionesIds: row.conexiones_ids || [],
      alertConfig: row.umbrales ? {
        timeWindowMinutes: row.umbrales.timeWindowMinutes,
        clientEventsThreshold: row.umbrales.clientEventsThreshold,
        serverEventsThreshold: row.umbrales.serverEventsThreshold,
        serverClientsThreshold: row.umbrales.serverClientsThreshold,
        includeVersion: row.umbrales.includeVersion,
        includeApp: row.umbrales.includeApp,
        includeHostname: row.umbrales.includeHostname,
        includeCliente: row.umbrales.includeCliente,
        isActive: row.es_activo
      } : undefined,
      createdBy: row.creado_por,
      updatedBy: row.actualizado_por,
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en
    });
  } catch (error: any) {
    console.error('Error al guardar consulta de Seq:', error);
    return NextResponse.json(
      { error: 'Error al guardar consulta', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una consulta guardada / alerta
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

    await query('DELETE FROM sat_monitoreo.seq_alertas_config WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar consulta de Seq:', error);
    return NextResponse.json(
      { error: 'Error al eliminar consulta', details: error.message },
      { status: 500 }
    );
  }
}
