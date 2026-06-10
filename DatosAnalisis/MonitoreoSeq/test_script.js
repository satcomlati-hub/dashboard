const fs = require('fs');
const path = require('path');

// Cargar el JSON de logs
const logsPath = path.resolve(__dirname, '../Análisis Errores SEQ N8N/top 100.json');
const logsData = JSON.parse(fs.readFileSync(logsPath, 'utf8'));

// Simular el entorno de n8n
const $input = {
  all: () => logsData.map(log => ({ json: log }))
};

// --- CONTENIDO DEL SCRIPT ---
// Configuración de infraestructura
const infraClientes = ['HostingSAT', 'PAC', 'Panama', 'BOLIVIA', 'Panama2', 'HostingV5', 'aws.colombia'];
const infraUrls = ['https://webapi.mysatcomla.com', 'https://api-app-prod.mysatcomla.com'];

const clientGroups = {};
const serverGroups = {};
const infraGroups = {};
const erroresPorTipo = {};

let totalErrores = 0;
let erroresClienteCount = 0;
let erroresServidorCount = 0;
let erroresInfraestructuraCount = 0;

function obtenerTipoErrorLimpio(message, exception) {
  let errorText = '';
  if (exception) {
    const primeraLinea = exception.split(/[\r\n]+/)[0].trim();
    if (primeraLinea) {
      errorText = primeraLinea;
    }
  }
  if (!errorText && message) {
    const primeraLineaMsg = message.split(/[\r\n]+/)[0].trim();
    errorText = primeraLineaMsg;
  }
  if (!errorText) {
    return 'Error Desconocido';
  }
  const exceptionPrefixMatch = errorText.match(/^[a-zA-Z0-9\._]+Exception:\s*(.+)$/);
  if (exceptionPrefixMatch && exceptionPrefixMatch[1]) {
    errorText = exceptionPrefixMatch[1].trim();
  }
  errorText = errorText.replace(/\b\d{10,}\b/g, '{ID}');
  errorText = errorText.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '{UUID}');
  if (errorText.length > 150) {
    errorText = errorText.substring(0, 150) + '...';
  }
  return errorText;
}

