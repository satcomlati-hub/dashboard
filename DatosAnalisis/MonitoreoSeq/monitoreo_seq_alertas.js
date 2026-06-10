/**
 * Script de clasificación de alertas para Seq en n8n.
 * 
 * Este script procesa logs de Seq, clasifica las fallas entre errores de cliente,
 * errores de servidor e infraestructura cloud, y genera alertas basadas en reglas de negocio.
 * También agrupa los errores por tipo/mensaje principal (excluyendo detalles o stack trace).
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

// Configuración de infraestructura
const infraClientes = ['HostingSAT', 'PAC', 'Panama', 'BOLIVIA', 'Panama2', 'HostingV5', 'aws.colombia'];
const infraUrls = ['https://webapi.mysatcomla.com', 'https://api-app-prod.mysatcomla.com'];

// Estructuras de almacenamiento para agrupamiento
const clientGroups = {}; // Agrupado por: Cliente | Hostname
const serverGroups = {}; // Agrupado por: Cliente
const infraGroups = {};  // Agrupado por: Cliente (Infraestructura)
const erroresPorTipo = {}; // Agrupado por el mensaje limpio del error

let totalErrores = 0;
let erroresClienteCount = 0;
let erroresServidorCount = 0;
let erroresInfraestructuraCount = 0;

// Función para extraer el tipo de error de forma limpia, excluyendo stack trace y detalles dinámicos
function obtenerTipoErrorLimpio(message, exception) {
  let errorText = '';
  
  if (exception) {
    // Tomar la primera línea de la excepción
    const primeraLinea = exception.split(/[\r\n]+/)[0].trim();
    if (primeraLinea) {
      errorText = primeraLinea;
    }
  }
  
  if (!errorText && message) {
    // Si no hay excepción, usar la primera línea del mensaje
    const primeraLineaMsg = message.split(/[\r\n]+/)[0].trim();
    errorText = primeraLineaMsg;
  }

  if (!errorText) {
    return 'Error Desconocido';
  }

  // Limpiar prefijo común del tipo de excepción si existe (ej. "System.ArgumentException: ...")
  const exceptionPrefixMatch = errorText.match(/^[a-zA-Z0-9\._]+Exception:\s*(.+)$/);
  if (exceptionPrefixMatch && exceptionPrefixMatch[1]) {
    errorText = exceptionPrefixMatch[1].trim();
  }

  // Ocultar IDs numéricos largos y UUIDs para una agrupación más efectiva
  errorText = errorText.replace(/\b\d{10,}\b/g, '{ID}');
  errorText = errorText.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '{UUID}');
  
  // Limitar longitud
  if (errorText.length > 150) {
    errorText = errorText.substring(0, 150) + '...';
  }

  return errorText;
}

// 1. Procesar y clasificar cada log
logs.forEach(log => {
  const message = log.Message || log.RenderedMessage || log.MessageTemplate || '';
  const exception = log.Exception || log.exception || log['@Exception'] || '';
  const hostname = log.Hostname || log._hostname || log.hostname || 'Desconocido';
  const cliente = log.Cliente || log._cliente || log.cliente || 'Desconocido';
  
  const msgLower = message.toLowerCase();
  const excLower = exception.toLowerCase();

  // Determinar si corresponde a infraestructura cloud
  const esClienteInfra = infraClientes.some(c => c.toLowerCase() === cliente.toLowerCase());
  const contieneUrlInfra = infraUrls.some(url => msgLower.includes(url.toLowerCase()) || excLower.includes(url.toLowerCase()));
  const isInfraestructura = esClienteInfra || contieneUrlInfra;

  // Extraer código de estado HTTP si existe en la excepción o mensaje
  let statusCode = null;
  const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                        exception.match(/StatusCode=(\d+)/) || 
                        message.match(/(\d{3})/);
  if (statusCodeMatch) {
    statusCode = parseInt(statusCodeMatch[1]);
  }

  // Robustez en extracción de propiedades
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

  // Clasificación de eventos RabbitMQ
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

  // Clasificación de Warnings/Errors con excepción en propiedades
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

  // Obtener y registrar tipo de error agrupado
  const errorLimpio = obtenerTipoErrorLimpio(message, exception);
  if (!erroresPorTipo[errorLimpio]) {
    erroresPorTipo[errorLimpio] = { tipo: errorLimpio, count: 0, fuentes: new Set() };
  }
  erroresPorTipo[errorLimpio].count++;
  erroresPorTipo[errorLimpio].fuentes.add(cliente);

  // Clasificar y agrupar por origen/destino
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

// 2. Aplicar reglas de umbrales para las alertas
const alertasCliente = [];
const alertasServidor = {
  globalTriggered: false,
  clientesAfectadosCount: 0,
  detalleClientes: [],
  mensaje: ""
};
const alertasInfraestructura = [];

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

// Regla 3: Alerta Infraestructura si supera 20 eventos
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

// Convertir el Set de fuentes a Array para serialización JSON
const erroresAgrupadosPorTipo = Object.values(erroresPorTipo)
  .map(g => ({
    tipo: g.tipo,
    count: g.count,
    fuentes: Array.from(g.fuentes)
  }))
  .sort((a, b) => b.count - a.count);

// Retornar en el formato requerido por n8n (array con propiedad json)
return [
  {
    json: {
      resumen: {
        totalErrores,
        erroresCliente: erroresClienteCount,
        erroresServidor: erroresServidorCount,
        erroresInfraestructura: erroresInfraestructuraCount,
        alertaServidorGlobal: alertasServidor.globalTriggered,
        alertaClienteCritico: alertasCliente.length > 0,
        alertaInfraestructuraCritica: alertasInfraestructura.length > 0,
        timestampMonitoreo: new Date().toISOString()
      },
      alertasServidor,
      alertasCliente,
      alertasInfraestructura,
      erroresPorTipo: erroresAgrupadosPorTipo
    }
  }
];
