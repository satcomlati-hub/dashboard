import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Obtener todas las tareas de monitoreo de Seq
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, nombre, seq_url, api_key, consulta, intervalo_segundos, 
              condicion, condicion_valor, accion_tipo, accion_webhook_url, 
              ultima_ejecucion, creado_en 
       FROM sat_monitoreo.seq_tareas 
       ORDER BY creado_en DESC`
    );

    const mapped = rows.map((item: any) => ({
      id: item.id,
      name: item.nombre,
      seqUrl: item.seq_url,
      apiKey: item.api_key,
      query: item.consulta,
      intervalSeconds: item.intervalo_segundos,
      condition: item.condicion,
      conditionValue: item.condicion_valor,
      actionType: item.accion_tipo,
      actionWebhookUrl: item.accion_webhook_url,
      lastRun: item.ultima_ejecucion ? new Date(item.ultima_ejecucion).getTime() : null,
      createdAt: item.creado_en
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error al obtener tareas de Seq:', error);
    return NextResponse.json(
      { error: 'Error al obtener tareas', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar una tarea
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      seqUrl,
      apiKey,
      query: queryText,
      intervalSeconds,
      condition,
      conditionValue,
      actionType,
      actionWebhookUrl
    } = body;

    if (!name || !seqUrl || !intervalSeconds || !condition || !actionType) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: name, seqUrl, intervalSeconds, condition y actionType son obligatorios.' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      // Actualizar tarea existente
      result = await query(
        `UPDATE sat_monitoreo.seq_tareas 
         SET nombre = $1, seq_url = $2, api_key = $3, consulta = $4, 
             intervalo_segundos = $5, condicion = $6, condicion_valor = $7, 
             accion_tipo = $8, accion_webhook_url = $9, actualizado_en = NOW() 
         WHERE id = $10 
         RETURNING *`,
        [
          name,
          seqUrl,
          apiKey || null,
          queryText || null,
          parseInt(intervalSeconds, 10),
          condition,
          conditionValue || null,
          actionType,
          actionWebhookUrl || null,
          id
        ]
      );
    } else {
      // Insertar nueva tarea
      result = await query(
        `INSERT INTO sat_monitoreo.seq_tareas (
          nombre, seq_url, api_key, consulta, intervalo_segundos, 
          condicion, condicion_valor, accion_tipo, accion_webhook_url
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          name,
          seqUrl,
          apiKey || null,
          queryText || null,
          parseInt(intervalSeconds, 10),
          condition,
          conditionValue || null,
          actionType,
          actionWebhookUrl || null
        ]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'No se pudo guardar la tarea.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: row.id,
      name: row.nombre,
      seqUrl: row.seq_url,
      apiKey: row.api_key,
      query: row.consulta,
      intervalSeconds: row.intervalo_segundos,
      condition: row.condicion,
      conditionValue: row.condicion_valor,
      actionType: row.accion_tipo,
      actionWebhookUrl: row.accion_webhook_url,
      lastRun: row.ultima_ejecucion ? new Date(row.ultima_ejecucion).getTime() : null,
      createdAt: row.creado_en
    });
  } catch (error: any) {
    console.error('Error al guardar tarea de Seq:', error);
    return NextResponse.json(
      { error: 'Error al guardar tarea', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una tarea
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

    await query('DELETE FROM sat_monitoreo.seq_tareas WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al eliminar tarea de Seq:', error);
    return NextResponse.json(
      { error: 'Error al eliminar tarea', details: error.message },
      { status: 500 }
    );
  }
}
