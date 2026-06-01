# Diseño de Monitoreo Continuo de Seq con n8n

Este documento detalla las especificaciones de consulta y lógica del script de procesamiento para automatizar el monitoreo de errores del sistema de facturación/comprobantes de Satcom en Seq.

---

## 1. Características de Análisis y Consulta

Para realizar una consulta eficiente a la API de Seq sin sobrecargar el servidor de logs, se recomienda realizar consultas filtradas por tiempo y nivel del log.

### Consulta SQL Propuesta para Seq
Seq permite ejecutar consultas de agregación y filtrado usando una sintaxis similar a SQL mediante su endpoint de consulta (`/api/data`).

```sql
select 
  @Timestamp as Timestamp, 
  @Message as Message, 
  @Exception as Exception, 
  Properties._hostname as Hostname, 
  Properties.cliente as Cliente, 
  Properties._app as App 
from stream 
where Level = 'Error' 
  and @Timestamp > @rangeStart 
limit 500
```

*   **Endpoint de API**: `GET /api/data?q=<URL_ENCODED_QUERY>`
*   **Parámetro Temporal**: El valor `@rangeStart` debe reemplazarse en n8n dinámicamente con la fecha y hora UTC calculada de hace N minutos (por ejemplo, 5 o 10 minutos atrás).
*   **Autenticación**: Se debe agregar la cabecera `X-Seq-ApiKey: <TU_API_KEY>` en el nodo HTTP Request de n8n.

---

## 2. Lógica de Clasificación de Errores

El procesamiento se divide entre errores originados por el cliente (integración o datos inválidos) y errores de infraestructura/servidor (caídas, timeouts o fallas generales de red).

### Clasificación
*   **Errores del Cliente**: Errores con código de estado HTTP 4xx (como `400 Bad Request`, `404 Not Found`). Indican que el servidor está arriba y responde, pero rechaza la petición por errores de formato o autenticación.
*   **Errores del Servidor**: Excepciones de tipo timeout (`TimeoutException`), fallas de socket/conexión (`ConnectFailure`, `HttpRequestException`), o códigos de error HTTP 5xx. Indican que el servidor destino no está disponible o presenta lentitud grave.

---

## 3. Script para el nodo 'Code' de n8n (JavaScript)

El siguiente script en JavaScript procesa la respuesta cruda de la API de Seq (soportando tanto el formato nativo de columnas/filas como objetos JSON planos), agrupa y clasifica los logs, y aplica las reglas de umbral especificadas.

