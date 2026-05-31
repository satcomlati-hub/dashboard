import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Obtener todas las conexiones de Seq
export async function GET() {
  try {
    // Asegurar que las columnas usuario y clave existan en la base de datos (Migración integrada)
    await query(`
      ALTER TABLE sat_monitoreo.seq_conexiones 
      ADD COLUMN IF NOT EXISTS usuario TEXT,
      ADD COLUMN IF NOT EXISTS clave TEXT;
    `);

    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const { rows } = await query(
      'SELECT id, nombre, url, api_key, usuario, clave FROM sat_monitoreo.seq_conexiones ORDER BY creado_en ASC'
    );

    const mapped = rows.map((item: any) => {
      const conn: any = {
        id: item.id,
        name: item.nombre,
        url: item.url,
        apiKey: item.api_key
      };

      // Retornar usuario y clave únicamente a los administradores
      if (isAdmin) {
        conn.usuario = item.usuario;
        conn.clave = item.clave;
      }

      return conn;
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error al obtener conexiones:', error);
    return NextResponse.json(
      { error: 'Error al obtener conexiones', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar una conexión de Seq
export async function POST(request: Request) {
  try {
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const body = await request.json();
    const { id, name, url, apiKey, usuario, clave } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: name y url son obligatorios.' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      // Actualizar conexión existente
      result = await query(
        `UPDATE sat_monitoreo.seq_conexiones 
         SET nombre = $1, url = $2, api_key = $3, usuario = $4, clave = $5, actualizado_en = NOW() 
         WHERE id = $6 
         RETURNING id, nombre, url, api_key, usuario, clave`,
        [name, url, apiKey || null, usuario || null, clave || null, id]
      );
    } else {
      // Insertar nueva conexión
      result = await query(
        `INSERT INTO sat_monitoreo.seq_conexiones (nombre, url, api_key, usuario, clave) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, nombre, url, api_key, usuario, clave`,
        [name, url, apiKey || null, usuario || null, clave || null]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'No se pudo guardar la conexión.' },
        { status: 404 }
      );
    }

    const responseData: any = {
      id: row.id,
      name: row.nombre,
      url: row.url,
      apiKey: row.api_key
    };

    // Retornar usuario y clave guardados en la respuesta solo si es administrador
    if (isAdmin) {
      responseData.usuario = row.usuario;
      responseData.clave = row.clave;
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error al guardar conexión:', error);
    return NextResponse.json(
      { error: 'Error al guardar conexión', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una conexión
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

    await query('DELETE FROM sat_monitoreo.seq_conexiones WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar conexión:', error);
    return NextResponse.json(
      { error: 'Error al eliminar conexión', details: error.message },
      { status: 500 }
    );
  }
}
