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
          const isColombia = task.seq_url && task.seq_url.includes('logs-colombia.mysatcomla.com');
          let filterToSend = task.consulta;
          let clientSideLevelFilter: string | null = null;
          let clientSideLevelList: string[] | null = null;

          if (isColombia && task.consulta) {
            // Detectar filtros de nivel simple: @Level == 'Warning' o @Level = 'Warning'
            const levelPattern = /@Level\s*(==|=)\s*'([^']+)'/i;
            const match = task.consulta.match(levelPattern);
            if (match) {
              clientSideLevelFilter = match[2].toLowerCase();
              filterToSend = task.consulta.replace(levelPattern, '').trim();
            } else {
              // Detectar filtros IN: @Level in ['Warning', 'Error']
              const inPattern = /@Level\s+in\s+\[\s*([^\]]+)\s*\]/i;
              const inMatch = task.consulta.match(inPattern);
              if (inMatch) {
                clientSideLevelList = inMatch[1].split(',').map((l: string) => l.replace(/['"\s]/g, '').toLowerCase());
                filterToSend = task.consulta.replace(inPattern, '').trim();
              }
            }

            if (clientSideLevelFilter || clientSideLevelList) {
              // Limpiar operadores residuales
              filterToSend = filterToSend.replace(/\(\s*\)/g, '').trim();
              filterToSend = filterToSend.replace(/\band\s+and\b/gi, 'and').trim();
              filterToSend = filterToSend.replace(/^\s*and\s+/gi, '').replace(/\s+and\s*$/gi, '').trim();
              if (filterToSend === '') {
                filterToSend = null;
              }
            }
          }

          // Construir URL para consultar eventos en Seq
          // Seq API requiere /api/events para obtener eventos
          const targetUrl = new URL('/api/events', task.seq_url);
          if (filterToSend) {
            targetUrl.searchParams.append('filter', filterToSend);
          }
          // Si es Colombia, pedir más eventos para compensar el filtrado en memoria
          const countLimit = isColombia && (clientSideLevelFilter || clientSideLevelList) ? '250' : '50';
          targetUrl.searchParams.append('count', countLimit);

          const headers: HeadersInit = {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
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
          let events = data.Events || [];

          // Filtrar en memoria si es Colombia
          if (isColombia && (clientSideLevelFilter || clientSideLevelList)) {
            events = events.filter((event: any) => {
              const eventLevel = (event.Level || '').toLowerCase();
              if (clientSideLevelFilter) {
                return eventLevel === clientSideLevelFilter;
              }
              if (clientSideLevelList) {
                return clientSideLevelList.includes(eventLevel);
              }
              return true;
            });
            // Mantener el límite esperado
            events = events.slice(0, 50);
          }

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
