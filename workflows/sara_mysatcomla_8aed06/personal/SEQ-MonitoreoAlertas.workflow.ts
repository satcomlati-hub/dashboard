import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SEQ - MonitoreoAlertas
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Cada1Minuto                      scheduleTrigger
// ConsultarReglasPorConexion       postgres                   [creds]
// EvaluarAlertaSeq                 code
// GuardarEventoSeq                 executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Cada1Minuto
//   → ConsultarReglasPorConexion
//     → EvaluarAlertaSeq  (undefined si no hay alertas → ítem filtrado automáticamente)
//       → GuardarEventoSeq
// </workflow-map>

@workflow({
    id: '7YLGLXOvFvyqkEpt',
    name: 'SEQ - MonitoreoAlertas',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class SeqMonitoreoAlertasWorkflow {

    // =====================================================================
    // NODO 1: Trigger cada 1 minuto
    // =====================================================================

    @node({
        id: 'a1b2c3d4-0001-0001-0001-000000000001',
        name: 'Cada 1 Minuto',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, -400],
    })
    Cada1Minuto = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 1,
                },
            ],
        },
    };

    // =====================================================================
    // NODO 2: JOIN de reglas activas × conexiones SEQ
    // Produce una fila por cada par (regla, conexión) a evaluar
    // =====================================================================

    @node({
        id: 'a1b2c3d4-0002-0002-0002-000000000002',
        name: 'Consultar Reglas Por Conexion',
        type: 'n8n-nodes-base.postgres',
        version: 2.3,
        position: [260, -400],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
    })
    ConsultarReglasPorConexion = {
        operation: 'executeQuery',
        schema: { mode: 'list', value: 'public' },
        table: { mode: 'list', value: '' },
        query: `SELECT
  r.id          AS regla_id,
  r.nombre      AS regla_nombre,
  r.query_filter,
  r.umbrales,
  c.id          AS conexion_id,
  c.nombre      AS conexion_nombre,
  c.url         AS conexion_url,
  c.api_key     AS conexion_api_key
FROM sat_monitoreo.seq_alertas_config r
JOIN sat_monitoreo.seq_conexiones c ON (
  r.conexiones_ids IS NULL
  OR r.conexiones_ids = '{}'
  OR c.id = ANY(r.conexiones_ids)
)
WHERE r.es_activo = true
ORDER BY r.nombre, c.nombre;`,
        options: {},
    };

    // =====================================================================
    // NODO 3: Por cada par (regla × conexión):
    //   1. Hace fetch a la API de Seq usando el query_filter configurado
    //   2. Evalúa los umbrales leídos desde el campo `umbrales` en BD
    //   3. Genera el JSON estructurado de notificaciones
    //   4. Devuelve undefined si no hay alertas (ítem filtrado automáticamente)
    //
    // Estructura esperada en `umbrales` (JSONB en seq_alertas_config):
    //   {
    //     "includeApp": true,              // incluir App en agrupación servidor
    //     "includeCliente": true,          // incluir Cliente en agrupación cliente
    //     "timeWindowMinutes": 1,          // ventana de evaluación en minutos
    //     "clientEventsThreshold": 5,      // umbral para alerta de mesa de ayuda
    //     "serverEventsThreshold": 30,     // eventos de servidor para alerta infraestructura
    //     "serverClientsThreshold": 1      // clientes mínimos con errores de servidor para disparar alerta
    //   }
    // =====================================================================

    @node({
        id: 'a1b2c3d4-0003-0003-0003-000000000003',
        name: 'Evaluar Alerta Seq',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, -400],
    })
    EvaluarAlertaSeq = {
        mode: 'runOnceForEachItem',
        jsCode: `
// =================================================================
// CONTEXTO: una fila de (regla × conexión) desde Postgres
// =================================================================
const ctx            = $input.item.json;
const reglaId        = String(ctx.regla_id       || '');
const reglaNombre    = String(ctx.regla_nombre    || '');
const filter         = String(ctx.query_filter    || '');
const conexionId     = String(ctx.conexion_id     || '');
const conexionNombre = String(ctx.conexion_nombre || '');
const conexionUrl    = String(ctx.conexion_url    || '').replace(/\\/+$/, '');
const apiKey         = String(ctx.conexion_api_key || '');

// --- Leer umbrales desde BD (con defaults seguros) ---------------
const umbrales     = ctx.umbrales || {};
const INCLUDE_APP  = umbrales.includeApp    !== false;  // default: true
const INCLUDE_CLI  = umbrales.includeCliente !== false; // default: true
const VENTANA      = Number(umbrales.timeWindowMinutes)      || 1;
const UMBRAL_CLI   = Number(umbrales.clientEventsThreshold)  || 5;
const UMBRAL_SRV   = Number(umbrales.serverEventsThreshold)  || 30;
const UMBRAL_SRV_C = Number(umbrales.serverClientsThreshold) || 1;

// =================================================================
// PASO 1: Consultar la API de Seq
// =================================================================
let events = [];
try {
  const seqUrl = \`\${conexionUrl}/api/events?filter=\${encodeURIComponent(filter)}&count=1000&render=true\`;
  const headers = apiKey ? { 'X-Seq-ApiKey': apiKey } : {};
  const res = await fetch(seqUrl, { headers });
  if (!res.ok) return []; // Error HTTP → sin alerta
  const data = await res.json();
  if      (Array.isArray(data))         events = data;
  else if (Array.isArray(data.Events))  events = data.Events;
  else if (Array.isArray(data.Items))   events = data.Items;
} catch (_e) {
  return []; // Error de red → sin alerta
}
if (!events.length) return []; // Sin eventos → sin alerta

// =================================================================
// PASO 2: Normalizar eventos (soporta Seq REST API v1 y CLEF)
// =================================================================
const logs = events.map(e => {
  const props = (e.Properties && typeof e.Properties === 'object' && !Array.isArray(e.Properties))
    ? e.Properties : {};
  return {
    id:        e.Id        || e['@Id']              || '',
    timestamp: e.Timestamp || e['@Timestamp']       || '',
    level:     e.Level     || e['@Level']            || 'Information',
    message:   e.RenderedMessage || e.MessageTemplate || e['@RenderedMessage'] || e['@MessageTemplate'] || '',
    exception: e.Exception || e['@Exception']       || '',
    hostname:  props.Hostname  || props._hostname  || props.hostname  || 'Desconocido',
    cliente:   props.Cliente   || props._cliente   || props.cliente   || 'Desconocido',
    app:       props.App       || props._app       || props.app       || '',
    ...props,
  };
});

// =================================================================
// PASO 3: Funciones auxiliares
// =================================================================
function stringify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val); } catch (_) { return String(val); }
}

function getGenericMessage(msg, exc) {
  let clean = stringify(msg);
  if (exc) {
    const firstLine = stringify(exc).split('\\n')[0].trim();
    if (firstLine) clean = firstLine;
  }
  
  // Limpiar prefijo común del tipo de excepción si existe (ej. "System.ArgumentException: ...")
  const exceptionPrefixMatch = clean.match(/^[a-zA-Z0-9\\._]+Exception:\\s*(.+)$/);
  if (exceptionPrefixMatch && exceptionPrefixMatch[1]) {
    clean = exceptionPrefixMatch[1].trim();
  }

  return clean
    .replace(/FLIP-[A-Za-z0-9+\\[\\]=-]+/g, 'FLIP-[ARCHIVO]')
    .replace(/\\b\\d{6,}\\b/g, '[ID]')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[GUID]')
    .replace(/https?:\\/\\/[^\\s'"]+/g, '[URL]')
    .substring(0, 150)
    .trim();
}

function buildSeqQuery(filterStr, cliente, hostname) {
  const parts = [];
  if (filterStr) parts.push(\`(\${filterStr})\`);
  if (INCLUDE_CLI && cliente !== 'Desconocido') parts.push(\`(Cliente = '\${cliente}' or _cliente = '\${cliente}')\`);
  if (INCLUDE_APP && hostname !== 'Desconocido') parts.push(\`(Hostname = '\${hostname}' or _hostname = '\${hostname}')\`);
  return parts.join(' and ');
}

const DOMINIOS_CLOUD = [
  'api-colombia.mysatcomla.com',
  'webapi.mysatcomla.com',
  'api-app-prod.mysatcomla.com',
];

// =================================================================
// PASO 4: Clasificar y agrupar eventos por cliente/servidor
// =================================================================
const clientGroups = {};
const serverGroups = {};
let totalErrores = 0, errCliCount = 0, errSrvCount = 0;
let minMs = Infinity, maxMs = -Infinity, minTs = null, maxTs = null;

for (const log of logs) {
  const message   = stringify(log.message);
  const exception = stringify(log.exception);
  const hostname  = log.hostname;
  const cliente   = log.cliente;
  const eventId   = log.id;

  if (log.timestamp) {
    const ms = Date.parse(log.timestamp);
    if (!isNaN(ms)) {
      if (ms < minMs) { minMs = ms; minTs = log.timestamp; }
      if (ms > maxMs) { maxMs = ms; maxTs = log.timestamp; }
    }
  }

  let statusCode = null;
  const scMatch = exception.match(/"StatusCode"\\s*:\\s*(\\d+)/) || exception.match(/StatusCode=(\\d+)/);
  if (scMatch) statusCode = parseInt(scMatch[1]);

  let destino = 'Desconocido';
  const urlMatch =
    exception.match(/RequestUri[\\\\":=\\s]+(https?:\\/\\/[^\\s'",)]+)/) ||
    exception.match(/"RequestUri"\\s*:\\s*"([^"]+)"/) ||
    message.match(/(https?:\\/\\/[^\\s'"]+)/);
  if (urlMatch) destino = urlMatch[1];

  // Configuración de infraestructura
  const INFRA_CLIENTES = ['HostingSAT', 'PAC', 'Panama', 'BOLIVIA', 'Panama2', 'HostingV5', 'aws.colombia'];
  const INFRA_URLS = ['https://webapi.mysatcomla.com', 'https://api-app-prod.mysatcomla.com'];

  const esClienteInfra = INFRA_CLIENTES.some(c => c.toLowerCase() === cliente.toLowerCase());
  const contieneUrlInfra = INFRA_URLS.some(url => message.toLowerCase().includes(url.toLowerCase()) || exception.toLowerCase().includes(url.toLowerCase()) || destino.toLowerCase().includes(url.toLowerCase()));
  const esInfraestructura = esClienteInfra || contieneUrlInfra;

  // Clasificar error
  let isClient = false, isServer = false;

  if (esInfraestructura) {
    isServer = true;
  } else {
    if (statusCode) {
      if      (statusCode >= 400 && statusCode < 500) isClient = true;
      else if (statusCode >= 500)                      isServer = true;
    } else {
      const ml = message.toLowerCase();
      const el = exception.toLowerCase();
      if      (el.includes('timeout')        || ml.includes('timeout')        || ml.includes('tiempo de espera')) isServer = true;
      else if (el.includes('connectfailure') || el.includes('httprequestexception') || ml.includes('failed to connect')) isServer = true;
      else if (el.includes('conexi')        || ml.includes('conexión'))        isServer = true;
      else if (el.includes('bad request')   || ml.includes('bad request'))     isClient = true;
      else if (el.includes('not found')     || ml.includes('not found'))       isClient = true;
    }
    /*
    if (isServer && !DOMINIOS_CLOUD.some(d => destino.toLowerCase().includes(d))) {
      isClient = true; isServer = false;
    }
    */
  }

  totalErrores++;

  const seqPermalink = eventId
    ? `https://dashboard-one-ivory-58.vercel.app/seq-monitor?Id=\${eventId}&Origen=\${conexionNombre}`
    : '';

  const payloadEjemplo = {
    timestamp:      log.timestamp || new Date().toISOString(),
    mensajeError:   message,
    excepcion:      exception.substring(0, 500),
    destino,
    hostname,
    cliente,
    origenConsulta: \`Seq | Origen: \${conexionNombre} | Regla: \${reglaNombre}\`,
    seqQuery:       buildSeqQuery(filter, cliente, hostname),
    seqPermalink,
  };

  const genericMsg = getGenericMessage(message, exception);

  if (isClient && INCLUDE_CLI) {
    errCliCount++;
    const k = \`\${cliente} | \${hostname}\`;
    if (!clientGroups[k]) clientGroups[k] = { cliente, hostname, eventos: 0, errores: {} };
    clientGroups[k].eventos++;
    if (!clientGroups[k].errores[genericMsg]) clientGroups[k].errores[genericMsg] = { cantidad: 0, ejemplo: payloadEjemplo };
    clientGroups[k].errores[genericMsg].cantidad++;
  }
  if (isServer && INCLUDE_APP) {
    errSrvCount++;
    const k = cliente;
    if (!serverGroups[k]) serverGroups[k] = { cliente, hostname, eventos: 0, errores: {} };
    serverGroups[k].eventos++;
    if (!serverGroups[k].errores[genericMsg]) serverGroups[k].errores[genericMsg] = { cantidad: 0, ejemplo: payloadEjemplo };
    serverGroups[k].errores[genericMsg].cantidad++;
  }
}

// =================================================================
// PASO 5: Evaluar umbrales y construir alertas
// =================================================================
const alertasMesaDeAyuda = Object.values(clientGroups)
  .filter(g => g.eventos >= UMBRAL_CLI)
  .map(g => ({
    origen:           \`\${g.cliente} / \${g.hostname}\`,
    totalEventos:     g.eventos,
    erroresAgrupados: Object.entries(g.errores).map(([msg, data]) => ({
      errorGenerico: msg,
      cantidad:      data.cantidad,
      ejemplo:       data.ejemplo,
    })),
    mensaje: \`Alerta Mesa de Ayuda: \${g.cliente} en \${g.hostname} — \${g.eventos} errores en los últimos \${VENTANA} min.\`,
  }));

const alertasInfraestructura = {
  triggered:         false,
  clientesAfectados: [],
  erroresAgrupados:  [],
  mensaje:           '',
};
const criticos = Object.values(serverGroups).filter(g => g.eventos >= UMBRAL_SRV);
if (criticos.length >= UMBRAL_SRV_C) {
  alertasInfraestructura.triggered         = true;
  alertasInfraestructura.clientesAfectados = criticos.map(g => g.cliente);
  for (const g of criticos) {
    for (const [msg, data] of Object.entries(g.errores)) {
      alertasInfraestructura.erroresAgrupados.push({
        origen:        \`\${g.cliente} / \${g.hostname}\`,
        errorGenerico: msg,
        cantidad:      data.cantidad,
        ejemplo:       data.ejemplo,
      });
    }
  }
  alertasInfraestructura.mensaje = \`Alerta Infraestructura: posible falla del Servidor de APIs. \${criticos.length} clientes con más de \${UMBRAL_SRV} errores cada uno.\`;
}

if (!alertasMesaDeAyuda.length && !alertasInfraestructura.triggered) return [];

// =================================================================
// PASO 6: Generar JSON de notificaciones
// =================================================================
const rangoHorario = (minTs && maxTs) ? \`\${minTs} a \${maxTs}\` : 'No disponible';
const tipoAlerta   = alertasInfraestructura.triggered ? 'INFRAESTRUCTURA' : 'MESA_DE_AYUDA';
const now          = new Date();

return [
  {
    json: {
      reglaId,
      reglaNombre,
      conexionId,
      conexionNombre,
      conexionUrl,
      consultaEvaluada:    filter,
      alertaGenerada:      true,
      tipoAlerta,
      fechaEvaluacion:     now.toISOString(),
      resumen: {
        totalErroresEvaluados:    totalErrores,
        totalErroresCliente:      errCliCount,
        totalErroresServidor:     errSrvCount,
        ventanaEvaluacionMinutos: VENTANA,
        alertaClienteCritico:     alertasMesaDeAyuda.length > 0,
        alertaServidorGlobal:     alertasInfraestructura.triggered,
        rangoHorario,
      },
      alertasMesaDeAyuda,
      alertasInfraestructura,
      notificacion: {
        clave:        `SEQ:\${reglaNombre}|CONN:\${conexionNombre}|TIPO:\${tipoAlerta}|P:\${now.toISOString().split('T')[0]}`,
        titulo:       `ALERTA SEQ | \${conexionNombre} | \${reglaNombre}`,
        mensaje:      alertasInfraestructura.triggered
                        ? alertasInfraestructura.mensaje
                        : (alertasMesaDeAyuda[0]?.mensaje || 'Alerta SEQ detectada'),
        totalEventos: totalErrores,
        rangoHorario,
      },
    },
  }
];
`,
    };

    // =====================================================================
    // NODO 4: Llamar sub-workflow existente para guardar y notificar
    // (se conectará en el próximo paso con la lógica de notificaciones)
    // =====================================================================

    @node({
        id: 'a1b2c3d4-0005-0005-0005-000000000005',
        name: 'Guardar Evento Seq',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.3,
        position: [780, -400],
    })
    GuardarEventoSeq = {
        workflowId: {
            __rl: true,
            value: 'EslvlrtfJOP0OawH',
            mode: 'list',
            cachedResultUrl: '/workflow/EslvlrtfJOP0OawH',
            cachedResultName: 'SUB Guarda Evento',
        },
        workflowInputs: {
            mappingMode: 'defineBelow',
            value: {
                // TODO: mapear campos cuando se agregue la lógica de notificaciones
                p_ambiente:       "={{ $json.conexionNombre }}",
                p_version:        "={{ 'v1' }}",
                p_pais:           "={{ 506 }}",
                p_evento:         "={{ $json.reglaNombre }}",
                p_detalle_evento: "={{ $json.notificacion.mensaje }}",
                p_reporta:        "={{ 'n8n-SEQ-MonitoreoAlertas' }}",
                p_fecha_evento:   "={{ $json.fechaEvaluacion }}",
                p_key:            "={{ $json.notificacion.clave }}",
                p_num_eventos:    "={{ $json.notificacion.totalEventos }}",
                p_mensaje:        "={{ $json.notificacion.titulo }}",
                estado:           "={{ 'activo' }}",
            },
            matchingColumns: [],
            schema: [
                { id: 'p_ambiente',       displayName: 'p_ambiente',       required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_version',        displayName: 'p_version',        required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_pais',           displayName: 'p_pais',           required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_evento',         displayName: 'p_evento',         required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_detalle_evento', displayName: 'p_detalle_evento', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_reporta',        displayName: 'p_reporta',        required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_fecha_evento',   displayName: 'p_fecha_evento',   required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_key',            displayName: 'p_key',            required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'p_num_eventos',    displayName: 'p_num_eventos',    required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' },
                { id: 'p_mensaje',        displayName: 'p_mensaje',        required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
                { id: 'estado',           displayName: 'estado',           required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
            ],
            attemptToConvertTypes: true,
            convertFieldsToString: true,
        },
        options: {},
    };

    // =====================================================================
    // CONEXIONES
    // =====================================================================

    @links()
    defineRouting() {
        this.Cada1Minuto.out(0).to(this.ConsultarReglasPorConexion.in(0));
        this.ConsultarReglasPorConexion.out(0).to(this.EvaluarAlertaSeq.in(0));
        this.EvaluarAlertaSeq.out(0).to(this.GuardarEventoSeq.in(0));
    }
}
