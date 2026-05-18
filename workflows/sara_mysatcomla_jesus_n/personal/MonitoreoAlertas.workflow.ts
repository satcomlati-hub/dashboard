import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : TIMER - MonitoreoAlertas
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Diario                             cron
// ConsultarConfiguraciones           postgres                   [creds]
// DesglosarAmbientes                 code
// Consultardatos                     httpRequest
// ObtenerReglasDetalladas            postgres                   [creds]
// Motoranalisis                      code
// Callsubguardaevento                executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Diario
//    → ConsultarConfiguraciones
//      → DesglosarAmbientes
//        → Consultardatos
//          → ObtenerReglasDetalladas
//            → Motoranalisis
//              → Callsubguardaevento
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'pcZJZpgQLLbbo5uj',
    name: 'TIMER - MonitoreoAlertas',
    active: true,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class TimerMonitoreoalertasWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '97623853-5c13-4b47-922c-9a9eb2332075',
        name: 'Diario',
        type: 'n8n-nodes-base.cron',
        version: 1,
        position: [-32, -448],
    })
    Diario = {
        triggerTimes: {
            item: [
                {
                    hour: 9,
                },
                {
                    hour: 15,
                },
            ],
        },
    };

    @node({
        id: '43df5bad-e67a-41c3-a1d1-5adb2a54c88a',
        name: 'Consultar Configuraciones',
        type: 'n8n-nodes-base.postgres',
        version: 2.3,
        position: [192, -448],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
    })
    ConsultarConfiguraciones = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: '',
        },
        query: "SELECT COALESCE(json_agg(t), '[]'::json) as configs FROM (SELECT * FROM sat_monitoreo.monitoreo_config WHERE esta_activo = true) t;",
        options: {},
    };

    @node({
        id: '97ac2e1a-5e22-479b-ace5-178469ed7f30',
        name: 'Desglosar Ambientes',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, -448],
    })
    DesglosarAmbientes = {
        jsCode: `const configs = $json.configs || [];
const mapAmbientes = {};

for (const config of configs) {
  const procesos = (config.proceso_sp || '').split(';').filter(p => p.trim());
  const ambientes = config.ambientes || [];
  const reglasIds = config.reglas_ids || [];

  for (const amb of ambientes) {
    if (!mapAmbientes[amb]) {
      mapAmbientes[amb] = {
        ambiente_actual: amb,
        procesos: new Set(),
        reglas_ids: new Set()
      };
    }
    procesos.forEach(p => mapAmbientes[amb].procesos.add(p));
    reglasIds.forEach(r => mapAmbientes[amb].reglas_ids.add(r));
  }
}

return Object.values(mapAmbientes).map(info => ({
  json: {
    ambiente_actual: info.ambiente_actual,
    proceso_sp: Array.from(info.procesos).join(';'),
    reglas_ids: Array.from(info.reglas_ids)
  }
}));`,
    };

    @node({
        id: '93de7e35-c946-4cb9-91be-5982829846c0',
        name: 'ConsultarDatos',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [640, -448],
    })
    Consultardatos = {
        url: 'https://sara.mysatcomla.com/webhook/GetData',
        sendQuery: true,
        specifyQuery: 'json',
        jsonQuery: `={
  "Ambiente": "{{ $('Desglosar Ambientes').item.json.ambiente_actual }}",
  "Proceso": "{{ $('Desglosar Ambientes').item.json.proceso_sp }}"
}`,
        options: {},
    };

    @node({
        id: '90278b8c-9a4d-445a-889f-d1d75ce0a2bb',
        name: 'Obtener Reglas Detalladas',
        type: 'n8n-nodes-base.postgres',
        version: 2.3,
        position: [864, -448],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
    })
    ObtenerReglasDetalladas = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: '',
        },
        query: "SELECT * FROM sat_monitoreo.reglas_alertas WHERE id IN ('{{ $('Desglosar Ambientes').item.json.reglas_ids.join(\"','\") }}');",
        options: {},
    };

    @node({
        id: 'a5522c79-a826-4323-b106-dc435f985b89',
        name: 'MotorAnalisis',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1088, -448],
    })
    Motoranalisis = {
        mode: 'runOnceForEachItem',
        jsCode: `// 1. Preparación de Datos (Ítem actual)
const regla = $input.item.json;
const contexto = $('Desglosar Ambientes').item.json;
let nodeOutput;

try {
  nodeOutput = $('ConsultarDatos').item.json;
} catch (e) {
  return; // Filtra el ítem si no hay datos vinculados
}

const rawData = nodeOutput.data || nodeOutput;
if (!rawData) return;

let data = [];
try {
  data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
} catch (e) {
  return; // Filtra si el JSON es inválido
}

if (!Array.isArray(data)) return;

// 2. Procesamiento de la Regla Actual
const targetAmb = String(contexto.ambiente_actual || '').trim().toUpperCase();

const matches = data.filter(item => {
  if (!item) return false;
  
  const itemAmbiente = String(item.Ambiente || item.ambiente || targetAmb).trim().toUpperCase();
  if (itemAmbiente !== targetAmb) return false;

  const expEstado = (regla.expresion_estado || '').trim();
  const expMotivo = (regla.expresion_motivo || '').trim();

  const estadoMatch = !expEstado || new RegExp(expEstado, 'i').test(item.DescripcionEstatus || '');
  const fullItemText = JSON.stringify(item);
  const motivoMatch = !expMotivo || new RegExp(expMotivo, 'i').test(fullItemText);
  
  return estadoMatch && motivoMatch;
});

// 3. Validación de Umbral
const minEventos = Number(regla.minimo_eventos || 1);
if (matches.length < minEventos) return; // No generamos alerta si no llegamos al mínimo

// 4. Consolidación de Incidencias
const summary = {
  total: matches.length,
  afectaciones: {}, 
  ids: [],
  paises: new Set()
};

matches.forEach(item => {
  const pais = String(item.Pais || item.id_pais || '506');
  summary.paises.add(pais);
  const emisor = item.Emisor || item.emisor || 'N/A';
  const afKey = \`\${pais} | \${emisor} | \${item.Establecimiento || '000'}-\${item.Punto || '000'}\`;
  summary.afectaciones[afKey] = (summary.afectaciones[afKey] || 0) + 1;
  
  const idComp = item.IdComprobante || item.id_comprobante || item.id;
  if (idComp && summary.ids.length < 15) summary.ids.push(idComp);
});

// 5. Preparación de Payload (Retorno Directo)
const now = new Date();
const freq = (regla.frecuencia || 'DIARIO').toUpperCase();

let freqSuffix = now.toISOString().split('T')[0]; // Diario por defecto
if (freq === 'SEMANAL') {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  freqSuffix = d.getUTCFullYear() + '-W' + weekNo;
} else if (freq === 'MENSUAL') {
  freqSuffix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

const eKey = \`REGLA-TICKET:\${regla.nombre.trim()}|ENV:\${targetAmb}|FREQ:\${freq}|P:\${freqSuffix}\`;

const listaAfectacionesHtml = Object.entries(summary.afectaciones)
  .map(([af, c]) => \`<li><b>\${af}</b>: \${c} documentos</li>\`)
  .join('');

const htmlBody = \`
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; border: 1px solid #e1e4e8; border-radius: 12px; background-color: #ffffff;">
  <h2 style="color: #d93025; border-bottom: 2px solid #d93025; padding-bottom: 10px;">🚨 Alerta: \${regla.nombre}</h2>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 6px solid #d93025; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px; color: #5f6368;"><b>Ambiente:</b> \${targetAmb}</p>
    <p style="margin: 10px 0 0 0; font-size: 20px; color: #d93025;"><b>Total Afectados: \${summary.total}</b></p>
  </div>
  <h3 style="font-size: 16px; color: #202124;">🏢 Detalle de Afectaciones</h3>
  <ul style="font-size: 13px; color: #3c4043;">\${listaAfectacionesHtml}</ul>
  <h3 style="font-size: 16px; color: #202124;">🔍 Muestra de Comprobantes</h3>
  <div style="background-color: #202124; color: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; line-height: 1.5;">\${summary.ids.join('<br>')}</div>
</div>\`.trim();

// En modo "Run Once for Each Item", devolvemos el objeto directamente
return {
  p_ambiente: targetAmb,
  p_version: 'v1',
  p_pais: Number(Array.from(summary.paises)[0] || 506),
  p_evento: regla.nombre.trim(),
  p_detalle_evento: \`Detección de \${summary.total} incidencias.\`,
  p_reporta: 'n8n-MonitoreoAlertas',
  p_fecha_evento: now.toISOString(),
  p_key: eKey,
  p_num_eventos: summary.total,
  p_mensaje: \`ALERTA | \${targetAmb} | \${regla.nombre.trim()}\`,
  estado: 'activo',
  ticket_payload: {
    subject: \`ALERTA | \${targetAmb} | \${regla.nombre.trim()} (\${summary.total})\`,
    description: htmlBody,
    departmentId: "816030000000006907",
    contactId: "816030000053275791",
    channel: "Dashboard-Monitoreo",
    classification: "Incidencia en producción",
    priority: "Media",
    status: "Abierto",
    cf: {
      cf_existe_una_solucion_temporal_disponible_1: "No aplica",
      cf_area: "Soporte",
      cf_portal: targetAmb
    }
  }
};
`,
    };

    @node({
        id: '03cd6844-56ea-40a1-9c35-dbede64531de',
        name: 'CallSubGuardaEvento',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.3,
        position: [1296, -608],
    })
    Callsubguardaevento = {
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
                p_num_eventos: "={{ $('MotorAnalisis').item.json.p_num_eventos }}",
                p_ambiente: "={{ $('MotorAnalisis').item.json.p_ambiente }}",
                p_version: "={{ $('MotorAnalisis').item.json.p_version }}",
                p_pais: "={{ $('MotorAnalisis').item.json.p_pais }}",
                p_evento: '=Creación Caso Desk',
                p_detalle_evento: "={{ $('MotorAnalisis').item.json.p_detalle_evento }}",
                p_reporta: "={{ $('MotorAnalisis').item.json.p_reporta }}",
                p_fecha_evento: "={{ $('MotorAnalisis').item.json.p_fecha_evento }}",
                p_key: "={{ $('MotorAnalisis').item.json.p_key }}",
                p_mensaje: "={{ $('MotorAnalisis').item.json.p_mensaje }}",
                estado: "={{ $('MotorAnalisis').item.json.estado }}",
                ticket_payload: "={{ $('MotorAnalisis').item.json.ticket_payload }}",
            },
            matchingColumns: [],
            schema: [
                {
                    id: 'p_ambiente',
                    displayName: 'p_ambiente',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_version',
                    displayName: 'p_version',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_pais',
                    displayName: 'p_pais',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_evento',
                    displayName: 'p_evento',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_detalle_evento',
                    displayName: 'p_detalle_evento',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_reporta',
                    displayName: 'p_reporta',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_fecha_evento',
                    displayName: 'p_fecha_evento',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_key',
                    displayName: 'p_key',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'p_num_eventos',
                    displayName: 'p_num_eventos',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'number',
                },
                {
                    id: 'p_mensaje',
                    displayName: 'p_mensaje',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'estado',
                    displayName: 'estado',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                },
                {
                    id: 'ticket_payload',
                    displayName: 'ticket_payload',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    canBeUsedToMatch: true,
                    type: 'string',
                    removed: false,
                },
            ],
            attemptToConvertTypes: true,
            convertFieldsToString: true,
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Diario.out(0).to(this.ConsultarConfiguraciones.in(0));
        this.ConsultarConfiguraciones.out(0).to(this.DesglosarAmbientes.in(0));
        this.DesglosarAmbientes.out(0).to(this.Consultardatos.in(0));
        this.Consultardatos.out(0).to(this.ObtenerReglasDetalladas.in(0));
        this.ObtenerReglasDetalladas.out(0).to(this.Motoranalisis.in(0));
        this.Motoranalisis.out(0).to(this.Callsubguardaevento.in(0));
    }
}
