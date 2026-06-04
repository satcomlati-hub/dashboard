const fs = require('fs');
const path = require('path');

// Leer el JSON de ejemplo
const filePath = 'c:/Antigravity2026/Satcom/DatosAnalisis/Análisis Errores SEQ N8N/resultados_4Ambientes_1780602123702.json';
const rawData = fs.readFileSync(filePath, 'utf-8');
const eventsInput = JSON.parse(rawData);

// Lista de clientes de Cloud mySatcom
const CLOUD_CLIENTS = new Set([
  'HostingSAT',
  'PAC',
  'Panama2',
  'BOLIVIA',
  'HostingV5'
]);

function extraerDestino(url) {
  if (!url) return null;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return parsed.origin;
    }
    const match = url.match(/https?:\/\/[^\s/]+/i);
    return match ? match[0] : url;
  } catch (e) {
    return url;
  }
}

const infraestructuraMap = {};
const origenMap = {};
const resumenGeneral = {
  totalProcesados: eventsInput.length,
  ambientes: {},
  aplicaciones: {},
  versiones: {},
  conteoPorNivel: {}
};

eventsInput.forEach(event => {
  if (!event || !event.Properties) return;

  const props = event.Properties;
  const timestamp = event.Timestamp;
  const level = event.Level || 'Unknown';
  
  const ambiente = props._ambiente || props.Origen || 'Desconocido';
  resumenGeneral.ambientes[ambiente] = (resumenGeneral.ambientes[ambiente] || 0) + 1;
  
  const app = props._app || 'Desconocido';
  resumenGeneral.aplicaciones[app] = (resumenGeneral.aplicaciones[app] || 0) + 1;
  
  const version = props._version || 'Desconocida';
  resumenGeneral.versiones[version] = (resumenGeneral.versiones[version] || 0) + 1;
  
  resumenGeneral.conteoPorNivel[level] = (resumenGeneral.conteoPorNivel[level] || 0) + 1;

  const esError = level.toLowerCase() === 'error' || level.toLowerCase() === 'fatal' || level.toLowerCase() === 'warning';
  if (!esError) return;

  const cliente = props._cliente || 'Desconocido';
  const hostname = props._hostname || 'Desconocido';
  const origenKey = `${cliente}|${app}|${hostname}`;

  const mensajeError = props.MensajeError || event.RenderedMessage || 'Sin mensaje de error';
  const exceptionText = props['@Exception'] || props.Exception || (props.Error && typeof props.Error === 'object' ? props.Error.Message : null) || '';

  let apiDestino = props.apiClientUrl || null;
  if (!apiDestino && exceptionText) {
    const urlMatch = exceptionText.match(/https?:\/\/[^\s/]+/i);
    if (urlMatch) apiDestino = urlMatch[0];
  }

  // Si no se encontró apiClientUrl pero hay excepciones de comunicación en Colombia u otros métodos, buscar si contiene URLs conocidas
  if (!apiDestino && exceptionText.includes('api-colombia.mysatcomla.com')) {
    apiDestino = 'https://api-colombia.mysatcomla.com';
  }

  if (apiDestino) {
    const destinoNormalizado = extraerDestino(apiDestino);
    if (destinoNormalizado) {
      if (!infraestructuraMap[destinoNormalizado]) {
        infraestructuraMap[destinoNormalizado] = {
          destino: destinoNormalizado,
          clientes: new Set(),
          totalEventos: 0,
          ejemplos: []
        };
      }
      infraestructuraMap[destinoNormalizado].clientes.add(cliente);
      infraestructuraMap[destinoNormalizado].totalEventos += 1;
      
      if (infraestructuraMap[destinoNormalizado].ejemplos.length < 3) {
        infraestructuraMap[destinoNormalizado].ejemplos.push({
          cliente,
          app,
          mensajeError: mensajeError.substring(0, 100),
          timestamp
        });
      }
    }
  }

  if (!origenMap[origenKey]) {
    origenMap[origenKey] = {
      cliente,
      app,
      hostname,
      esCloud: CLOUD_CLIENTS.has(cliente),
      count: 0,
      ejemplos: []
    };
  }
  origenMap[origenKey].count += 1;
  if (origenMap[origenKey].ejemplos.length < 3) {
    origenMap[origenKey].ejemplos.push({
      mensajeError: mensajeError.substring(0, 100),
      timestamp
    });
  }
});

const alertasInfraestructura = [];
const alertasOrigen = [];

for (const dest in infraestructuraMap) {
  const data = infraestructuraMap[dest];
  if (data.clientes.size > 3 && data.totalEventos > 10) {
    alertasInfraestructura.push({
      destino: data.destino,
      cantidadClientesAfectados: data.clientes.size,
      clientesAfectados: Array.from(data.clientes),
      totalEventosError: data.totalEventos,
      ejemplos: data.ejemplos
    });
  }
}

for (const key in origenMap) {
  const data = origenMap[key];
  const umbral = data.esCloud ? 100 : 20;
  if (data.count > umbral) {
    alertasOrigen.push({
      cliente: data.cliente,
      app: data.app,
      hostname: data.hostname,
      tipoOrigen: data.esCloud ? 'Cloud mySatcom' : 'Cliente Dedicado/Normal',
      eventosDetectados: data.count,
      umbralSuperado: umbral,
      ejemplos: data.ejemplos
    });
  }
}

console.log("=== ANÁLISIS DE LOGS ===");
console.log(JSON.stringify({
  resumenGeneral,
  alertasDetectadas: {
    infraestructura: alertasInfraestructura,
    origenCliente: alertasOrigen
  }
}, null, 2));
