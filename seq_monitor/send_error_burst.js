/**
 * ==========================================================================
 * Inyector de Errores de Prueba para Seq (Node.js)
 * ==========================================================================
 */

const SEQ_URL = process.env.SEQ_URL || 'http://localhost:5341';
const INGEST_URL = `${SEQ_URL}/api/events/raw`;

const ERRORS = [
  {
    Level: 'Error',
    MessageTemplate: 'Fallo al consultar la tabla de auditoría en Supabase. Error: {ErrorMessage}',
    Exception: 'PostgrestException: 42P01: relation "public.monitoreo_ejecuciones" does not exist\n   at SupabaseClient.PostgrestFilterBuilder.GetAsync() in C:\\src\\Supabase\\Postgrest.cs:line 89\n   at SatcomLA.Dashboard.Services.AuditService.GetRecentLogsAsync() in C:\\src\\Services\\AuditService.cs:line 34',
    Properties: {
      App: 'Dashboard_Backend',
      Environment: 'Production',
      Table: 'public.monitoreo_ejecuciones',
      ErrorMessage: 'Relation not found',
      DatabaseUrl: 'https://wpzfbpvtxrfyejoqjecu.supabase.co'
    }
  },
  {
    Level: 'Error',
    MessageTemplate: 'Límite de peticiones de API excedido para el departamento {Department} en Zoho Desk',
    Exception: 'ZohoDeskApiException: Code: LimitExceeded, Message: Daily API limit of 10000 requests exceeded.\n   at ZohoDesk.Api.Client.SendRequestAsync(HttpRequestMessage request) in C:\\src\\Zoho\\Client.cs:line 210\n   at ZohoDesk.Api.Client.GetTicketsAsync() in C:\\src\\Zoho\\Client.cs:line 85',
    Properties: {
      App: 'Zoho_Desk_Bridge',
      Environment: 'Production',
      Department: 'SatcomLA',
      LimitValue: 10000,
      ResetTime: '2026-05-21T00:00:00Z'
    }
  },
  {
    Level: 'Fatal',
    MessageTemplate: 'Imposible conectar con la base de datos Redis. Operación abortada.',
    Exception: 'RedisConnectionException: No connection is available to service this operation: redis-17553.c16.us-east-1-3.ec2.cloud.redislabs.com:17553\n   at StackExchange.Redis.ConnectionMultiplexer.ExecuteSyncImpl[T](Message message, ResultProcessor`1 processor, ServerEndPoint server) in C:\\src\\Redis\\ConnectionMultiplexer.cs:line 1200\n   at StackExchange.Redis.RedisDatabase.KeyExists(RedisKey key, CommandFlags flags) in C:\\src\\Redis\\RedisDatabase.cs:line 345',
    Properties: {
      App: 'Cache_Service',
      Environment: 'Production',
      RedisHost: 'redis-17553.c16.us-east-1-3.ec2.cloud.redislabs.com',
      Port: 17553,
      TimeoutMilliseconds: 5000
    }
  },
  {
    Level: 'Error',
    MessageTemplate: 'Timeout en la ejecución del sub-workflow {WorkflowName} (ID: {WorkflowId}) en n8n',
    Exception: 'N8nWorkflowTimeoutException: Workflow execution timeout after 60000ms. Max runtime exceeded.\n   at n8n.WorkflowExecutor.RunAsync(Workflow workflow) in /usr/src/app/packages/cli/dist/WorkflowExecutor.js:line 454\n   at n8n.ActiveExecutions.TimeoutWatcher() in /usr/src/app/packages/cli/dist/ActiveExecutions.js:line 78',
    Properties: {
      App: 'n8n_Primary_Cloud',
      Environment: 'Production',
      WorkflowName: 'RAG_Flow_v5.3_corregido',
      WorkflowId: 'wf_rag_998',
      TimeoutValue: '60s'
    }
  }
];

async function sendError(errorEvent) {
  const event = {
    Timestamp: new Date().toISOString(),
    Level: errorEvent.Level,
    MessageTemplate: errorEvent.MessageTemplate,
    Properties: {
      ...errorEvent.Properties,
      MachineName: 'PC-JESUS-TEST',
      SimulatedError: true
    }
  };

  if (errorEvent.Exception) {
    event.Exception = errorEvent.Exception;
  }

  try {
    const response = await fetch(`${SEQ_URL}/api/events/raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Events: [event] })
    });

    if (response.ok) {
      console.log(`[✔] Error enviado (${event.Level}): ${event.MessageTemplate}`);
    } else {
      console.error(`[✘] Error al enviar (${response.status}): ${await response.text()}`);
    }
  } catch (err) {
    console.error(`[✘] Error de red al enviar a Seq: ${err.message}`);
  }
}

async function main() {
  console.log(`Enviando ráfaga de 4 errores críticos de prueba a Seq...`);
  for (const err of ERRORS) {
    await sendError(err);
    await new Promise(r => setTimeout(r, 200)); // Retardo para mantener timestamps distintos
  }
  console.log(`¡Ráfaga finalizada!`);
}

main();