logsData.forEach(log => {
  const message = log.Message || log.RenderedMessage || log.MessageTemplate || '';
  const exception = log.Exception || log.exception || log['@Exception'] || '';
  const hostname = log.Hostname || log._hostname || log.hostname || 'Desconocido';
  const cliente = log.Cliente || log._cliente || log.cliente || 'Desconocido';
  
  const msgLower = message.toLowerCase();
  const excLower = exception.toLowerCase();

  const esClienteInfra = infraClientes.some(c => c.toLowerCase() === cliente.toLowerCase());
  const contieneUrlInfra = infraUrls.some(url => msgLower.includes(url.toLowerCase()) || excLower.includes(url.toLowerCase()));
  const isInfraestructura = esClienteInfra || contieneUrlInfra;

  let statusCode = null;
  const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                        exception.match(/StatusCode=(\d+)/) || 
                        message.match(/(\d{3})/);
  if (statusCodeMatch) {
    statusCode = parseInt(statusCodeMatch[1]);
  }

  let propertiesObj = {};
  if (log.Properties) {
    if (Array.isArray(log.Properties)) {
      log.Properties.forEach(p => {
        if (p && p.Name) propertiesObj[p.Name] = p.Value;
      });
    } else if (typeof log.Properties === 'object') {
      propertiesObj = log.Properties;
    }
  }

  let isClient = false;
  let isServer = false;
  let tipoError = 'Desconocido';

  if (statusCode) {
    if (statusCode >= 400 && statusCode < 500) {
      isClient = true;
      tipoError = `HTTP ${statusCode}`;
    } else if (statusCode >= 500) {
      isServer = true;
      tipoError = `HTTP ${statusCode}`;
    }
  }

  if (!isClient && !isServer) {
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

  const esRabbit = msgLower.includes('rabbit') || 
                    excLower.includes('rabbit') || 
                    propertiesObj.Cola || 
                    propertiesObj.Consumer || 
                    propertiesObj.NombreCola ||
                    log.Cola ||
                    log.Consumer;
                    
  if (esRabbit) {
    isServer = true;
    tipoError = 'RabbitMQ / Mensajería';
  }

  let tieneExcepcion = exception.trim() !== '';
  if (!tieneExcepcion) {
    for (const key in propertiesObj) {
      if (key.toLowerCase().includes('exception') && propertiesObj[key]) {
        tieneExcepcion = true;
        break;
      }
    }
  }

  if (!isClient && !isServer && tieneExcepcion) {
    isServer = true;
    tipoError = 'Excepción del Servidor (Warning/Error)';
  }

  totalErrores++;

  const errorLimpio = obtenerTipoErrorLimpio(message, exception);
  if (!erroresPorTipo[errorLimpio]) {
    erroresPorTipo[errorLimpio] = { tipo: errorLimpio, count: 0, fuentes: new Set() };
  }
  erroresPorTipo[errorLimpio].count++;
  erroresPorTipo[errorLimpio].fuentes.add(cliente);

  if (isInfraestructura) {
    erroresInfraestructuraCount++;
    if (!infraGroups[cliente]) {
      infraGroups[cliente] = { cliente, eventos: 0, errores: [] };
    }
    infraGroups[cliente].eventos++;
    if (infraGroups[cliente].errores.length < 5) {
      infraGroups[cliente].errores.push({ timestamp: log.Timestamp, tipoError, mensaje: message.substring(0, 150) });
    }
  } else if (isClient) {
    erroresClienteCount++;
    const key = `${cliente} | ${hostname}`;
    if (!clientGroups[key]) {
      clientGroups[key] = { cliente, hostname, eventos: 0, errores: [] };
    }
    clientGroups[key].eventos++;
    if (clientGroups[key].errores.length < 5) {
      clientGroups[key].errores.push({ timestamp: log.Timestamp, tipoError, mensaje: message.substring(0, 150) });
    }
  } else if (isServer) {
    erroresServidorCount++;
    if (!serverGroups[cliente]) {
      serverGroups[cliente] = { cliente, hostname, eventos: 0, errores: [] };
    }
    serverGroups[cliente].eventos++;
    if (serverGroups[cliente].errores.length < 5) {
      serverGroups[cliente].errores.push({ timestamp: log.Timestamp, tipoError, mensaje: message.substring(0, 150) });
    }
  }
});

const alertasCliente = [];
const alertasServidor = {
  globalTriggered: false,
  clientesAfectadosCount: 0,
  detalleClientes: [],
  mensaje: ""
};
const alertasInfraestructura = [];

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

for (const cliente in infraGroups) {
  const group = infraGroups[cliente];
  if (group.eventos > 20) {
    alertasInfraestructura.push({
      cliente: group.cliente,
      eventos: group.eventos,
      ejemplos: group.errores,
      mensaje: `Alerta Infraestructura Crítica: El nodo de infraestructura '${group.cliente}' registra ${group.eventos} eventos de error.`
    });
  }
}

const erroresAgrupadosPorTipo = Object.values(erroresPorTipo)
  .map(g => ({
    tipo: g.tipo,
    count: g.count,
    fuentes: Array.from(g.fuentes)
  }))
  .sort((a, b) => b.count - a.count);

console.log("=== RESUMEN ===");
console.log(JSON.stringify({
  totalErrores,
  erroresCliente: erroresClienteCount,
  erroresServidor: erroresServidorCount,
  erroresInfraestructura: erroresInfraestructuraCount,
  alertaServidorGlobal: alertasServidor.globalTriggered,
  alertaClienteCritico: alertasCliente.length > 0,
  alertaInfraestructuraCritica: alertasInfraestructura.length > 0
}, null, 2));

console.log("\n=== TOP 5 TIPOS DE ERRORES ===");
console.log(JSON.stringify(erroresAgrupadosPorTipo.slice(0, 5), null, 2));

console.log("\n=== ALERTAS INFRAESTRUCTURA ===");
console.log(JSON.stringify(alertasInfraestructura, null, 2));