```javascript
// Recuperar los elementos de entrada de n8n
const items = $input.all();

let logs = [];
if (items.length > 0) {
  const firstItem = items[0].json;
  // Soporte para formato nativo de Seq API /api/data (Columns/Rows)
  if (firstItem.Columns && firstItem.Rows) {
    const cols = firstItem.Columns;
    logs = firstItem.Rows.map(row => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } else {
    // Soporte para array de objetos JSON directos
    logs = items.map(item => item.json);
  }
}

// Estructuras de almacenamiento para agrupamiento
const clientGroups = {}; // Agrupado por: Cliente | Hostname
const serverGroups = {}; // Agrupado por: Cliente

let totalErrores = 0;
let erroresClienteCount = 0;
let erroresServidorCount = 0;

// 1. Procesar y clasificar cada log
logs.forEach(log => {
  const message = log.Message || '';
  const exception = log.Exception || '';
  const hostname = log.Hostname || log.hostname || 'Desconocido';
  const cliente = log.Cliente || log.cliente || 'Desconocido';
  
  // Extraer código de estado HTTP si existe en la excepción o mensaje
  let statusCode = null;
  const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                        exception.match(/StatusCode=(\d+)/) || 
                        message.match(/(\d{3})/);
  if (statusCodeMatch) {
    statusCode = parseInt(statusCodeMatch[1]);
  }

  let isClient = false;
  let isServer = false;
  let tipoError = 'Desconocido';

  // Clasificación por código HTTP
  if (statusCode) {
    if (statusCode >= 400 && statusCode < 500) {
      isClient = true;
      tipoError = `HTTP ${statusCode}`;
    } else if (statusCode >= 500) {
      isServer = true;
      tipoError = `HTTP ${statusCode}`;
    }
  }

  // Clasificación heurística por texto de excepción si no hay código HTTP explícito
  if (!isClient && !isServer) {
    const msgLower = message.toLowerCase();
    const excLower = exception.toLowerCase();
    
    if (excLower.includes('timeout') || msgLower.includes('timeout') || msgLower.includes('tiempo de espera')) {
      isServer = true;
      tipoError = 'Timeout / Tiempo de espera';
    } else if (excLower.includes('conexión') || excLower.includes('conexion') || 
               excLower.includes('connectfailure') || excLower.includes('httprequestexception') || 
               msgLower.includes('conexión') || msgLower.includes('conexion') || msgLower.includes('failed to connect')) {
      isServer = true;
      tipoError = 'Fallo de Conexión / Red';
    } else if (excLower.includes('bad request') || msgLower.includes('bad request')) {
      isClient = true;
      tipoError = 'HTTP 400 - Bad Request';
    } else if (excLower.includes('not found') || msgLower.includes('not found')) {
      isClient = true;
      tipoError = 'HTTP 404 - Not Found';
    }
  }

  totalErrores++;

  // Agrupamiento
  if (isClient) {
    erroresClienteCount++;
    const key = `${cliente} | ${hostname}`;
    if (!clientGroups[key]) {
      clientGroups[key] = { cliente, hostname, eventos: 0, errores: [] };
    }
    clientGroups[key].eventos++;
    if (clientGroups[key].errores.length < 5) { // Guardar muestra
      clientGroups[key].errores.push({ timestamp: log.Timestamp, tipoError, mensaje: message.substring(0, 150) });
    }
  } else if (isServer) {
    erroresServidorCount++;
    if (!serverGroups[cliente]) {
      serverGroups[cliente] = { cliente, hostname, eventos: 0, errores: [] };
    }
    serverGroups[cliente].eventos++;
    if (serverGroups[cliente].errores.length < 5) { // Guardar muestra
      serverGroups[cliente].errores.push({ timestamp: log.Timestamp, tipoError, mensaje: message.substring(0, 150) });
    }
  }
});

// 2. Aplicar reglas de umbrales para las alertas
const alertasCliente = [];
const alertasServidor = {
  globalTriggered: false,
  clientesAfectadosCount: 0,
  detalleClientes: [],
  mensaje: ""
};

// Regla 1: Alerta Cliente si supera 20 eventos
for (const key in clientGroups) {
  const group = clientGroups[key];
  if (group.eventos > 20) {
    alertasCliente.push({
      cliente: group.cliente,
      hostname: group.hostname,
      eventos: group.eventos,
      ejemplos: group.errores,
      mensaje: `Alerta Cliente Crítico: ${group.cliente} en hostname '${group.hostname}' registra ${group.eventos} errores de cliente.`
    });
  }
}

// Regla 2: Alerta Servidor Global si afecta a > 3 clientes con > 10 eventos cada uno
const clientesServidorAfectados = [];
for (const cliente in serverGroups) {
  const group = serverGroups[cliente];
  if (group.eventos > 10) {
    clientesServidorAfectados.push(group);
  }
}

if (clientesServidorAfectados.length > 3) {
  alertasServidor.globalTriggered = true;
  alertasServidor.clientesAfectadosCount = clientesServidorAfectados.length;
  alertasServidor.detalleClientes = clientesServidorAfectados.map(g => ({
    cliente: g.cliente,
    hostname: g.hostname,
    eventos: g.eventos
  }));
  alertasServidor.mensaje = `CRÍTICO: Posible indisponibilidad del servidor. Afecta a ${clientesServidorAfectados.length} clientes con más de 10 errores de conexión/timeout cada uno.`;
}

// Retornar en el formato requerido por n8n (array con propiedad json)
return [
  {
    json: {
      resumen: {
        totalErrores,
        erroresCliente: erroresClienteCount,
        erroresServidor: erroresServidorCount,
        alertaServidorGlobal: alertasServidor.globalTriggered,
        alertaClienteCritico: alertasCliente.length > 0,
        timestampMonitoreo: new Date().toISOString()
      },
      alertasServidor,
      alertasCliente
    }
  }
];
```
