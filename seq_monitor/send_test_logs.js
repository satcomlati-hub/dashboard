/**
 * ==========================================================================
 * Generador de Logs de Prueba para Seq (Node.js)
 * ==========================================================================
 */

// Usamos fetch nativo si está disponible en Node 18+.


const SEQ_URL = process.env.SEQ_URL || 'http://localhost:5341';
const INGEST_URL = `${SEQ_URL}/api/events/raw`;

const APPS = ['RAG_Engine', 'SARA_Agent', 'Zoho_Desk_Bridge', 'Auth_Service', 'Database_Worker'];
const ENVIRONMENTS = ['Development', 'Staging', 'Production'];
const USERNAMES = ['jesus', 'pablo', 'soporte_satcom', 'analista_sri', 'invitado'];

// Mensajes de log ficticios
const TEMPLATES = [
  {
    level: 'Information',
    template: 'Usuario {Username} inició sesión correctamente desde {IpAddress}',
    getProps: () => ({ Username: getRandom(USERNAMES), IpAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}` })
  },
  {
    level: 'Warning',
    template: 'Tiempo de respuesta elevado en query de n8n: {Duration}ms. Límite sugerido {Threshold}ms',
    getProps: () => ({ Duration: Math.floor(Math.random() * 1200) + 400, Threshold: 500, WorkflowId: `wf-${Math.floor(Math.random()*10000)}` })
  },
  {
    level: 'Error',
    template: 'Error al procesar el ticket #{TicketId} de Zoho Desk en el bridge',
    exception: 'System.Net.Http.HttpRequestException: 401 Unauthorized\n   at ZohoDeskApi.Client.GetTicketAsync(Int32 ticketId) in C:\\src\\ZohoDeskApi\\Client.cs:line 120\n   at ZohoDeskBridge.Worker.ProcessTicketAsync(Int32 ticketId) in C:\\src\\ZohoDeskBridge\\Worker.cs:line 45',
    getProps: () => ({ TicketId: Math.floor(Math.random() * 90000) + 10000, ApiEndpoint: 'https://desk.zoho.com/api/v1/tickets' })
  },
  {
    level: 'Debug',
    template: 'Ingesta de PDF completada en RAG vector store. Archivo: {Filename}. Vectores creados: {VectorCount}',
    getProps: () => ({ Filename: `documento_sri_${Math.floor(Math.random()*10)}.pdf`, VectorCount: Math.floor(Math.random() * 300) + 50 })
  },
  {
    level: 'Fatal',
    template: 'Memoria insuficiente en el servicio de inferencia de RAG. El contenedor se reiniciará inmediatamente',
    exception: 'OutOfMemoryError: Java heap space\n   at OpenAiEmbeddingProvider.GenerateEmbeddings(String text) in C:\\src\\AiProviders\\OpenAi.cs:line 554',
    getProps: () => ({ HeapUsed: '4.04 GB', MaxHeap: '4.00 GB' })
  }
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function sendLog(event) {
  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Events: [event] })
    });

    if (response.ok) {
      console.log(`[✔] Log enviado (${event.Level}): ${event.MessageTemplate}`);
    } else {
      console.error(`[✘] Error al enviar log a Seq (${response.status}): ${await response.text()}`);
    }
  } catch (err) {
    console.error(`[✘] Error de conexión: Asegúrate de que Seq esté corriendo en ${SEQ_URL}. Detalle: ${err.message}`);
  }
}

function generateEvent() {
  const item = getRandom(TEMPLATES);
  const properties = item.getProps();
  
  // Agregar propiedades globales
  properties.App = getRandom(APPS);
  properties.Environment = getRandom(ENVIRONMENTS);
  properties.MachineName = 'PC-JESUS-TEST';

  const event = {
    Timestamp: new Date().toISOString(),
    Level: item.level,
    MessageTemplate: item.template,
    Properties: properties
  };

  if (item.exception) {
    event.Exception = item.exception;
  }

  return event;
}

// Envío único inicial de ráfaga
async function sendBurst(count = 10) {
  console.log(`Enviando ráfaga inicial de ${count} logs de prueba a Seq...`);
  for (let i = 0; i < count; i++) {
    await sendLog(generateEvent());
    // Pequeño retardo entre logs
    await new Promise(r => setTimeout(r, 100));
  }
}

// Iniciar simulación continua
async function main() {
  console.log(`==================================================`);
  console.log(`🚀 Simulador de Logs de Pruebas para Seq activo`);
  console.log(`   URL Ingesta: ${INGEST_URL}`);
  console.log(`   Se enviará un log cada 2.5 segundos.`);
  console.log(`   Presiona Ctrl+C para detener la simulación.`);
  console.log(`==================================================`);

  await sendBurst(8);

  setInterval(async () => {
    const event = generateEvent();
    await sendLog(event);
  }, 2500);
}

main();
