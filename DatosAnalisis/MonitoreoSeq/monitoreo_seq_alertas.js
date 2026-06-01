/**
 * Script de clasificación de alertas para Seq en n8n.
 * 
 * Este script procesa logs de Seq, clasifica las fallas entre errores de cliente (ej. Bad Request, HTTP 4xx)
 * y errores de servidor (ej. Timeouts, fallas de red, HTTP 5xx), y genera alertas basadas en reglas de negocio.
 * 
 * Reglas de alertas (umbrales):
 * - Alerta de cliente: Combinaciones unique 'cliente' + 'hostname' con más de 20 eventos de error.
 * - Alerta de servidor global: Si más de 3 clientes registran más de 10 eventos de error de servidor cada uno.
 */

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
