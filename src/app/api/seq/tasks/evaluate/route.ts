import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Asegurar que exista la tabla de notificaciones
    await query(`
      CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_alertas_notificaciones (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tarea_id UUID REFERENCES sat_monitoreo.seq_tareas(id) ON DELETE CASCADE,
        mensaje TEXT NOT NULL,
        leido BOOLEAN DEFAULT false,
        creado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Obtener todas las tareas de monitoreo
    const { rows: tasks } = await query(
      `SELECT id, nombre, seq_url, api_key, consulta, intervalo_segundos, 
              condicion, condicion_valor, accion_tipo, accion_webhook_url, 
              ultima_ejecucion 
       FROM sat_monitoreo.seq_tareas`
    );

    const now = new Date();
    const results = [];

    for (const task of tasks) {
      const lastRunTime = task.ultima_ejecucion ? new Date(task.ultima_ejecucion).getTime() : 0;
      const secondsSinceLastRun = (now.getTime() - lastRunTime) / 1000;

      // Evaluar si corresponde ejecutar la tarea según el intervalo
      if (secondsSinceLastRun >= task.intervalo_segundos) {
        console.log(`Evaluando tarea Seq: ${task.nombre}`);
        
        // Actualizar la última ejecución primero para evitar duplicidad si tarda
        await query(
          'UPDATE sat_monitoreo.seq_tareas SET ultima_ejecucion = NOW() WHERE id = $1',
          [task.id]
        );

        try {
          // Construir URL para consultar eventos en Seq
          // Seq API requiere /api/events para obtener eventos
          const targetUrl = new URL('/api/events', task.seq_url);
          if (task.consulta) {
            targetUrl.searchParams.append('filter', task.consulta);
          }
          targetUrl.searchParams.append('count', '50'); // Límite razonable de control

          const headers: HeadersInit = {
            'Accept': 'application/json'
          };
          if (task.api_key && task.api_key.trim() !== '') {
            headers['X-Seq-ApiKey'] = task.api_key.trim();
          }

          const seqResponse = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers,
            // Timeout razonable
            signal: AbortSignal.timeout(10000)
          });

          if (!seqResponse.ok) {
            throw new Error(`Seq devolvió status ${seqResponse.status}`);
          }

          const data = await seqResponse.json();
          const events = data.Events || [];
          const count = events.length;

          // Evaluar la condición
          let conditionMet = false;
          const limitValue = parseInt(task.condicion_valor || '0', 10);

          if (task.condicion === 'is_empty') {
            conditionMet = count === 0;
          } else if (task.condicion === 'is_not_empty') {
            conditionMet = count > 0;
          } else if (task.condicion === 'count_greater_than') {
            conditionMet = count > limitValue;
          } else if (task.condicion === 'count_equal_to') {
            conditionMet = count === limitValue;
          }

          if (conditionMet) {
            console.log(`[Tarea Seq: ${task.nombre}] Condición cumplida. Acción: ${task.accion_tipo}`);
            
            if (task.accion_tipo === 'webhook' && task.accion_webhook_url) {
              // Enviar webhook
              try {
                await fetch(task.accion_webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    task: {
                      id: task.id,
                      name: task.nombre,
                      query: task.consulta,
                      condition: task.condicion,
                      conditionValue: task.condicion_valor
                    },
                    eventsCount: count,
                    events: events.slice(0, 5) // Enviar solo los primeros 5 eventos en el payload para no exceder límites
                  }),
                  signal: AbortSignal.timeout(5000)
                });
              } catch (webhookError: any) {
                console.error(`Error al disparar webhook para tarea ${task.nombre}:`, webhookError.message);
              }
            } else if (task.accion_tipo === 'notification') {
              // Guardar en tabla de alertas notificaciones
              const mensaje = `[Monitoreo Seq] Tarea "${task.nombre}" cumplió la condición (${count} resultados encontrados).`;
              await query(
                `INSERT INTO sat_monitoreo.seq_alertas_notificaciones (tarea_id, mensaje) 
                 VALUES ($1, $2)`,
                [task.id, mensaje]
              );
            }

            results.push({
              id: task.id,
              name: task.nombre,
              executed: true,
              conditionMet: true,
              eventsCount: count
            });
          } else {
            results.push({
              id: task.id,
              name: task.nombre,
              executed: true,
              conditionMet: false,
              eventsCount: count
            });
          }
        } catch (taskError: any) {
          console.error(`Error procesando tarea Seq "${task.nombre}":`, taskError.message);
          results.push({
            id: task.id,
            name: task.nombre,
            executed: true,
            error: taskError.message
          });
        }
      } else {
        results.push({
          id: task.id,
          name: task.nombre,
          executed: false,
          reason: `Faltan ${Math.round(task.intervalo_segundos - secondsSinceLastRun)} segundos`
        });
      }
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (error: any) {
    console.error('Error en evaluación de tareas Seq:', error);
    return NextResponse.json(
      { error: 'Error interno de evaluación', details: error.message },
      { status: 500 }
    );
  }
}

// Permitir GET también por comodidad en CRONs simples de curl
export async function GET(request: Request) {
  return POST(request);
}
