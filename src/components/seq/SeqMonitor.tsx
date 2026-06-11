'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Tabs from '@/components/Tabs';
import {
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Edit,
  Plus,
  Search,
  Copy,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  FileText,
  X,
  ExternalLink,
  Clock,
  Bell,
  BellOff,
  Save
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

// Definición de tipos
interface SeqConnection {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  usuario?: string;
  clave?: string;
}

interface SeqTask {
  id: string;
  name: string;
  seqUrl: string;
  apiKey?: string;
  query?: string;
  intervalSeconds: number;
  condition: string;
  conditionValue?: string;
  actionType: string;
  actionWebhookUrl?: string;
  lastRun?: number;
  createdAt?: string;
}

interface SavedQuery {
  id: string;
  name: string;
  filter: string;
  alertConfig?: {
    timeWindowMinutes: number;
    clientEventsThreshold: number;
    serverEventsThreshold: number;
    serverClientsThreshold: number;
    includeVersion: boolean;
    includeApp: boolean;
    includeHostname: boolean;
    includeCliente: boolean;
    isActive: boolean;
  };
  conexionesIds?: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface HistoryQuery {
  query: string;
  timestamp: string;
}

interface SeqLogProperty {
  Name: string;
  Value: any;
}

interface SeqLog {
  Id: string;
  Timestamp: string;
  Level?: string;
  RenderedMessage?: string;
  MessageTemplate?: string;
  Properties?: SeqLogProperty[];
  Exception?: string;
  connectionId?: string;
  connectionName?: string;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const DEFAULT_QUERIES: SavedQuery[] = [
  { id: 'q-all', name: 'Todos los Logs', filter: '', createdBy: 'sistema@mysatcomla.com' },
  { id: 'q-err', name: 'Errores y Fatal', filter: "@Level = 'Error' or @Level = 'Fatal'", createdBy: 'sistema@mysatcomla.com' },
  { id: 'q-warn', name: 'Advertencias (Warning)', filter: "@Level = 'Warning'", createdBy: 'sistema@mysatcomla.com' },
  { id: 'q-info', name: 'Mensajes Informativos', filter: "@Level = 'Information'", createdBy: 'sistema@mysatcomla.com' },
  { id: 'q-ai', name: 'AI & RAG Flows', filter: "App = 'RAG' or App = 'SARA' or @Message like '%RAG%' or @Message like '%SARA%'", createdBy: 'sistema@mysatcomla.com' },
  { id: 'q-exc', name: 'Excepciones / Errores Críticos', filter: "has(@Exception) or @Level = 'Fatal'", createdBy: 'sistema@mysatcomla.com' }
];

const LOG_LEVELS = ['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal'];

const LEVEL_COLORS: { [key: string]: string } = {
  Verbose: '#9ca3af',
  Debug: '#10b981',
  Information: '#0ea5e9',
  Warning: '#f59e0b',
  Error: '#ef4444',
  Fatal: '#ec4899'
};

const LEVEL_TEXT_CLASSES: { [key: string]: string } = {
  Verbose: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20',
  Debug: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Information: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  Warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Error: 'text-red-400 bg-red-500/10 border-red-500/20',
  Fatal: 'text-pink-400 bg-pink-500/10 border-pink-500/20'
};

const CLOUD_CLIENTS = new Set([
  'HostingSAT',
  'PAC',
  'Panama2',
  'BOLIVIA',
  'HostingV5'
]);

export default function SeqMonitor({ isAdmin = false }: { isAdmin?: boolean }) {
  const [activeTab, setActiveTab] = useState<'monitor' | 'tasks' | 'connections' | 'ignored'>('monitor');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [ignoredErrors, setIgnoredErrors] = useState<any[]>([]);
  const [analysisErrorTextFilter, setAnalysisErrorTextFilter] = useState<string>('');

  const clearLocalFilters = () => {
    setLocalFilterOrigin(null);
    setLocalFilterDestino(null);
    setLocalFilterMessage(null);
    setLocalFilterId(null);
    setFilterOnlyAlerts(false);
    setLocalSearchQuery('');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const observer = new MutationObserver(() => {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      setIsDarkMode(document.documentElement.classList.contains('dark'));
      return () => observer.disconnect();
    }
  }, []);

  const [connections, setConnections] = useState<SeqConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [activeConnectionFilters, setActiveConnectionFilters] = useState<Set<string>>(new Set());
  const [isConnectionDropdownOpen, setIsConnectionDropdownOpen] = useState<boolean>(false);
  const connectionDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionStatusText, setConnectionStatusText] = useState<string>('Desconectado');
  
  // Queries
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [currentFilter, setCurrentFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  const [logs, setLogs] = useState<SeqLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000);
  
  // Filtros locales
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set(LOG_LEVELS));
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  
  // Tareas y Alertas
  const [tasks, setTasks] = useState<SeqTask[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Modales
  const [isSaveQueryModalOpen, setIsSaveQueryModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  
  // Estados para silenciar errores (ignorar) de manera interactiva
  const [isIgnoreModalOpen, setIsIgnoreModalOpen] = useState(false);
  const [ignorePattern, setIgnorePattern] = useState('');
  const [ignoreOriginalError, setIgnoreOriginalError] = useState('');
  const [ignoreDurationOption, setIgnoreDurationOption] = useState<'hoy' | 'semana' | 'mes' | 'manual'>('hoy');
  const [ignoreManualDate, setIgnoreManualDate] = useState('');
  const [selectedQueryForAlert, setSelectedQueryForAlert] = useState<SavedQuery | null>(null);
  const [alertConfig, setAlertConfig] = useState({
    timeWindowMinutes: 10,
    clientEventsThreshold: 30,
    serverEventsThreshold: 30,
    serverClientsThreshold: 3,
    includeVersion: true,
    includeApp: true,
    includeHostname: true,
    includeCliente: true,
    isActive: true
  });
  const [generatedJsAlert, setGeneratedJsAlert] = useState<string>('');
  const [customJsAlert, setCustomJsAlert] = useState<string>('');
  const [isCustomAlertEdited, setIsCustomAlertEdited] = useState<boolean>(false);
  const [alertModalTab, setAlertModalTab] = useState<'script' | 'simulation'>('script');
  const [alertQueryFilter, setAlertQueryFilter] = useState<string>('');
  const [showLiveAnalysisPanel, setShowLiveAnalysisPanel] = useState<boolean>(false);
  const [filterOnlyAlerts, setFilterOnlyAlerts] = useState<boolean>(false);
  const [localFilterOrigin, setLocalFilterOrigin] = useState<{ cliente: string; hostname: string } | null>(null);
  const [localFilterDestino, setLocalFilterDestino] = useState<string | null>(null);
  const [localFilterMessage, setLocalFilterMessage] = useState<string | null>(null);
  const [localFilterId, setLocalFilterId] = useState<string | null>(null);
  const [mesaAyudaSortBy, setMesaAyudaSortBy] = useState<'origen' | 'eventos'>('eventos');
  const [mesaAyudaSortOrder, setMesaAyudaSortOrder] = useState<'asc' | 'desc'>('desc');
  const [infraSortBy, setInfraSortBy] = useState<'destino' | 'eventos'>('eventos');
  const [infraSortOrder, setInfraSortOrder] = useState<'asc' | 'desc'>('desc');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionLabel: 'Eliminar',
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, actionLabel: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      actionLabel,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };
  
  // Ediciones en Modales
  const [editingTask, setEditingTask] = useState<SeqTask | null>(null);
  const [editingConnection, setEditingConnection] = useState<SeqConnection | null>(null);
  
  // Inputs Formularios Modales
  const [queryNameInput, setQueryNameInput] = useState('');
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [queryFilterInput, setQueryFilterInput] = useState<string>('');
  const [showSavedQueries, setShowSavedQueries] = useState<boolean>(false);
  const [historyQueries, setHistoryQueries] = useState<HistoryQuery[]>([]);
  const [downloadFileName, setDownloadFileName] = useState<string>('resultados_logs');
  
  // Selector temporal (inicio/fin)
  const [queryStartTime, setQueryStartTime] = useState<string>(''); // YYYY-MM-DDTHH:mm
  const [queryEndTime, setQueryEndTime] = useState<string>('');     // YYYY-MM-DDTHH:mm
  const [isTimePickerOpen, setIsTimePickerOpen] = useState<boolean>(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(false);

  // Consultas guardadas interactivas
  const [isSavedQueriesOpen, setIsSavedQueriesOpen] = useState<boolean>(false);
  const [searchSavedQueryText, setSearchSavedQueryText] = useState<string>('');
  const savedQueriesDropdownRef = useRef<HTMLDivElement>(null);

  // Series de tiempo ocultas
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Refs para interactividad
  const timePickerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [taskForm, setTaskForm] = useState({
    name: '',
    connectionId: '',
    query: '',
    intervalSeconds: 60,
    condition: 'is_not_empty',
    conditionValue: '0',
    actionType: 'notification',
    actionWebhookUrl: ''
  });
  
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    url: '',
    apiKey: '',
    usuario: '',
    clave: ''
  });

  // Logs expandidos
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Resultados SQL y modo de visualización de grids/gráficas
  const [rawSqlResult, setRawSqlResult] = useState<{ columns: string[], rows: any[][] } | null>(null);
  const [sqlViewMode, setSqlViewMode] = useState<'grid' | 'chart' | 'logs'>('grid');

  // Refs para temporizadores y streaming
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef({ 
    selectedConnections: [] as SeqConnection[], 
    currentFilter: '', 
    limit: 100, 
    isStreaming: false,
    queryStartTime: '',
    queryEndTime: ''
  });

  // Sincronizar referencias del estado para el callback de setInterval
  useEffect(() => {
    const selectedConns = connections.filter(c => selectedConnectionIds.has(c.id));
    stateRef.current = {
      selectedConnections: selectedConns,
      currentFilter,
      limit,
      isStreaming,
      queryStartTime,
      queryEndTime
    };
  }, [connections, selectedConnectionIds, currentFilter, limit, isStreaming, queryStartTime, queryEndTime]);

  // Regenerar script de alerta dinámica en base a inputs de configuración
  useEffect(() => {
    if (!selectedQueryForAlert) return;
    
    const queryName = selectedQueryForAlert.name;
    const queryFilter = alertQueryFilter || '';
    const cleanFilter = cleanFilterPrefix(queryFilter);
    const formattedFilter = formatFilterForSeq(cleanFilter);
    const ignoredPatternsJson = JSON.stringify(ignoredErrors.map(e => e.pattern), null, 2);

    const jsCode = `/**
 * Script de Alerta Automatizado para N8N
 * Consulta Seq: "${queryName.replace(/"/g, '\\"')}"
 * Generado automáticamente desde Satcom Analytics
 */

// 1. Obtener las reglas/conexiones desde el nodo 'Reglas' y mapearlas a un diccionario
const reglasInput = $('Reglas').all();
const URLS_CONEXIONES_SEQ = {};

reglasInput.forEach(item => {
  const r = item.json;
  if (r.conexion_nombre && r.conexion_url) {
    URLS_CONEXIONES_SEQ[r.conexion_nombre] = r.conexion_url;
  }
});

// Extraer configuración de umbrales dinámica desde el nodo Reglas (usando la primera regla como base)
const primeraReglaUmbrales = reglasInput[0]?.json?.umbrales || {};

const VENTANA_TIEMPO_MINUTOS = primeraReglaUmbrales.timeWindowMinutes || ${alertConfig.timeWindowMinutes};
const UMBRAL_CLIENTE_EVENTOS = primeraReglaUmbrales.clientEventsThreshold || ${alertConfig.clientEventsThreshold};
const UMBRAL_SERVIDOR_EVENTOS = primeraReglaUmbrales.serverEventsThreshold || ${alertConfig.serverEventsThreshold};
const UMBRAL_SERVIDOR_CLIENTES = primeraReglaUmbrales.serverClientsThreshold || ${alertConfig.serverClientsThreshold};

// Lista de errores silenciados cargada desde el tablero de monitoreo
const PATRONES_IGNORADOS = ${ignoredPatternsJson};

// Consulta evaluada dinámica (opcional, para el reporte final)
const CONSULTA_EVALUADA = reglasInput[0]?.json?.query_filter || "${queryFilter.replace(/"/g, '\\"').replace(/\n/g, ' ')}";

// 2. Obtener los logs de entrada desde el nodo anterior de la secuencia actual
const items = $input.all();

let logs = [];
if (items.length > 0) {
  const firstItem = items[0].json;
  if (firstItem.Columns && firstItem.Rows) {
    const cols = firstItem.Columns;
    logs = firstItem.Rows.map(row => {
      const obj = {};
      cols.forEach((col, idx) => { obj[col] = row[idx]; });
      return obj;
    });
  } else {
    logs = items.map(item => item.json).filter(log => log.Properties || log.Exception);
  }
}

// Helper para serializar valores complejos evitando [object Object]
function stringifyValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val); } catch (e) { return String(val); }
}

// Helper para limpiar/generalizar mensajes
function getGenericMessage(msg, exc) {
  let clean = msg || '';
  if (exc) {
    const firstLine = exc.split('\\n')[0].trim();
    if (firstLine) clean = firstLine;
  }
  clean = clean.replace(/FLIP-[A-Za-z0-9\\-+[\\\]]+/g, 'FLIP-[ARCHIVO]');
  clean = clean.replace(/\\b\\d{6,}\\b/g, '[ID]');
  clean = clean.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[GUID]');
  clean = clean.replace(/https?:\\/\\/[^\\s'"]+/g, '[URL]');
  return clean.substring(0, 150).trim();
}

// Agrupamientos
const clientGroups = {};
const serverGroups = {};

let totalErrores = 0;
let erroresClienteCount = 0;
let erroresServidorCount = 0;

let minTimeMs = Infinity;
let maxTimeMs = -Infinity;
let minTimestamp = null;
let maxTimestamp = null;

// Iteración de logs
logs.forEach(log => {
  const propMap = {};
  if (Array.isArray(log.Properties)) {
    log.Properties.forEach(p => {
      propMap[p.Name] = p.Value;
    });
  }

  const message = stringifyValue(propMap['Mensaje'] || log.Message || log.RenderedMessage || '');
  const exception = stringifyValue(propMap['Exception'] || log.Exception || log.exception || '');

  // Verificar si el error está silenciado
  const msgLower = message.toLowerCase();
  const excLower = exception.toLowerCase();
  const esIgnorado = PATRONES_IGNORADOS.some(patron => {
    const patLower = patron.toLowerCase();
    return msgLower.includes(patLower) || excLower.includes(patLower);
  });

  if (esIgnorado) {
    return;
  }

  const hostname = propMap['_hostname'] || propMap['hostname'] || log.Hostname || 'Desconocido';
  const cliente = propMap['cliente'] || propMap['_cliente'] || 'Desconocido';
  const app = propMap['_app'] || propMap['app'] || 'Desconocido';
  const version = propMap['_version'] || propMap['version'] || 'Desconocido';
  const origenConexion = log.SeqOrigen || 'Sender'; 

  const ts = log.Timestamp || log['@Timestamp'];
  if (ts) {
    const timeMs = Date.parse(ts);
    if (!isNaN(timeMs)) {
      if (timeMs < minTimeMs) { minTimeMs = timeMs; minTimestamp = ts; }
      if (timeMs > maxTimeMs) { maxTimeMs = timeMs; maxTimestamp = ts; }
    }
  }

  let statusCode = null;
  const statusCodeMatch = exception.match(/"StatusCode"\\s*:\\s*(\\d+)/) || 
                        exception.match(/StatusCode=(\\d+)/) || 
                        message.match(/(\\d{3})/);
  if (statusCodeMatch) {
    statusCode = parseInt(statusCodeMatch[1]);
  }

  let destino = 'Desconocido';
  const parametrosStr = stringifyValue(propMap['Parámetros'] || '');
  const requestUriMatch = parametrosStr.match(/"apiClientUrl"\\s*:\\s*"([^"]+)"/) ||
                        exception.match(/RequestUri[\\":=\\s]+(https?:\\/\\/[^\\s'",\\ ]+)/) ||
                        message.match(/(https?:\\/\\/[^\\s'"]+)/);
  if (requestUriMatch) {
    destino = requestUriMatch[1];
  }

  let isClient = false;
  let isServer = false;

  if (statusCode) {
    if (statusCode >= 400 && statusCode < 500) isClient = true;
    else if (statusCode >= 500) isServer = true;
  }

  if (!isClient && !isServer) {
    const msgLowerLog = message.toLowerCase();
    const excLowerLog = exception.toLowerCase();
    
    if (excLowerLog.includes('threadpool') || excLowerLog.includes('timeout') || msgLowerLog.includes('timeout')) {
      isServer = true;
    } else if (excLowerLog.includes('conexión') || excLowerLog.includes('conexion') || excLowerLog.includes('connectfailure')) {
      isServer = true;
    } else if (excLowerLog.includes('bad request') || excLowerLog.includes('not found')) {
      isClient = true;
    }
  }

  if (isServer) {
    const DOMINIOS_INFRAESTRUCTURA = [
      'api-colombia.mysatcomla.com',
      'webapi.mysatcomla.com',
      'api-app-prod.mysatcomla.com'
    ];
    const esDestinoCloud = DOMINIOS_INFRAESTRUCTURA.some(dom => destino.toLowerCase().includes(dom));
    if (!esDestinoCloud && destino !== 'Desconocido') {
      isClient = true;
      isServer = false;
    }
  }

  totalErrores++;

  function buildSeqQuery(originalFilter, cl, hn) {
    const cleanFilter = originalFilter ? originalFilter.trim() : '';
    const filterPart = cleanFilter ? '(' + cleanFilter + ')' : '';
    const clientPart = cl && cl !== 'Desconocido' ? "(_cliente = '" + cl + "' or cliente = '" + cl + "')" : '';
    const hostPart = hn && hn !== 'Desconocido' ? "(_hostname = '" + hn + "' or hostname = '" + hn + "')" : '';
    const parts = [filterPart, clientPart, hostPart].filter(Boolean);
    return parts.join(' and ');
  }

  const eventId = log.Id || log['@Id'] || '';
  let seqPermalink = '';
  if (eventId) {
    seqPermalink = \`https://dashboard-one-ivory-58.vercel.app/api/seq/public-event?id=\${eventId}&origen=\${origenConexion}\`;
  }

  const payloadComun = {
    timestamp: ts || new Date().toISOString(),
    mensajeError: message,
    excepcion: exception,
    destino: destino,
    // Campos dinámicos seleccionados en el generador:
    ${alertConfig.includeVersion ? 'version: version,' : ''}
    ${alertConfig.includeApp ? 'app: app,' : ''}
    ${alertConfig.includeHostname ? 'hostname: hostname,' : ''}
    ${alertConfig.includeCliente ? 'cliente: cliente,' : ''}
    origenConsulta: 'Seq (Origen: ' + origenConexion + ')',
    seqQuery: buildSeqQuery(CONSULTA_EVALUADA, cliente, hostname),
    seqPermalink: seqPermalink
  };

  const genericMsg = getGenericMessage(message, exception);

  if (isClient) {
    erroresClienteCount++;
    const key = \`\${cliente} | \${hostname}\`;
    if (!clientGroups[key]) {
      clientGroups[key] = { cliente, hostname, eventos: 0, errores: {} };
    }
    clientGroups[key].eventos++;
    if (!clientGroups[key].errores[genericMsg]) {
      clientGroups[key].errores[genericMsg] = { cantidad: 0, ejemplo: payloadComun };
    }
    clientGroups[key].errores[genericMsg].cantidad++;
  } else if (isServer) {
    erroresServidorCount++;
    if (!serverGroups[cliente]) {
      serverGroups[cliente] = { cliente, hostname, eventos: 0, errores: {} };
    }
    serverGroups[cliente].eventos++;
    if (!serverGroups[cliente].errores[genericMsg]) {
      serverGroups[cliente].errores[genericMsg] = { cantidad: 0, ejemplo: payloadComun };
    }
    serverGroups[cliente].errores[genericMsg].cantidad++;
  }
});

// Estructuración de las Alertas definitivas
const alertasMesaDeAyuda = [];
const alertasInfraestructura = {
  triggered: false,
  clientesAfectados: [],
  erroresAgrupados: [],
  mensaje: ""
};

// Regla Cliente
for (const key in clientGroups) {
  const g = clientGroups[key];
  if (g.eventos >= UMBRAL_CLIENTE_EVENTOS) {
    const erroresAgrupados = [];
    for (const msgKey in g.errores) {
      const errGroup = g.errores[msgKey];
      erroresAgrupados.push({
        errorGenerico: msgKey,
        cantidad: errGroup.cantidad,
        ejemplo: {
          destino: errGroup.ejemplo.destino,
          error: errGroup.ejemplo.mensajeError,
          // Campos dinámicos seleccionados:
          ${alertConfig.includeVersion ? 'version: errGroup.ejemplo.version,' : ''}
          ${alertConfig.includeApp ? 'app: errGroup.ejemplo.app,' : ''}
          origenConsulta: errGroup.ejemplo.origenConsulta,
          seqQuery: errGroup.ejemplo.seqQuery,
          seqPermalink: errGroup.ejemplo.seqPermalink
        }
      });
    }

    alertasMesaDeAyuda.push({
      origen: \`\${g.cliente} / \${g.hostname}\`,
      totalEventos: g.eventos,
      erroresAgrupados,
      mensaje: \`Alerta Mesa de Ayuda: El cliente \${g.cliente} en \${g.hostname} registra \${g.eventos} errores en los últimos \${VENTANA_TIEMPO_MINUTOS} minutos.\`
    });
  }
}

// Regla Servidor
const clientesServidorCriticos = [];
for (const cliente in serverGroups) {
  const g = serverGroups[cliente];
  if (g.eventos >= UMBRAL_SERVIDOR_EVENTOS) {
    clientesServidorCriticos.push(g);
  }
}

if (clientesServidorCriticos.length >= UMBRAL_SERVIDOR_CLIENTES) {
  alertasInfraestructura.triggered = true;
  alertasInfraestructura.clientesAfectados = clientesServidorCriticos.map(c => c.cliente);
  alertasInfraestructura.erroresAgrupados = [];
  
  clientesServidorCriticos.forEach(g => {
    const agrupadosPorOrigen = [];
    for (const msgKey in g.errores) {
      const errGroup = g.errores[msgKey];
      agrupadosPorOrigen.push({
        origen: \`\${g.cliente} / \${g.hostname}\`,
        errorGenerico: msgKey,
        cantidad: errGroup.cantidad,
        ejemplo: {
          destino: errGroup.ejemplo.destino,
          error: errGroup.ejemplo.mensajeError,
          // Campos dinámicos seleccionados:
          ${alertConfig.includeVersion ? 'version: errGroup.ejemplo.version,' : ''}
          ${alertConfig.includeApp ? 'app: errGroup.ejemplo.app,' : ''}
          origenConsulta: errGroup.ejemplo.origenConsulta,
          seqQuery: errGroup.ejemplo.seqQuery,
          seqPermalink: errGroup.ejemplo.seqPermalink
        }
      });
    }
    alertasInfraestructura.erroresAgrupados.push(...agrupadosPorOrigen);
  });

  alertasInfraestructura.mensaje = \`Alerta de Infraestructura: Se detectó un colapso de hilos (ThreadPool Exhaustion) o red en las APIs. Afecta a \${clientesServidorCriticos.length} entornos con errores críticos de conexión.\`;
}

const rangoHorario = minTimestamp && maxTimestamp 
  ? \`\${minTimestamp} a \${maxTimestamp}\`
  : 'No disponible';

return [
  {
    json: {
      consultaEvaluada: CONSULTA_EVALUADA,
      alertaGenerada: alertasMesaDeAyuda.length > 0 || alertasInfraestructura.triggered,
      resumen: {
        totalErroresEvaluados: totalErrores,
        totalErroresCliente: erroresClienteCount,
        totalErroresServidor: erroresServidorCount,
        ventanaEvaluacionMinutos: VENTANA_TIEMPO_MINUTOS,
        alertaClienteCritico: alertasMesaDeAyuda.length > 0,
        alertaServidorGlobal: alertasInfraestructura.triggered,
        rangoHorario: rangoHorario
      },
      alertasMesaDeAyuda,
      alertasInfraestructura
    }
  }
];
`;
    setGeneratedJsAlert(jsCode);
    if (!isCustomAlertEdited) {
      setCustomJsAlert(jsCode);
    }
  }, [selectedQueryForAlert, alertQueryFilter, alertConfig, connections, isCustomAlertEdited, isAlertModalOpen, ignoredErrors]);

  // Cerrar popups al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) {
        setIsTimePickerOpen(false);
      }
      if (suggestionsRef.current && 
          !suggestionsRef.current.contains(event.target as Node) && 
          textareaRef.current && 
          !textareaRef.current.contains(event.target as Node)) {
        setIsSuggestionsOpen(false);
      }
      if (savedQueriesDropdownRef.current && !savedQueriesDropdownRef.current.contains(event.target as Node)) {
        setIsSavedQueriesOpen(false);
      }
      if (connectionDropdownRef.current && !connectionDropdownRef.current.contains(event.target as Node)) {
        setIsConnectionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mostrar Toast
  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Descargar log en formato archivo .json
  const handleDownloadLog = (log: SeqLog) => {
    const propertiesData: { [key: string]: any } = {};
    if (log.Properties) {
      log.Properties.forEach(p => {
        propertiesData[p.Name] = p.Value;
      });
    }
    if (log.Exception) {
      propertiesData['@Exception'] = log.Exception;
    }
    if (log.MessageTemplate && log.RenderedMessage !== log.MessageTemplate) {
      propertiesData['@MessageTemplate'] = log.MessageTemplate;
    }

    const rawLog = {
      Id: log.Id,
      Timestamp: log.Timestamp,
      Level: log.Level || 'Information',
      MessageTemplate: log.MessageTemplate,
      RenderedMessage: log.RenderedMessage,
      Properties: propertiesData
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawLog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const fileName = `${log.Id || 'log'}.json`;
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Archivo ${fileName} descargado`, 'success');
  };

  // Cargar Ajustes y Datos al inicio
  useEffect(() => {
    // Cargar queries guardadas desde la base de datos
    fetchSavedQueries();

    // Cargar historial de queries de localStorage
    const savedHistory = localStorage.getItem('seq_monitor_query_history_v2');
    if (savedHistory) {
      setHistoryQueries(JSON.parse(savedHistory));
    } else {
      const legacyHistory = localStorage.getItem('seq_monitor_query_history');
      if (legacyHistory) {
        try {
          const parsed = JSON.parse(legacyHistory);
          if (Array.isArray(parsed)) {
            const converted = parsed.map((q: any) => {
              if (typeof q === 'string') {
                return { query: q, timestamp: 'Previo' };
              }
              return q;
            });
            setHistoryQueries(converted);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // Cargar límite
    const savedLimit = localStorage.getItem('seq_monitor_limit');
    if (savedLimit) {
      setLimit(parseInt(savedLimit, 10));
    }

    // Cargar conexiones, tareas iniciales y errores ignorados
    fetchConnections();
    fetchTasks();
    fetchIgnoredErrors();

    // Polling de notificaciones de tareas Seq en segundo plano
    const notifInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/seq/tasks/notifications');
        if (res.ok) {
          const notifications = await res.json();
          if (notifications.length > 0) {
            notifications.forEach((n: any) => {
              showToast(n.message, 'warning');
            });
            // Marcar todas como leídas después de mostrarlas
            await fetch('/api/seq/tasks/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (err) {
        console.error('Error al obtener notificaciones:', err);
      }
    }, 6000);

    return () => {
      clearInterval(notifInterval);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // Cargar parámetros de la URL para consultas directas por ID/Origen (ej: ?Id=xxx&Origen=yyy)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') || params.get('Id');
      const urlOrigen = params.get('origen') || params.get('Origen') || params.get('connection') || params.get('Connection');
      
      if (urlId && connections.length > 0) {
        // Establecer el filtro de consulta para buscar por ID del evento
        setCurrentFilter(`@Id = '${urlId}'`);
        
        // Seleccionar solo el origen correspondiente si se especifica
        if (urlOrigen) {
          const matchingConn = connections.find(
            c => c.name.toLowerCase() === urlOrigen.toLowerCase() || c.id === urlOrigen
          );
          if (matchingConn) {
            const newSelected = new Set([matchingConn.id]);
            setSelectedConnectionIds(newSelected);
            setActiveConnectionFilters(newSelected);
          }
        }
      }
    }
  }, [connections]);

  // CRUD Errores Ignorados / Silenciados
  const fetchIgnoredErrors = async () => {
    try {
      const res = await fetch('/api/seq/ignored-errors');
      if (res.ok) {
        const data = await res.json();
        setIgnoredErrors(data);
      }
    } catch (err) {
      console.error('Error fetching ignored errors:', err);
    }
  };

  const handleIgnoreError = async (pattern: string, durationOption: 'hoy' | 'semana' | 'mes' | 'manual', manualDate?: string) => {
    if (!pattern) return;
    
    let expiresAt: Date | null = null;
    const now = new Date();
    
    if (durationOption === 'hoy') {
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      expiresAt = todayEnd;
    } else if (durationOption === 'semana') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (durationOption === 'mes') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (durationOption === 'manual' && manualDate) {
      expiresAt = new Date(manualDate);
    }
    
    try {
      const res = await fetch('/api/seq/ignored-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          timeOption: durationOption
        })
      });
      
      if (res.ok) {
        showToast(`Error silenciado (${durationOption})`, 'success');
        fetchIgnoredErrors();
      } else {
        const err = await res.json();
        showToast(`Error al silenciar: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleUnignoreError = async (id: string) => {
    try {
      const res = await fetch(`/api/seq/ignored-errors?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Silencio removido correctamente', 'success');
        fetchIgnoredErrors();
      } else {
        showToast('Error al remover silencio', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const isErrorIgnored = (message: string, exception: string, log?: any) => {
    const textToEvaluate = log 
      ? JSON.stringify(log).toLowerCase() 
      : `${message || ''} ${exception || ''}`.toLowerCase();
    
    return ignoredErrors.some(ignored => {
      if (ignored.expiresAt && new Date(ignored.expiresAt).getTime() < Date.now()) {
        return false;
      }
      const pattern = ignored.pattern || '';
      const patLower = pattern.toLowerCase();
      
      try {
        let regexPattern = patLower;
        if (regexPattern.includes('*') && !regexPattern.includes('.*')) {
          regexPattern = regexPattern.replace(/\*/g, '.*');
        }
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(textToEvaluate);
      } catch (e) {
        return textToEvaluate.includes(patLower);
      }
    });
  };

  // CRUD Conexiones
  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/seq/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
        // Autoseleccionar todos los orígenes por defecto
        if (data.length > 0) {
          const allIds = data.map((c: any) => c.id);
          setSelectedConnectionIds(new Set(allIds));
          setActiveConnectionFilters(new Set(allIds));
          setConnectionStatus('connected');
          setConnectionStatusText(`Orígenes: ${data.length} activos`);
          
          // Cargar logs iniciales al iniciar
          setTimeout(() => {
            fetchLogs(false);
          }, 150);
        }
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
      showToast('Error al conectar con la API de conexiones', 'error');
    }
  };

  const saveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionForm.name || !connectionForm.url) {
      showToast('Nombre y URL de Seq son obligatorios.', 'error');
      return;
    }

    try {
      const payload = {
        id: editingConnection?.id,
        name: connectionForm.name,
        url: connectionForm.url,
        apiKey: connectionForm.apiKey,
        usuario: connectionForm.usuario,
        clave: connectionForm.clave
      };

      const res = await fetch('/api/seq/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Conexión guardada con éxito', 'success');
        setIsConnectionModalOpen(false);
        setEditingConnection(null);
        setConnectionForm({ name: '', url: '', apiKey: '', usuario: '', clave: '' });
        fetchConnections();
      } else {
        const err = await res.json();
        showToast(`Error al guardar: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al guardar conexión: ${err.message}`, 'error');
    }
  };

  const deleteConnection = async (id: string) => {
    const conn = connections.find(c => c.id === id);
    const connName = conn ? `"${conn.name}"` : 'esta conexión';
    triggerConfirm(
      'Eliminar Conexión',
      `¿Seguro que deseas eliminar la conexión ${connName}?`,
      'Eliminar',
      async () => {
        try {
          const res = await fetch(`/api/seq/connections?id=${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            showToast('Conexión eliminada', 'info');
            if (selectedConnectionId === id) {
              setSelectedConnectionId('');
              setConnectionStatus('disconnected');
              setConnectionStatusText('Desconectado');
              setLogs([]);
            }
            fetchConnections();
          } else {
            showToast('Error al eliminar conexión', 'error');
          }
        } catch (err: any) {
          showToast(`Error: ${err.message}`, 'error');
        }
      }
    );
  };

  // CRUD Consultas Guardadas / Alertas centralizadas
  const fetchSavedQueries = async () => {
    try {
      const res = await fetch('/api/seq/queries');
      if (res.ok) {
        const data = await res.json();
        // Si no hay consultas configuradas en la base de datos, mostramos las DEFAULT_QUERIES de fallback
        if (data.length === 0) {
          setSavedQueries(DEFAULT_QUERIES);
        } else {
          setSavedQueries(data);
        }
      } else {
        setSavedQueries(DEFAULT_QUERIES);
      }
    } catch (err) {
      console.error('Error fetching queries:', err);
      setSavedQueries(DEFAULT_QUERIES);
    }
  };

  // CRUD Tareas
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/seq/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const conn = connections.find(c => c.id === taskForm.connectionId);
    if (!conn) {
      showToast('Selecciona una conexión de Seq válida.', 'error');
      return;
    }

    try {
      const payload = {
        id: editingTask?.id,
        name: taskForm.name,
        seqUrl: conn.url,
        apiKey: conn.apiKey || '',
        query: taskForm.query,
        intervalSeconds: taskForm.intervalSeconds,
        condition: taskForm.condition,
        conditionValue: taskForm.conditionValue,
        actionType: taskForm.actionType,
        actionWebhookUrl: taskForm.actionWebhookUrl
      };

      const res = await fetch('/api/seq/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Tarea guardada con éxito', 'success');
        setIsTaskModalOpen(false);
        setEditingTask(null);
        setTaskForm({
          name: '',
          connectionId: '',
          query: '',
          intervalSeconds: 60,
          condition: 'is_not_empty',
          conditionValue: '0',
          actionType: 'notification',
          actionWebhookUrl: ''
        });
        fetchTasks();
      } else {
        const err = await res.json();
        showToast(`Error al guardar tarea: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al guardar tarea: ${err.message}`, 'error');
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    const taskName = task ? `"${task.name}"` : 'esta tarea';
    triggerConfirm(
      'Eliminar Tarea',
      `¿Seguro que deseas eliminar la tarea de monitoreo ${taskName}?`,
      'Eliminar',
      async () => {
        try {
          const res = await fetch(`/api/seq/tasks?id=${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            showToast('Tarea eliminada', 'info');
            fetchTasks();
          } else {
            showToast('Error al eliminar tarea', 'error');
          }
        } catch (err: any) {
          showToast(`Error: ${err.message}`, 'error');
        }
      }
    );
  };

  // Limpiar título/prefijo de la consulta si incluye un select precedido de ":"
  const cleanFilterPrefix = (filterStr: string): string => {
    if (!filterStr) return '';
    const trimmed = filterStr.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex !== -1) {
      const afterColon = trimmed.substring(colonIndex + 1).trim();
      if (afterColon.toLowerCase().startsWith('select ')) {
        return afterColon;
      }
    }
    return trimmed;
  };

  // Formatea el filtro para que Seq lo entienda. Si es texto libre y no contiene operadores estructurados ni es SQL, lo envuelve en comillas dobles.
  const formatFilterForSeq = (filterStr: string): string => {
    if (!filterStr) return '';
    const trimmed = filterStr.trim();
    
    // Si es consulta SQL, dejar intacta
    if (trimmed.toLowerCase().startsWith('select ')) {
      return trimmed;
    }
    
    // Si ya está envuelta en comillas dobles, dejar intacta
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }
    
    // Si ya está envuelta en comillas simples, dejar intacta
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed;
    }
    
    // Lista de operadores o palabras clave de filtro en Seq
    const operators = ['=', '!=', '<', '<=', '>', '>=', ' like ', ' contains ', 'has(', 'not(', 'contains(', 'cs', 'ci', 'startswith(', 'endswith('];
    const hasOperator = operators.some(op => trimmed.toLowerCase().includes(op));
    
    if (!hasOperator) {
      // Seq requiere que las búsquedas libres de palabras estén rodeadas por comillas dobles en su API
      return `"${trimmed.replace(/"/g, '\\"')}"`;
    }
    
    return trimmed;
  };

  // Obtener logs de Seq
  const fetchLogs = async (isAutoRefresh = false) => {
    const { selectedConnections, currentFilter: filterExpr, limit: maxCount, queryStartTime: startTime, queryEndTime: endTime } = stateRef.current;
    if (selectedConnections.length === 0) {
      if (!isAutoRefresh) showToast('Selecciona al menos una conexión de Seq activa', 'warning');
      return;
    }

    if (!isAutoRefresh && filterExpr && filterExpr.trim() !== '') {
      addToHistory(filterExpr);
    }

    if (!isAutoRefresh) {
      setIsLoadingLogs(true);
      setHiddenSeries(new Set());
    }

    try {
      const cleanFilter = cleanFilterPrefix(filterExpr);
      const formattedFilter = formatFilterForSeq(cleanFilter);
      let finalFilter = formattedFilter;

      // Inyectar límites de fecha/hora si no es query SQL (porque las SQL ya la llevan inyectada en su where)
      const isSql = cleanFilter && cleanFilter.trim().toLowerCase().startsWith('select ');
      if (!isSql) {
        const timeFilters: string[] = [];
        if (startTime) {
          timeFilters.push(`@Timestamp >= DateTime('${startTime}:00Z')`);
        }
        if (endTime) {
          timeFilters.push(`@Timestamp <= DateTime('${endTime}:00Z')`);
        }
        if (timeFilters.length > 0) {
          const timeFilterStr = timeFilters.join(' and ');
          if (finalFilter && finalFilter.trim() !== '') {
            finalFilter = `(${finalFilter}) and ${timeFilterStr}`;
          } else {
            finalFilter = timeFilterStr;
          }
        }
      } else {
        // Si es SQL, aseguremonos de inyectar las fechas actuales en el where
        finalFilter = applyTimeLimitsToQuery(cleanFilter);
      }

      // Ejecutar consultas en paralelo para todas las conexiones seleccionadas
      const promises = selectedConnections.map(async (conn) => {
        const queryParams = new URLSearchParams({
          seqUrl: conn.url,
          count: maxCount.toString(),
          render: 'true'
        });

        if (finalFilter && finalFilter.trim() !== '') {
          queryParams.append('filter', finalFilter);
        }

        try {
          const response = await fetch(`/api/seq/events?${queryParams}`, {
            headers: {
              'X-Seq-ApiKey': conn.apiKey || ''
            }
          });

          if (!response.ok) {
            const errorData = await response.json();
            return {
              connectionId: conn.id,
              connectionName: conn.name,
              success: false,
              error: errorData.error || errorData.details || 'Error de respuesta'
            };
          }

          const data = await response.json();
          return {
            connectionId: conn.id,
            connectionName: conn.name,
            success: true,
            data
          };
        } catch (err: any) {
          return {
            connectionId: conn.id,
            connectionName: conn.name,
            success: false,
            error: err.message || 'Error de red'
          };
        }
      });

      const results = await Promise.all(promises);

      // Reportar fallos parciales
      const failed = results.filter(r => !r.success);
      if (failed.length > 0 && !isAutoRefresh) {
        failed.forEach(f => {
          showToast(`Error en conexión '${f.connectionName}': ${f.error}`, 'error');
        });
      }

      let allFetchedLogs: SeqLog[] = [];
      let aggregatedSqlResult: { columns: string[], rows: any[][] } | null = null;

      // Filtrar resultados exitosos
      const successfulResults = results.filter(r => r.success && r.data);

      if (successfulResults.length > 0) {
        // Verificar si es agregación SQL (Columns + Rows/Series)
        const isSqlResult = successfulResults.some(r => r.data && r.data.Columns);

        if (isSqlResult) {
          let mergedColumns: string[] = [];
          let mergedRows: any[][] = [];

          successfulResults.forEach(r => {
            const data = r.data;
            if (!data || !data.Columns) return;

            let columns = [...data.Columns];
            let rows: any[][] = [];

            if (Array.isArray(data.Rows)) {
              rows = data.Rows;
            } else if (Array.isArray(data.Series)) {
              // Aplanar Series y Slices (GROUP BY time(...))
              const timeColName = 'time';
              const hasTimeCol = columns.some(c => c.toLowerCase() === 'time' || c.toLowerCase() === '@timestamp');
              if (!hasTimeCol) {
                let keyLength = 0;
                if (data.Series.length > 0 && data.Series[0].Key) {
                  keyLength = data.Series[0].Key.length;
                }
                columns.splice(keyLength, 0, timeColName);
              }

              const timeIndex = columns.findIndex(c => c.toLowerCase() === 'time' || c.toLowerCase() === '@timestamp');

              data.Series.forEach((seriesItem: any) => {
                const keyValues = seriesItem.Key || [];
                const slices = seriesItem.Slices || [];
                
                slices.forEach((slice: any) => {
                  const sliceTime = slice.Time;
                  const sliceRows = slice.Rows || [[]];
                  
                  sliceRows.forEach((sliceRow: any[]) => {
                    const flatRow = [...keyValues];
                    flatRow.splice(timeIndex, 0, sliceTime);
                    flatRow.push(...sliceRow);
                    rows.push(flatRow);
                  });
                });
              });
            }

            // Inyectar columna "Origen" para identificar de dónde proceden las filas
            const originColIndex = columns.findIndex(c => c === 'Origen');
            if (originColIndex === -1) {
              columns.push('Origen');
            }

            const formattedRows = rows.map(row => {
              const newRow = [...row];
              if (originColIndex === -1) {
                newRow.push(r.connectionName);
              } else {
                newRow[originColIndex] = r.connectionName;
              }
              return newRow;
            });

            if (mergedColumns.length === 0) {
              mergedColumns = columns;
            }
            mergedRows.push(...formattedRows);
          });

          aggregatedSqlResult = { columns: mergedColumns, rows: mergedRows };

          // Convertir filas a formato SeqLogs
          allFetchedLogs = mergedRows.map((row: any[], rowIndex: number) => {
            const properties = mergedColumns.map((colName: string, colIndex: number) => ({
              Name: colName,
              Value: row[colIndex]
            }));

            let timestamp = new Date().toISOString();
            const tsColIndex = mergedColumns.findIndex((col: string) => col.toLowerCase() === '@timestamp' || col.toLowerCase() === 'time');
            if (tsColIndex !== -1 && row[tsColIndex]) {
              timestamp = row[tsColIndex];
            }

            let level = 'Information';
            const lvlColIndex = mergedColumns.findIndex((col: string) => col.toLowerCase() === '@level' || col.toLowerCase() === 'level');
            if (lvlColIndex !== -1 && row[lvlColIndex]) {
              level = row[lvlColIndex];
            }

            const renderedMessage = mergedColumns
              .map((colName: string, colIndex: number) => {
                const val = row[colIndex];
                return `${colName}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`;
              }).join(' | ');

            const originVal = row[mergedColumns.length - 1];
            const matchingConn = selectedConnections.find(c => c.name === originVal);

            return {
              Id: `sql-row-${rowIndex}-${Date.now()}`,
              Timestamp: timestamp,
              Level: level,
              RenderedMessage: renderedMessage,
              Properties: properties,
              connectionId: matchingConn?.id,
              connectionName: matchingConn?.name
            };
          });
        } else {
          // logs tradicionales de Seq
          successfulResults.forEach(r => {
            const data = r.data;
            const events = Array.isArray(data) ? data : (data.Events || []);
            
            const processedEvents = events.map((log: SeqLog) => {
              const propertiesWithConnection = [
                ...(log.Properties || []),
                { Name: 'Origen', Value: r.connectionName }
              ];

              return {
                ...log,
                Properties: propertiesWithConnection,
                connectionId: r.connectionId,
                connectionName: r.connectionName
              };
            });

            allFetchedLogs.push(...processedEvents);
          });

          // Mezclar cronológicamente por Timestamp descendente
          allFetchedLogs.sort((a, b) => {
            const timeA = new Date(a.Timestamp).getTime();
            const timeB = new Date(b.Timestamp).getTime();
            return timeB - timeA;
          });
        }
      }

      setRawSqlResult(aggregatedSqlResult);
      if (!isAutoRefresh && aggregatedSqlResult) {
        setSqlViewMode('grid');
      }

      setLogs(prevLogs => {
        if (!isAutoRefresh) return allFetchedLogs;
        
        const existingIds = new Set(prevLogs.map(l => l.Id));
        const newLogs = allFetchedLogs.filter((l: any) => !existingIds.has(l.Id));
        
        if (newLogs.length === 0) return prevLogs;

        const combined = [...newLogs, ...prevLogs];
        return combined.slice(0, maxCount * selectedConnections.length * 2);
      });

    } catch (err: any) {
      console.error(err);
      showToast(`Error de conexión: ${err.message}`, 'error');
      if (isStreaming) stopStreaming();
    } finally {
      if (!isAutoRefresh) {
        setIsLoadingLogs(false);
      }
    }
  };

  // Conectarse a la conexión seleccionada
  const handleConnect = async (e?: React.FormEvent, connectionId?: string) => {
    if (e) e.preventDefault();
    const targetId = connectionId || selectedConnectionId;
    const conn = connections.find(c => c.id === targetId);
    if (!conn) return;

    setConnectionStatus('connecting');
    setConnectionStatusText('Validando conexión...');

    try {
      const queryParams = new URLSearchParams({
        seqUrl: conn.url,
        count: '1'
      });
      
      const response = await fetch(`/api/seq/events?${queryParams}`, {
        headers: {
          'X-Seq-ApiKey': conn.apiKey || ''
        }
      });

      if (response.ok) {
        setConnectionStatus('connected');
        setConnectionStatusText(`Conectado: ${conn.name}`);
        showToast(`Conexión establecida con ${conn.name}`, 'success');
        // Traer logs iniciales
        setTimeout(() => fetchLogs(false), 100);
      } else {
        const errorData = await response.json();
        setConnectionStatus('error');
        setConnectionStatusText('Error de Conexión');
        showToast(`Error al validar conexión: ${errorData.error || 'Respuesta inválida'}`, 'error');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionStatusText('Error de red');
      showToast(`Imposible conectar con Seq a través del proxy: ${err.message}`, 'error');
    }
  };

  // Controladores de Streaming
  const startStreaming = () => {
    setIsStreaming(true);
    showToast('Monitoreo en vivo iniciado', 'info');
    fetchLogs(false);

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      fetchLogs(true);
    }, autoRefreshInterval);
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    showToast('Monitoreo en vivo pausado', 'info');
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // Cambiar el refresco en vivo dinámicamente si se actualizan variables
  useEffect(() => {
    if (isStreaming) {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(() => {
        fetchLogs(true);
      }, autoRefreshInterval);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [isStreaming, autoRefreshInterval]);

  // Limpiar Consola e Inputs
  const handleClearLogs = () => {
    setCurrentFilter('');
    setLocalSearchQuery('');
    setActiveLevels(new Set(LOG_LEVELS));
    setActiveConnectionFilters(new Set(connections.map(c => c.id)));
    setLogs([]);
    setRawSqlResult(null);
    showToast('Consola e inputs restablecidos', 'info');
  };

  // Guardar/editar consulta personalizada
  const handleSaveQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryNameInput.trim()) return;

    try {
      const payload = {
        id: editingQuery?.id,
        name: queryNameInput.trim(),
        filter: queryFilterInput,
        alertConfig: editingQuery?.alertConfig,
        conexionesIds: editingQuery?.conexionesIds
      };

      const res = await fetch('/api/seq/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(editingQuery ? 'Consulta actualizada con éxito' : 'Consulta guardada con éxito', 'success');
        setIsSaveQueryModalOpen(false);
        setEditingQuery(null);
        setQueryNameInput('');
        setQueryFilterInput('');
        fetchSavedQueries();
      } else {
        const err = await res.json();
        showToast(`Error al guardar: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al guardar consulta: ${err.message}`, 'error');
    }
  };

  // Borrar consulta guardada
  const handleDeleteQuery = (id: string) => {
    const targetQuery = savedQueries.find(q => q.id === id);
    const qName = targetQuery ? `"${targetQuery.name}"` : 'esta consulta';
    triggerConfirm(
      'Eliminar Consulta Guardada',
      `¿Seguro que deseas eliminar la consulta guardada ${qName}?`,
      'Eliminar',
      async () => {
        try {
          const res = await fetch(`/api/seq/queries?id=${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            showToast('Consulta guardada eliminada', 'info');
            fetchSavedQueries();
          } else {
            showToast('Error al eliminar consulta', 'error');
          }
        } catch (err: any) {
          showToast(`Error: ${err.message}`, 'error');
        }
      }
    );
  };

  // Guardar la configuración de la alerta para una consulta guardada
  const handleSaveAlertConfig = async () => {
    if (!selectedQueryForAlert) return;
    
    try {
      const payload = {
        id: selectedQueryForAlert.id,
        name: selectedQueryForAlert.name,
        filter: alertQueryFilter,
        alertConfig: {
          timeWindowMinutes: alertConfig.timeWindowMinutes,
          clientEventsThreshold: alertConfig.clientEventsThreshold,
          serverEventsThreshold: alertConfig.serverEventsThreshold,
          serverClientsThreshold: alertConfig.serverClientsThreshold,
          includeVersion: alertConfig.includeVersion,
          includeApp: alertConfig.includeApp,
          includeHostname: alertConfig.includeHostname,
          includeCliente: alertConfig.includeCliente,
          isActive: alertConfig.isActive
        }
      };

      const res = await fetch('/api/seq/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Configuración de alerta y consulta para "${selectedQueryForAlert.name}" guardada`, 'success');
        fetchSavedQueries();
      } else {
        const err = await res.json();
        showToast(`Error al guardar configuración: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleUpdateSimulation = async () => {
    setIsLoadingLogs(true);
    try {
      stateRef.current.currentFilter = alertQueryFilter;
      setCurrentFilter(alertQueryFilter);
      await fetchLogs(false);
      showToast('Simulación actualizada con los nuevos logs', 'success');
    } catch (e: any) {
      showToast(`Error al actualizar simulación: ${e.message}`, 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleUpdateAndSaveQuery = async () => {
    if (!selectedQueryForAlert) return;
    
    setIsLoadingLogs(true);
    try {
      const payload = {
        id: selectedQueryForAlert.id,
        name: selectedQueryForAlert.name,
        filter: alertQueryFilter,
        alertConfig: selectedQueryForAlert.alertConfig
      };

      const res = await fetch('/api/seq/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        stateRef.current.currentFilter = alertQueryFilter;
        setCurrentFilter(alertQueryFilter);
        await fetchLogs(false);
        showToast('Consulta guardada y simulación actualizada', 'success');
        fetchSavedQueries();
      } else {
        const err = await res.json();
        showToast(`Error al guardar: ${err.error}`, 'error');
      }
    } catch (e: any) {
      showToast(`Error al guardar y actualizar consulta: ${e.message}`, 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!selectedQueryForAlert || logs.length === 0) {
      showToast('No hay logs evaluados para descargar', 'error');
      return;
    }

    const sanitizeCsvCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      str = str.replace(/[\r\n]+/g, ' ');
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const stringifyValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val;
      try {
        return JSON.stringify(val);
      } catch (e) {
        return String(val);
      }
    };

    const headers = [
      'Timestamp',
      'Origen_Conexion',
      'Cliente',
      'Hostname',
      'App',
      'Version',
      'Destino_Detectado',
      'Clasificacion',
      'Mensaje_Error',
      'Excepcion'
    ];

    // Aplanar los logs para la descarga y evitar errores de tipado en propiedades dinámicas
    const flattenedLogs = logs.map(log => {
      const flat: { [key: string]: any } = {
        Timestamp: log.Timestamp,
        Level: log.Level,
        Message: log.RenderedMessage || log.MessageTemplate || '',
        Exception: log.Exception || '',
        Origen: log.connectionName || 'Desconocido',
      };
      if (log.Properties) {
        log.Properties.forEach(p => {
          flat[p.Name] = p.Value;
        });
      }
      return flat;
    });

    const rows = flattenedLogs.map(log => {
      const message = stringifyValue(log.Message);
      const exception = stringifyValue(log.Exception);
      const hostname = log.Hostname || log._hostname || log.hostname || 'Desconocido';
      const cliente = log.Cliente || log._cliente || log.cliente || 'Desconocido';
      const app = log.App || log._app || log.app || 'Desconocido';
      const version = log.Version || log._version || log.version || 'Desconocido';
      const origenConexion = log.Origen || 'Desconocido';

      let statusCode = null;
      const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                            exception.match(/StatusCode=(\d+)/) || 
                            message.match(/(\d{3})/);
      if (statusCodeMatch) {
        statusCode = parseInt(statusCodeMatch[1]);
      }

      let destino = 'Desconocido';
      const requestUriMatch = exception.match(/RequestUri[\\":=\s]+(https?:\/\/[^\s'",\ ]+)/) ||
                            exception.match(/"RequestUri"\s*:\s*"([^"]+)"/) || 
                            exception.match(/RequestUri=([^,\s]+)/) ||
                            message.match(/(https?:\/\/[^\s'"]+)/);
      if (requestUriMatch) {
        destino = requestUriMatch[1];
      }

      let isClient = false;
      let isServer = false;

      if (statusCode) {
        if (statusCode >= 400 && statusCode < 500) {
          isClient = true;
        } else if (statusCode >= 500) {
          isServer = true;
        }
      }

      if (!isClient && !isServer) {
        const msgLower = message.toLowerCase();
        const excLower = exception.toLowerCase();
        
        if (excLower.includes('timeout') || msgLower.includes('timeout') || msgLower.includes('tiempo de espera')) {
          isServer = true;
        } else if (excLower.includes('conexión') || excLower.includes('conexion') || 
                   excLower.includes('connectfailure') || excLower.includes('httprequestexception') || 
                   msgLower.includes('conexión') || msgLower.includes('conexion') || msgLower.includes('failed to connect')) {
          isServer = true;
        } else if (excLower.includes('bad request') || msgLower.includes('bad request')) {
          isClient = true;
        } else if (excLower.includes('not found') || msgLower.includes('not found')) {
          isClient = true;
        }
      }

      if (isServer) {
        const DOMINIOS_INFRAESTRUCTURA = [
          'api-colombia.mysatcomla.com',
          'webapi.mysatcomla.com',
          'api-app-prod.mysatcomla.com'
        ];
        const esDestinoCloud = DOMINIOS_INFRAESTRUCTURA.some(dom => destino.toLowerCase().includes(dom));
        if (!esDestinoCloud) {
          isClient = true;
          isServer = false;
        }
      }

      const clasificacion = isServer ? 'SERVIDOR (Infraestructura Cloud)' : (isClient ? 'CLIENTE (Mesa de Ayuda)' : 'OK / Indeterminado');

      return [
        log.Timestamp || new Date().toISOString(),
        origenConexion,
        cliente,
        hostname,
        app,
        version,
        destino,
        clasificacion,
        message,
        exception
      ].map(sanitizeCsvCell).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const formattedDate = new Date().toISOString().substring(0, 10);
    const fileName = `Simulacion_Alertas_${selectedQueryForAlert.name.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    showToast(`Archivo CSV de simulación descargado`, 'success');
  };

  // Descargar el resumen completo del análisis en formato JSON
  const handleDownloadAnalysisJson = () => {
    if (!simulatedResult) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(simulatedResult, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    
    const formattedDate = new Date().toISOString().substring(0, 10);
    const queryName = selectedQueryForAlert ? selectedQueryForAlert.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Consola';
    downloadAnchor.setAttribute('download', `Analisis_Alertas_${queryName}_${formattedDate}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Resumen del análisis descargado en JSON', 'success');
  };

  // Filtrar y crear consulta de Seq a partir de un cliente y hostname del resultado
  const handleFilterByOrigin = (cliente: string, hostname: string) => {
    if ((!cliente || cliente === 'Desconocido') && (!hostname || hostname === 'Desconocido')) {
      showToast('No se puede filtrar por origen Desconocido', 'warning');
      return;
    }
    
    setLocalFilterOrigin({ cliente, hostname });
    setLocalFilterDestino(null);
    setLocalFilterMessage(null);
    setLocalFilterId(null);
    setShowLiveAnalysisPanel(false);
    showToast(`Filtrando localmente por origen: ${cliente} / ${hostname}`, 'success');
  };

  // Filtrar y crear consulta de Seq a partir de un destino (API) del resultado
  const handleFilterByDestino = (destino: string) => {
    if (!destino || destino === 'Desconocido') {
      showToast('No se puede filtrar por destino Desconocido', 'warning');
      return;
    }
    
    setLocalFilterDestino(destino);
    setLocalFilterOrigin(null);
    setLocalFilterMessage(null);
    setLocalFilterId(null);
    setShowLiveAnalysisPanel(false);
    showToast(`Filtrando localmente por destino: ${destino}`, 'success');
  };

  // Filtrar y crear consulta de Seq a partir de un fragmento de mensaje de error
  const handleFilterByMessage = (message: string) => {
    if (!message) return;
    
    setLocalFilterMessage(message);
    setLocalFilterOrigin(null);
    setLocalFilterDestino(null);
    setLocalFilterId(null);
    setShowLiveAnalysisPanel(false);
    showToast(`Filtrando localmente por mensaje de error`, 'success');
  };

  // Filtrar y buscar un ID de evento específico en todas las conexiones seleccionadas
  const handleFilterById = (eventId: string) => {
    if (!eventId) return;
    
    setLocalFilterId(eventId);
    setLocalFilterOrigin(null);
    setLocalFilterDestino(null);
    setLocalFilterMessage(null);
    setShowLiveAnalysisPanel(false);
    showToast(`Filtrando localmente por Event ID: ${eventId}`, 'success');
  };

  // Agregar consulta al historial de ejecuciones (máximo 100, sin duplicados)
  const addToHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistoryQueries(prev => {
      const filtered = prev.filter(q => q.query !== trimmed);
      const newHistory = [{ query: trimmed, timestamp: timeStr }, ...filtered].slice(0, 100);
      localStorage.setItem('seq_monitor_query_history_v2', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Eliminar una consulta del historial rápidamente
  const handleDeleteHistoryQuery = (queryToDelete: string) => {
    setHistoryQueries(prev => {
      const updated = prev.filter(q => q.query !== queryToDelete);
      localStorage.setItem('seq_monitor_query_history_v2', JSON.stringify(updated));
      return updated;
    });
    showToast('Consulta eliminada del historial', 'info');
  };

  // Copiar log completo (JSON) al portapapeles
  const handleCopyLog = (log: SeqLog) => {
    const propertiesData: { [key: string]: any } = {};
    if (log.Properties) {
      log.Properties.forEach(p => {
        propertiesData[p.Name] = p.Value;
      });
    }
    if (log.Exception) {
      propertiesData['@Exception'] = log.Exception;
    }
    if (log.MessageTemplate && log.RenderedMessage !== log.MessageTemplate) {
      propertiesData['@MessageTemplate'] = log.MessageTemplate;
    }

    const rawLog = {
      Id: log.Id,
      Timestamp: log.Timestamp,
      Level: log.Level || 'Information',
      MessageTemplate: log.MessageTemplate,
      RenderedMessage: log.RenderedMessage,
      Properties: propertiesData
    };

    navigator.clipboard.writeText(JSON.stringify(rawLog, null, 2))
      .then(() => showToast('Log copiado al portapapeles', 'success'))
      .catch(err => showToast(`Error al copiar: ${err.message}`, 'error'));
  };

  // Aplica los límites de tiempo seleccionados (o por defecto 3 horas) a una consulta SQL select
  const applyTimeLimitsToQuery = (query: string): string => {
    const trimmed = query.trim();
    if (!trimmed.toLowerCase().startsWith('select ')) {
      return query;
    }

    let timeFilterExpr = '';
    const timeFilters: string[] = [];
    if (queryStartTime) {
      timeFilters.push(`@Timestamp >= DateTime('${queryStartTime}:00Z')`);
    }
    if (queryEndTime) {
      timeFilters.push(`@Timestamp <= DateTime('${queryEndTime}:00Z')`);
    }

    if (timeFilters.length > 0) {
      timeFilterExpr = timeFilters.join(' and ');
    } else {
      // Verificar si ya tiene filtro de tiempo
      const hasTimeFilter = /@timestamp/i.test(trimmed) || /\btime\b(?!\s*\()/i.test(trimmed);
      if (hasTimeFilter) {
        return query;
      }
      timeFilterExpr = "@Timestamp >= now() - 3h";
    }

    // Buscar si tiene la palabra clave WHERE
    const whereMatch = trimmed.match(/\bwhere\b/i);
    if (whereMatch) {
      // Si tiene WHERE, insertamos el filtro de tiempo justo después del WHERE
      const index = whereMatch.index! + whereMatch[0].length;
      const before = trimmed.substring(0, index);
      const after = trimmed.substring(index);
      return `${before} ${timeFilterExpr} and${after}`;
    } else {
      // Si no tiene WHERE, lo insertamos después del FROM <tabla>
      const fromMatch = trimmed.match(/\bfrom\s+([a-zA-Z0-9_"`'@.-]+)/i);
      if (fromMatch) {
        const index = fromMatch.index! + fromMatch[0].length;
        const before = trimmed.substring(0, index);
        const after = trimmed.substring(index);
        return `${before} where ${timeFilterExpr}${after}`;
      }
    }

    return query;
  };

  // Modifica el script si es necesario agregando el filtro de tiempo de 3 horas por defecto y ejecuta
  const handleExecuteQuery = () => {
    clearLocalFilters();
    const cleanedQuery = cleanFilterPrefix(currentFilter);
    let queryToRun = cleanedQuery;
    if (queryToRun && queryToRun.trim().toLowerCase().startsWith('select ')) {
      const modifiedQuery = applyTimeLimitsToQuery(queryToRun);
      if (modifiedQuery !== queryToRun) {
        queryToRun = modifiedQuery;
        // Si originalmente tenía prefijo, mantenerlo al guardar en el estado
        const colonIndex = currentFilter.indexOf(':');
        if (colonIndex !== -1 && currentFilter.substring(colonIndex + 1).trim().toLowerCase().startsWith('select ')) {
          const prefix = currentFilter.substring(0, colonIndex + 1);
          setCurrentFilter(`${prefix} ${modifiedQuery}`);
        }
      }
    }
    fetchLogs(false);
  };

  // Inyecta la condición "and @Timestamp >= now() - 3h" respetando las cláusulas WHERE y GROUP BY
  const handleInjectTimeFilter = () => {
    const trimmed = currentFilter.trim();
    if (!trimmed) {
      const newFilter = "@Timestamp >= now() - 3h";
      setCurrentFilter(newFilter);
      stateRef.current.currentFilter = newFilter;
      showToast("Filtro de tiempo de 3 horas inyectado", "success");
      return;
    }

    if (!trimmed.toLowerCase().startsWith('select ')) {
      // Si es un filtro simple, simplemente concatenamos con "and" si no lo contiene ya
      if (/@timestamp\s*>=/i.test(trimmed)) {
        showToast("El filtro ya contiene un límite de @Timestamp", "info");
        return;
      }
      const newFilter = `${trimmed} and @Timestamp >= now() - 3h`;
      setCurrentFilter(newFilter);
      stateRef.current.currentFilter = newFilter;
      showToast("Filtro de tiempo de 3 horas inyectado", "success");
      return;
    }

    // Si es SQL
    if (/@timestamp\s*>=/i.test(trimmed)) {
      showToast("La consulta SQL ya contiene un límite de @Timestamp", "info");
      return;
    }

    const groupByMatch = trimmed.match(/\bgroup\s+by\b/i);
    let queryPartBeforeGroupBy = trimmed;
    let queryPartAfterGroupBy = '';

    if (groupByMatch) {
      const index = groupByMatch.index!;
      queryPartBeforeGroupBy = trimmed.substring(0, index).trim();
      queryPartAfterGroupBy = ' ' + trimmed.substring(index).trim();
    }

    let modifiedQueryBefore = '';
    const whereMatchInBefore = queryPartBeforeGroupBy.match(/\bwhere\b/i);

    if (whereMatchInBefore) {
      // Si ya tiene cláusula WHERE, concatenamos con AND al final de esa sección
      modifiedQueryBefore = `${queryPartBeforeGroupBy} and @Timestamp >= now() - 3h`;
    } else {
      // Si no tiene cláusula WHERE, debemos insertarla después del FROM
      const fromMatch = queryPartBeforeGroupBy.match(/\bfrom\s+([a-zA-Z0-9_"`'@.-]+)/i);
      if (fromMatch) {
        const index = fromMatch.index! + fromMatch[0].length;
        const beforeFrom = queryPartBeforeGroupBy.substring(0, index);
        const afterFrom = queryPartBeforeGroupBy.substring(index);
        modifiedQueryBefore = `${beforeFrom} where @Timestamp >= now() - 3h${afterFrom}`;
      } else {
        modifiedQueryBefore = `${queryPartBeforeGroupBy} where @Timestamp >= now() - 3h`;
      }
    }

    const finalQuery = `${modifiedQueryBefore}${queryPartAfterGroupBy}`;
    setCurrentFilter(finalQuery);
    stateRef.current.currentFilter = finalQuery;
    showToast("Filtro de tiempo de 3 horas inyectado en SQL", "success");
  };

  // Parsear el resultado de la consulta SQL para consumo del LineChart de Recharts
  const parseSqlChartData = (columns: string[], rows: any[][]) => {
    const timeIndex = columns.findIndex(c => c.toLowerCase() === 'time' || c.toLowerCase() === '@timestamp');
    const xAxisIndex = timeIndex !== -1 ? timeIndex : 0;
    
    const numericIndices: number[] = [];
    const categoryIndices: number[] = [];
    
    columns.forEach((col, idx) => {
      if (idx === xAxisIndex) return;
      
      let isNumeric = true;
      let hasValues = false;
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const val = rows[r][idx];
        if (val !== null && val !== undefined && val !== '') {
          hasValues = true;
          if (isNaN(Number(val))) {
            isNumeric = false;
            break;
          }
        }
      }
      
      if (isNumeric && hasValues) {
        numericIndices.push(idx);
      } else {
        categoryIndices.push(idx);
      }
    });

    const chartDataMap: { [key: string]: any } = {};
    const seriesSet = new Set<string>();
    
    rows.forEach(row => {
      const xVal = row[xAxisIndex];
      let timeLabel = String(xVal);
      
      const parsedDate = Date.parse(xVal);
      if (!isNaN(parsedDate)) {
        const date = new Date(parsedDate);
        timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      
      if (!chartDataMap[xVal]) {
        chartDataMap[xVal] = {
          xAxisVal: xVal,
          timeLabel: timeLabel
        };
      }
      
      if (categoryIndices.length > 0) {
        // Combinar todos los valores de categoría en un solo string identificador de serie
        const catVal = categoryIndices
          .map(catIdx => String(row[catIdx] ?? '').trim())
          .filter(Boolean)
          .join(' | ') || 'General';

        numericIndices.forEach(numIdx => {
          const seriesName = numericIndices.length > 1 
            ? `${catVal} (${columns[numIdx]})`
            : catVal;
          
          chartDataMap[xVal][seriesName] = Number(row[numIdx] ?? 0);
          seriesSet.add(seriesName);
        });
      } else {
        numericIndices.forEach(numIdx => {
          const seriesName = columns[numIdx];
          chartDataMap[xVal][seriesName] = Number(row[numIdx] ?? 0);
          seriesSet.add(seriesName);
        });
      }
    });
    
    const chartData = Object.values(chartDataMap).sort((a, b) => {
      const timeA = Date.parse(a.xAxisVal);
      const timeB = Date.parse(b.xAxisVal);
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
      return String(a.xAxisVal).localeCompare(String(b.xAxisVal));
    });
    
    return {
      chartData,
      seriesList: Array.from(seriesSet)
    };
  };

  // Descargar el resultado de la consulta actual en formato JSON
  const handleDownloadSqlJson = () => {
    if (!rawSqlResult) return;
    const dataObjects = rawSqlResult.rows.map(row => {
      const obj: { [key: string]: any } = {};
      rawSqlResult.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    const jsonContent = JSON.stringify(dataObjects, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    let name = downloadFileName.trim() || 'resultado_consulta';
    if (name.endsWith('.csv')) {
      name = name.slice(0, -4);
    }
    if (!name.endsWith('.json')) name += '.json';
    downloadAnchor.setAttribute("download", name);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Archivo ${name} descargado`, 'success');
  };

  // Descargar el resultado de la consulta actual en formato CSV
  const handleDownloadSqlCsv = () => {
    if (!rawSqlResult) return;
    
    // Generar cabecera y filas en formato CSV
    const headers = rawSqlResult.columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',');
    const rowsCsv = rawSqlResult.rows.map(row => {
      return row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const cellStr = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
        return `"${cellStr.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headers, ...rowsCsv].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    let name = downloadFileName.trim() || 'resultado_consulta';
    if (name.endsWith('.json')) {
      name = name.slice(0, -5);
    }
    if (!name.endsWith('.csv')) name += '.csv';
    downloadAnchor.setAttribute("download", name);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Archivo ${name} descargado`, 'success');
  };

  // Descargar todos los logs tradicionales (no SQL agregados) que se muestran actualmente
  const handleDownloadAllLogsJson = () => {
    if (filteredLogs.length === 0) return;
    const formatted = filteredLogs.map(log => {
      const propertiesData: { [key: string]: any } = {};
      if (log.Properties) {
        log.Properties.forEach(p => {
          propertiesData[p.Name] = p.Value;
        });
      }
      if (log.Exception) {
        propertiesData['@Exception'] = log.Exception;
      }
      if (log.MessageTemplate && log.RenderedMessage !== log.MessageTemplate) {
        propertiesData['@MessageTemplate'] = log.MessageTemplate;
      }
      return {
        Id: log.Id,
        Timestamp: log.Timestamp,
        Level: log.Level || 'Information',
        MessageTemplate: log.MessageTemplate,
        RenderedMessage: log.RenderedMessage,
        Properties: propertiesData
      };
    });

    const jsonContent = JSON.stringify(formatted, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    let name = downloadFileName.trim() || 'resultados_logs';
    if (name.endsWith('.csv')) {
      name = name.slice(0, -4);
    }
    if (!name.endsWith('.json')) name += '.json';
    downloadAnchor.setAttribute("download", name);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Archivo ${name} con ${filteredLogs.length} logs descargado`, 'success');
  };

  // Expandir / colapsar log
  const toggleLogExpand = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Limpiar nombres de propiedades de funciones SQL agregadas (como distinct)
  const cleanPropertyName = (name: string): string => {
    let clean = name.trim();
    
    // Quitar comillas si las hay
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.substring(1, clean.length - 1).trim();
    }
    if (clean.startsWith("'") && clean.endsWith("'")) {
      clean = clean.substring(1, clean.length - 1).trim();
    }

    // Quitar cualquier "distinct" al inicio o dentro, con o sin paréntesis o espacios
    // Ej: "distinct _ambiente", "distinct(_ambiente)", "(distinct _ambiente)", "(distinct(_ambiente))"
    const distinctPattern = /distinct\s*\(?\s*([a-zA-Z0-9_@]+)\s*\)?/i;
    const match = clean.match(distinctPattern);
    if (match) {
      clean = match[1];
    } else {
      // Si no coincide con el patrón anterior, limpiamos todos los paréntesis y palabras clave
      clean = clean.replace(/distinct/gi, '').trim();
      clean = clean.replace(/[()]/g, '').trim();
    }
    
    // Convertir a minúsculas si no empieza por @ (para normalizar propiedades como _CLIENTE o CLIENTE a minúsculas)
    if (!clean.startsWith('@')) {
      clean = clean.toLowerCase();
    }
    
    return clean;
  };

  // Alternar visibilidad de una serie en la leyenda de la gráfica
  const handleLegendClick = (props: any) => {
    const seriesName = props.dataKey || props.value;
    if (!seriesName) return;
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(seriesName)) next.delete(seriesName);
      else next.add(seriesName);
      return next;
    });
  };

  // Formatear texto de la leyenda (tachar/atenuar si está oculta)
  const renderLegendText = (value: string) => {
    const isHidden = hiddenSeries.has(value);
    return (
      <span className="cursor-pointer select-none transition-all duration-200 text-neutral-300 hover:text-white">
        <span className={isHidden ? 'line-through opacity-35 text-neutral-500 font-normal' : 'text-neutral-200 font-semibold'}>
          {value}
        </span>
      </span>
    );
  };

  // Buscar eventos por una propiedad de forma acumulativa
  const handleSearchProperty = (name: string, value: any) => {
    const cleanName = cleanPropertyName(name);
    let formattedValue = '';
    if (value === null || value === undefined) {
      formattedValue = 'null';
    } else if (typeof value === 'boolean') {
      formattedValue = value ? 'true' : 'false';
    } else if (typeof value === 'number') {
      formattedValue = String(value);
    } else {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      formattedValue = `'${stringValue.replace(/'/g, "\\'")}'`;
    }

    const cond = `${cleanName} = ${formattedValue}`;
    let newFilter = '';

    if (!currentFilter || currentFilter === '*' || currentFilter.trim() === '') {
      newFilter = `has(${cleanName}) and ${cond}`;
    } else {
      // Limpiar filtros SQL anteriores en la query acumulativa si el filtro anterior era una consulta SQL de datos
      let filterBase = currentFilter;
      if (filterBase.trim().toLowerCase().startsWith('select ')) {
        filterBase = '';
      }

      if (filterBase === '') {
        newFilter = `has(${cleanName}) and ${cond}`;
      } else {
        if (filterBase.includes(cond)) {
          showToast(`El filtro ya contiene la condición: ${cond}`, 'info');
          return;
        }
        newFilter = `${filterBase} and ${cond}`;
      }
    }

    setCurrentFilter(newFilter);
    showToast(`Filtro actualizado: ${newFilter}`, 'success');

    if (connectionStatus === 'connected') {
      setTimeout(() => {
        stateRef.current.currentFilter = newFilter;
        fetchLogs(false);
      }, 50);
    }
  };

  // Buscar otros valores distintos para una propiedad (select distinct)
  const handleSearchOthers = (name: string) => {
    const cleanName = cleanPropertyName(name);
    const newFilter = `select distinct(${cleanName}) from stream`;
    setCurrentFilter(newFilter);
    showToast(`Buscando valores distintos de: ${cleanName}`, 'success');

    if (connectionStatus === 'connected') {
      setTimeout(() => {
        stateRef.current.currentFilter = newFilter;
        fetchLogs(false);
      }, 50);
    }
  };

  // Formateador JSON para propiedades
  const renderHighlightedJson = (properties: SeqLogProperty[], exception?: string, template?: string) => {
    const propertiesData: { [key: string]: any } = {};
    if (properties) {
      properties.forEach(p => {
        propertiesData[p.Name] = p.Value;
      });
    }
    if (exception) propertiesData['@Exception'] = exception;
    if (template) propertiesData['@MessageTemplate'] = template;

    const jsonString = JSON.stringify(propertiesData, null, 2);
    
    // Highlight sintáctico simple por expresiones regulares
    const tokens = jsonString.split(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/);
    
    return (
      <code className="text-xs font-mono block whitespace-pre overflow-x-auto text-[#ababab]">
        {tokens.map((token, index) => {
          if (!token) return null;
          
          let className = 'text-neutral-300';
          if (/^"/.test(token)) {
            if (/:$/.test(token)) {
              className = 'text-[#71BF44] font-medium'; // Llaves verdes corporativas
            } else {
              className = 'text-sky-300'; // Strings azules
            }
          } else if (/true|false/.test(token)) {
            className = 'text-emerald-400 font-bold'; // Booleanos
          } else if (/null/.test(token)) {
          className = 'text-red-400 italic'; // Nulls
          } else if (/^\d+/.test(token)) {
            className = 'text-amber-400'; // Números
          }
          
          return <span key={index} className={className}>{token}</span>;
        })}
      </code>
    );
  };

  const simulatedResult = useMemo(() => {
    if (logs.length === 0) {
      return {
        consultaEvaluada: currentFilter,
        alertaGenerada: false,
        resumen: {
          totalErroresEvaluados: 0,
          totalErroresCliente: 0,
          totalErroresServidor: 0,
          ventanaEvaluacionMinutos: alertConfig.timeWindowMinutes,
          alertaClienteCritico: false,
          alertaServidorGlobal: false
        },
        alertasMesaDeAyuda: [] as any[],
        alertasInfraestructura: [] as any[]
      };
    }

    const VENTANA_TIEMPO_MINUTOS = alertConfig.timeWindowMinutes;
    const UMBRAL_CLIENTE_EVENTOS = alertConfig.clientEventsThreshold;
    const UMBRAL_SERVIDOR_EVENTOS = alertConfig.serverEventsThreshold;
    const UMBRAL_SERVIDOR_CLIENTES = alertConfig.serverClientsThreshold;

    // Helper para serializar valores complejos evitando [object Object]
    const stringifyValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val;
      try {
        return JSON.stringify(val);
      } catch (e) {
        return String(val);
      }
    };

    // Helper de limpieza genérica de mensajes
    const getGenericMessage = (msg: string, exc: string) => {
      let clean = msg || '';
      if (exc) {
        const firstLine = exc.split('\n')[0].trim();
        if (firstLine) {
          clean = firstLine;
        }
      }
      clean = clean.replace(/FLIP-[A-Za-z0-9\-+\[\]]+/g, 'FLIP-[ARCHIVO]');
      clean = clean.replace(/\b\d{6,}\b/g, '[ID]');
      clean = clean.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[GUID]');
      clean = clean.replace(/https?:\/\/[^\s'"]+/g, '[URL]');
      return clean.substring(0, 150).trim();
    };

    // Aplanar los logs para simulación
    const flattenedLogs = logs.map(log => {
      const flat: { [key: string]: any } = {
        Timestamp: log.Timestamp,
        Level: log.Level,
        Message: log.RenderedMessage || log.MessageTemplate || '',
        Exception: log.Exception || '',
        Origen: log.connectionName || 'Desconocido',
        Id: log.Id
      };
      if (log.Properties) {
        log.Properties.forEach(p => {
          flat[p.Name] = p.Value;
        });
      }
      return flat;
    });

    // Agrupamientos
    const clientGroups: { [key: string]: any } = {};
    const serverGroups: { [key: string]: any } = {};

    let totalErrores = 0;
    let erroresClienteCount = 0;
    let erroresServidorCount = 0;

    flattenedLogs.forEach(log => {
      const message = stringifyValue(log.Message);
      const exception = stringifyValue(log.Exception);

      // Filtro local por texto en el tablero de análisis
      if (analysisErrorTextFilter.trim() !== '') {
        const searchTerm = analysisErrorTextFilter.toLowerCase();
        const msgMatch = message.toLowerCase().includes(searchTerm);
        const excMatch = exception.toLowerCase().includes(searchTerm);
        const clientMatch = String(log.Cliente || log._cliente || '').toLowerCase().includes(searchTerm);
        const hostMatch = String(log.Hostname || log._hostname || '').toLowerCase().includes(searchTerm);
        if (!msgMatch && !excMatch && !clientMatch && !hostMatch) {
          return;
        }
      }

      const hostname = log.Hostname || log._hostname || log.hostname || 'Desconocido';
      const cliente = log.Cliente || log._cliente || log.cliente || 'Desconocido';
      const app = log.App || log._app || log.app || 'Desconocido';
      const version = log.Version || log._version || log.version || 'Desconocido';
      const origenConexion = log.Origen || 'Desconocido';
      const eventId = log.Id || log['@Id'];

      const ignored = isErrorIgnored(message, exception, log);

      // Buscar la URL del origen en el array de connections para construir el permalink
      const matchingConn = connections.find(c => c.name === origenConexion);
      const baseUrl = matchingConn ? matchingConn.url : 'http://logs-sender.mysatcomla.com:5341';
      const seqPermalink = eventId 
        ? `https://dashboard-one-ivory-58.vercel.app/api/seq/public-event?id=${eventId}&origen=${encodeURIComponent(origenConexion)}`
        : '';

      // Buscar StatusCode en Exception o Message
      let statusCode = null;
      const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                            exception.match(/StatusCode=(\d+)/) || 
                            message.match(/(\d{3})/);
      if (statusCodeMatch) {
        statusCode = parseInt(statusCodeMatch[1]);
      }

      // Buscar Destino (RequestUri) en Exception o Message
      let destino = 'Desconocido';
      const requestUriMatch = exception.match(/RequestUri[\\":=\s]+(https?:\/\/[^\s'",\ ]+)/) ||
                            exception.match(/"RequestUri"\s*:\s*"([^"]+)"/) || 
                            exception.match(/RequestUri=([^,\s]+)/) ||
                            message.match(/(https?:\/\/[^\s'"]+)/);
      if (requestUriMatch) {
        destino = requestUriMatch[1];
      }

      let isClient = false;
      let isServer = false;

      // Clasificación por código HTTP
      if (statusCode) {
        if (statusCode >= 400 && statusCode < 500) {
          isClient = true;
        } else if (statusCode >= 500) {
          isServer = true;
        }
      }

      // Clasificación heurística
      if (!isClient && !isServer) {
        const msgLower = message.toLowerCase();
        const excLower = exception.toLowerCase();
        
        if (excLower.includes('timeout') || msgLower.includes('timeout') || msgLower.includes('tiempo de espera')) {
          isServer = true;
        } else if (excLower.includes('conexión') || excLower.includes('conexion') || 
                   excLower.includes('connectfailure') || excLower.includes('httprequestexception') || 
                   msgLower.includes('conexión') || msgLower.includes('conexion') || msgLower.includes('failed to connect')) {
          isServer = true;
        } else if (excLower.includes('bad request') || msgLower.includes('bad request')) {
          isClient = true;
        } else if (excLower.includes('not found') || msgLower.includes('not found')) {
          isClient = true;
        }
      }

      // Clasificación de eventos RabbitMQ
      const esRabbit = message.toLowerCase().includes('rabbit') || 
                        exception.toLowerCase().includes('rabbit') || 
                        log.Cola || 
                        log.Consumer || 
                        log.NombreCola;
                        
      if (esRabbit) {
        isServer = true;
      }

      // Clasificación de Warnings/Errors con excepción en propiedades o estructura
      let tieneExcepcion = exception.trim() !== '';
      if (!tieneExcepcion) {
        for (const key in log) {
          if (key.toLowerCase().includes('exception') && log[key]) {
            tieneExcepcion = true;
            break;
          }
        }
      }

      if (!isClient && !isServer && tieneExcepcion) {
        isServer = true;
      }

      // Desviar alertas de infraestructura si el dominio no es administrado por infraestructura cloud
      if (isServer) {
        const DOMINIOS_INFRAESTRUCTURA = [
          'api-colombia.mysatcomla.com',
          'webapi.mysatcomla.com',
          'api-app-prod.mysatcomla.com'
        ];
        const esDestinoCloud = DOMINIOS_INFRAESTRUCTURA.some(dom => destino.toLowerCase().includes(dom));
        if (!esDestinoCloud) {
          isClient = true;
          isServer = false;
        }
      }

      if (!ignored) totalErrores++;

      const buildSeqQuery = (originalFilter: string, cl: string, hn: string): string => {
        const cleanFilter = originalFilter ? originalFilter.trim() : '';
        const filterPart = cleanFilter ? `(${cleanFilter})` : '';
        
        const clientPart = cl && cl !== 'Desconocido'
          ? `(Cliente = '${cl}' or _cliente = '${cl}')`
          : '';
          
        const hostPart = hn && hn !== 'Desconocido'
          ? `(Hostname = '${hn}' or _hostname = '${hn}')`
          : '';
          
        const parts = [filterPart, clientPart, hostPart].filter(Boolean);
        return parts.join(' and ');
      };

      const payloadComun = {
        id: eventId,
        timestamp: log.Timestamp || new Date().toISOString(),
        mensajeError: message,
        excepcion: exception,
        destino: destino,
        version: alertConfig.includeVersion ? version : undefined,
        app: alertConfig.includeApp ? app : undefined,
        hostname: alertConfig.includeHostname ? hostname : undefined,
        cliente: alertConfig.includeCliente ? cliente : undefined,
        origenConsulta: `Seq (Origen: ${log.Origen || 'Desconocido'}, Consulta: ${selectedQueryForAlert?.name || 'Consola en vivo'})`,
        seqQuery: buildSeqQuery(alertQueryFilter || selectedQueryForAlert?.filter || currentFilter, cliente, hostname),
        seqPermalink: seqPermalink
      };

      const genericMsg = getGenericMessage(message, exception);

      if (isClient) {
        if (!ignored) erroresClienteCount++;
        const key = `${cliente} | ${hostname}`;
        if (!clientGroups[key]) {
          clientGroups[key] = { cliente, hostname, eventos: 0, eventosNoIgnorados: 0, errores: {} };
        }
        clientGroups[key].eventos++;
        if (!ignored) {
          clientGroups[key].eventosNoIgnorados++;
        }
        if (!clientGroups[key].errores[genericMsg]) {
          clientGroups[key].errores[genericMsg] = { cantidad: 0, cantidadNoIgnorada: 0, isIgnored: ignored, ejemplo: payloadComun };
        }
        clientGroups[key].errores[genericMsg].cantidad++;
        if (!ignored) {
          clientGroups[key].errores[genericMsg].cantidadNoIgnorada++;
        }
      } else if (isServer) {
        if (!ignored) erroresServidorCount++;
        if (!serverGroups[cliente]) {
          serverGroups[cliente] = { cliente, hostname, eventos: 0, eventosNoIgnorados: 0, errores: {} };
        }
        serverGroups[cliente].eventos++;
        if (!ignored) {
          serverGroups[cliente].eventosNoIgnorados++;
        }
        if (!serverGroups[cliente].errores[genericMsg]) {
          serverGroups[cliente].errores[genericMsg] = { cantidad: 0, cantidadNoIgnorada: 0, isIgnored: ignored, ejemplo: payloadComun };
        }
        serverGroups[cliente].errores[genericMsg].cantidad++;
        if (!ignored) {
          serverGroups[cliente].errores[genericMsg].cantidadNoIgnorada++;
        }
      }
    });

    const alertasMesaDeAyuda: any[] = [];
    const alertasInfraestructura: any[] = [];
    let algunaAlertaMesaAyudaSuperada = false;
    let algunaAlertaInfraestructuraSuperada = false;

    // Evaluar Mesa de Ayuda (Cliente): Todos los orígenes
    for (const key in clientGroups) {
      const g = clientGroups[key];
      const esCloud = CLOUD_CLIENTS.has(g.cliente);
      const umbral = esCloud ? 100 : 20;
      const superaUmbral = g.eventosNoIgnorados > umbral;
      if (superaUmbral) {
        algunaAlertaMesaAyudaSuperada = true;
      }

      const erroresAgrupados: any[] = [];
      for (const msgKey in g.errores) {
        const errGroup = g.errores[msgKey];
        erroresAgrupados.push({
          errorGenerico: msgKey,
          cantidad: errGroup.cantidad,
          cantidadNoIgnorada: errGroup.cantidadNoIgnorada,
          isIgnored: errGroup.isIgnored,
          ejemplo: {
            destino: errGroup.ejemplo.destino,
            error: errGroup.ejemplo.mensajeError,
            version: errGroup.ejemplo.version,
            app: errGroup.ejemplo.app,
            origenConsulta: errGroup.ejemplo.origenConsulta,
            seqQuery: errGroup.ejemplo.seqQuery,
            seqPermalink: errGroup.ejemplo.seqPermalink,
            id: errGroup.ejemplo.id
          }
        });
      }

      alertasMesaDeAyuda.push({
        origen: `${g.cliente} / ${g.hostname}`,
        cliente: g.cliente,
        hostname: g.hostname,
        totalEventos: g.eventos,
        eventosNoIgnorados: g.eventosNoIgnorados,
        superaUmbral: superaUmbral,
        umbralDefinido: umbral,
        tipoOrigen: esCloud ? 'Cloud mySatcom' : 'Cliente Dedicado/Normal',
        erroresAgrupados: erroresAgrupados.slice(0, 1), // Sólo el primer error representativo
        ejemplo: erroresAgrupados[0]?.ejemplo || null,
        isIgnored: erroresAgrupados[0]?.isIgnored || false,
        mensaje: `Alerta Mesa de Ayuda: El origen ${g.cliente} en ${g.hostname} tiene ${g.eventosNoIgnorados} errores (Umbral: ${umbral}, Supera Umbral: ${superaUmbral}).`
      });
    }

    // Evaluar Infraestructura (Servidor): Todos los destinos
    const infraestructuraMap: { [key: string]: { destino: string, clientes: Set<string>, clientesNoIgnorados: Set<string>, totalEventos: number, totalEventosNoIgnorados: number, ejemplos: any[] } } = {};
    flattenedLogs.forEach(log => {
      let apiDestino = log.apiClientUrl || null;
      const exceptionStr = stringifyValue(log.Exception);
      const message = stringifyValue(log.Message);
      
      // Aplicar filtro de búsqueda de texto del tablero de análisis
      if (analysisErrorTextFilter.trim() !== '') {
        const searchTerm = analysisErrorTextFilter.toLowerCase();
        const msgMatch = message.toLowerCase().includes(searchTerm);
        const excMatch = exceptionStr.toLowerCase().includes(searchTerm);
        const clientMatch = String(log.Cliente || log._cliente || '').toLowerCase().includes(searchTerm);
        const hostMatch = String(log.Hostname || log._hostname || '').toLowerCase().includes(searchTerm);
        if (!msgMatch && !excMatch && !clientMatch && !hostMatch) {
          return;
        }
      }

      const ignored = isErrorIgnored(message, exceptionStr, log);
      const origenConexion = log.Origen || 'Desconocido';
      const matchingConn = connections.find(c => c.name === origenConexion);
      const baseUrl = matchingConn ? matchingConn.url : 'http://logs-sender.mysatcomla.com:5341';

      if (!apiDestino && exceptionStr) {
        const urlMatch = exceptionStr.match(/https?:\/\/[^\s/]+/i);
        if (urlMatch) apiDestino = urlMatch[0];
      }
      if (!apiDestino && exceptionStr && exceptionStr.includes('api-colombia.mysatcomla.com')) {
        apiDestino = 'https://api-colombia.mysatcomla.com';
      }
      if (apiDestino) {
        // Extraer host/dominio
        let destOrigin = apiDestino;
        try {
          if (destOrigin.startsWith('http://') || destOrigin.startsWith('https://')) {
            destOrigin = new URL(destOrigin).origin;
          }
        } catch (e) {}
        
        if (!infraestructuraMap[destOrigin]) {
          infraestructuraMap[destOrigin] = {
            destino: destOrigin,
            clientes: new Set(),
            clientesNoIgnorados: new Set(),
            totalEventos: 0,
            totalEventosNoIgnorados: 0,
            ejemplos: []
          };
        }
        
        const clientVal = log.Cliente || log._cliente || 'Desconocido';
        infraestructuraMap[destOrigin].clientes.add(clientVal);
        infraestructuraMap[destOrigin].totalEventos++;

        if (!ignored) {
          infraestructuraMap[destOrigin].clientesNoIgnorados.add(clientVal);
          infraestructuraMap[destOrigin].totalEventosNoIgnorados++;
        }
        
        if (infraestructuraMap[destOrigin].ejemplos.length < 1) {
          // Guardar solo un ejemplo simplificado
          infraestructuraMap[destOrigin].ejemplos.push({
            timestamp: log.Timestamp || new Date().toISOString(),
            mensajeError: log.Message,
            destino: destOrigin,
            cliente: clientVal,
            version: log.Version || log._version,
            app: log.App || log._app,
            hostname: log.Hostname || log._hostname,
            isIgnored: ignored,
            seqPermalink: log.Id ? `https://dashboard-one-ivory-58.vercel.app/api/seq/public-event?id=${log.Id}&origen=${encodeURIComponent(origenConexion)}` : ''
          });
        }
      }
    });

    for (const dest in infraestructuraMap) {
      const data = infraestructuraMap[dest];
      const superaUmbral = data.clientesNoIgnorados.size > 3 && data.totalEventosNoIgnorados > 10;
      if (superaUmbral) {
        algunaAlertaInfraestructuraSuperada = true;
      }
      alertasInfraestructura.push({
        destino: data.destino,
        superaUmbral: superaUmbral,
        box: data.destino,
        cantidadClientesAfectados: data.clientes.size,
        clientesAfectados: Array.from(data.clientes),
        totalEventosError: data.totalEventos,
        totalEventosErrorNoIgnorados: data.totalEventosNoIgnorados,
        ejemplo: data.ejemplos[0] || null,
        isIgnored: data.ejemplos[0]?.isIgnored || false,
        mensaje: `Alerta Infraestructura: Se detectaron ${data.totalEventosNoIgnorados} errores afectando a ${data.clientesNoIgnorados.size} clientes al invocar el destino ${data.destino} (Supera Umbral: ${superaUmbral}).`
      });
    }

    const alertaGenerada = algunaAlertaMesaAyudaSuperada || algunaAlertaInfraestructuraSuperada;

    // Calcular rango de tiempo
    let minTimestamp: string | null = null;
    let maxTimestamp: string | null = null;
    let minTimeMs = Infinity;
    let maxTimeMs = -Infinity;

    flattenedLogs.forEach(log => {
      const ts = log.Timestamp;
      if (ts) {
        const timeMs = Date.parse(ts);
        if (!isNaN(timeMs)) {
          if (timeMs < minTimeMs) {
            minTimeMs = timeMs;
            minTimestamp = ts;
          }
          if (timeMs > maxTimeMs) {
            maxTimeMs = timeMs;
            maxTimestamp = ts;
          }
        }
      }
    });

    const rangoHorario = minTimestamp && maxTimestamp 
      ? `${minTimestamp} a ${maxTimestamp}`
      : 'No disponible';

    // Ordenar alertas de Mesa de Ayuda
    alertasMesaDeAyuda.sort((a, b) => {
      let comparison = 0;
      if (mesaAyudaSortBy === 'eventos') {
        comparison = a.totalEventos - b.totalEventos;
      } else {
        comparison = a.origen.localeCompare(b.origen);
      }
      return mesaAyudaSortOrder === 'desc' ? -comparison : comparison;
    });

    // Ordenar alertas de Infraestructura
    alertasInfraestructura.sort((a, b) => {
      let comparison = 0;
      if (infraSortBy === 'eventos') {
        comparison = a.totalEventosError - b.totalEventosError;
      } else {
        comparison = a.destino.localeCompare(b.destino);
      }
      return infraSortOrder === 'desc' ? -comparison : comparison;
    });

    return {
      consultaEvaluada: alertQueryFilter || selectedQueryForAlert?.filter || currentFilter,
      alertaGenerada,
      resumen: {
        totalErroresEvaluados: totalErrores,
        totalErroresCliente: erroresClienteCount,
        totalErroresServidor: erroresServidorCount,
        ventanaEvaluacionMinutos: VENTANA_TIEMPO_MINUTOS,
        alertaClienteCritico: algunaAlertaMesaAyudaSuperada,
        alertaServidorGlobal: algunaAlertaInfraestructuraSuperada,
        rangoHorario
      },
      alertasMesaDeAyuda,
      alertasInfraestructura
    };
  }, [
    selectedQueryForAlert, 
    logs, 
    alertConfig, 
    alertQueryFilter, 
    connections, 
    currentFilter, 
    mesaAyudaSortBy, 
    mesaAyudaSortOrder, 
    infraSortBy, 
    infraSortOrder
  ]);

  // Orígenes y Destinos en alerta para el filtro rápido de alertas
  const alertOrigins = useMemo(() => {
    const origins = new Set<string>();
    simulatedResult.alertasMesaDeAyuda.forEach(a => {
      if (a.superaUmbral) {
        origins.add(`${a.cliente.toLowerCase()}|${a.hostname.toLowerCase()}`);
      }
    });
    return origins;
  }, [simulatedResult.alertasMesaDeAyuda]);

  const alertDestinations = useMemo(() => {
    const destinations = new Set<string>();
    simulatedResult.alertasInfraestructura.forEach(a => {
      if (a.superaUmbral) {
        destinations.add(a.destino.toLowerCase());
      }
    });
    return destinations;
  }, [simulatedResult.alertasInfraestructura]);

  // Filtrado local y por texto (Memoizado)
  const filteredLogs = useMemo(() => {
    return logs.map(log => {
      const message = (log.RenderedMessage || log.MessageTemplate || '').toString();
      const exception = (log.Exception || '').toString();
      const ignored = isErrorIgnored(message, exception, log);
      return {
        ...log,
        isIgnored: ignored
      };
    }).filter(log => {
      // Filtrar por conexión seleccionada
      if (log.connectionId && !activeConnectionFilters.has(log.connectionId)) {
        return false;
      }
      const isSqlAggregation = !log.Timestamp || isNaN(Date.parse(log.Timestamp));
      if (!isSqlAggregation) {
        const level = log.Level || 'Information';
        if (!activeLevels.has(level)) return false;
      }

      // Filtrar por logs involucrados en alertas que superan umbrales
      if (filterOnlyAlerts) {
        let logCliente = 'desconocido';
        let logHostname = 'desconocido';
        
        if (log.Properties) {
          log.Properties.forEach(p => {
            const nameLower = p.Name.toLowerCase();
            if (nameLower === 'cliente' || nameLower === '_cliente') logCliente = String(p.Value).toLowerCase();
            if (nameLower === 'hostname' || nameLower === '_hostname') logHostname = String(p.Value).toLowerCase();
          });
        }
        
        const anyLog = log as any;
        if (anyLog.Cliente) logCliente = anyLog.Cliente.toString().toLowerCase();
        else if (anyLog._cliente) logCliente = anyLog._cliente.toString().toLowerCase();
        else if (anyLog.cliente) logCliente = anyLog.cliente.toString().toLowerCase();

        if (anyLog.Hostname) logHostname = anyLog.Hostname.toString().toLowerCase();
        else if (anyLog._hostname) logHostname = anyLog._hostname.toString().toLowerCase();
        else if (anyLog.hostname) logHostname = anyLog.hostname.toString().toLowerCase();

        const key = `${logCliente}|${logHostname}`;
        
        const message = (log.RenderedMessage || log.MessageTemplate || '').toString().toLowerCase();
        const exception = (log.Exception || '').toString().toLowerCase();
        
        let statusCode = null;
        const statusCodeMatch = exception.match(/"StatusCode"\s*:\s*(\d+)/) || 
                              exception.match(/StatusCode=(\d+)/) || 
                              message.match(/(\d{3})/);
        if (statusCodeMatch) {
          statusCode = parseInt(statusCodeMatch[1]);
        }

        let destino = 'desconocido';
        const requestUriMatch = exception.match(/RequestUri[\\":=\s]+(https?:\/\/[^\s'",\ ]+)/) ||
                              exception.match(/"RequestUri"\s*:\s*"([^"]+)"/) || 
                              exception.match(/RequestUri=([^,\s]+)/) ||
                              message.match(/(https?:\/\/[^\s'"]+)/);
        if (requestUriMatch) {
          try {
            let destOrigin = requestUriMatch[1];
            if (destOrigin.startsWith('http://') || destOrigin.startsWith('https://')) {
              destOrigin = new URL(destOrigin).origin;
            }
            destino = destOrigin.toLowerCase();
          } catch(e) {}
        }

        let isClient = false;
        let isServer = false;
        if (statusCode) {
          if (statusCode >= 400 && statusCode < 500) isClient = true;
          else if (statusCode >= 500) isServer = true;
        }

        if (!isClient && !isServer) {
          if (exception.includes('timeout') || message.includes('timeout') || message.includes('tiempo de espera')) {
            isServer = true;
          } else if (exception.includes('conexión') || exception.includes('conexion') || 
                     exception.includes('connectfailure') || exception.includes('httprequestexception') || 
                     message.includes('conexión') || message.includes('conexion') || message.includes('failed to connect')) {
            isServer = true;
          } else if (exception.includes('bad request') || message.includes('bad request')) {
            isClient = true;
          } else if (exception.includes('not found') || message.includes('not found')) {
            isClient = true;
          }
        }

        if (isServer) {
          const DOMINIOS_INFRAESTRUCTURA = [
            'api-colombia.mysatcomla.com',
            'webapi.mysatcomla.com',
            'api-app-prod.mysatcomla.com'
          ];
          const esDestinoCloud = DOMINIOS_INFRAESTRUCTURA.some(dom => destino.includes(dom));
          if (esDestinoCloud) {
            isClient = false;
            isServer = true;
          } else {
            isClient = true;
            isServer = false;
          }
        }

        const matchClientAlert = isClient && alertOrigins.has(key);
        const matchServerAlert = isServer && alertDestinations.has(destino);

        if (!matchClientAlert && !matchServerAlert) {
          return false;
        }
      }

      // Filtrado local por Origen (lupa)
      if (localFilterOrigin) {
        let logCliente = 'desconocido';
        let logHostname = 'desconocido';
        
        if (log.Properties) {
          log.Properties.forEach(p => {
            const nameLower = p.Name.toLowerCase();
            if (nameLower === 'cliente' || nameLower === '_cliente') logCliente = String(p.Value).toLowerCase();
            if (nameLower === 'hostname' || nameLower === '_hostname') logHostname = String(p.Value).toLowerCase();
          });
        }
        const anyLog = log as any;
        if (anyLog.Cliente) logCliente = anyLog.Cliente.toString().toLowerCase();
        else if (anyLog._cliente) logCliente = anyLog._cliente.toString().toLowerCase();
        else if (anyLog.cliente) logCliente = anyLog.cliente.toString().toLowerCase();

        if (anyLog.Hostname) logHostname = anyLog.Hostname.toString().toLowerCase();
        else if (anyLog._hostname) logHostname = anyLog._hostname.toString().toLowerCase();
        else if (anyLog.hostname) logHostname = anyLog.hostname.toString().toLowerCase();

        const matchC = !localFilterOrigin.cliente || localFilterOrigin.cliente === 'Desconocido' || logCliente === localFilterOrigin.cliente.toLowerCase();
        const matchH = !localFilterOrigin.hostname || localFilterOrigin.hostname === 'Desconocido' || logHostname === localFilterOrigin.hostname.toLowerCase();
        if (!matchC || !matchH) return false;
      }

      // Filtrado local por Destino (lupa)
      if (localFilterDestino) {
        const exception = (log.Exception || '').toString().toLowerCase();
        const message = (log.RenderedMessage || log.MessageTemplate || '').toString().toLowerCase();
        const cleanDest = localFilterDestino.replace(/^https?:\/\//, '').toLowerCase();
        if (!exception.includes(cleanDest) && !message.includes(cleanDest)) {
          return false;
        }
      }

      // Filtrado local por Mensaje (lupa)
      if (localFilterMessage) {
        const exception = (log.Exception || '').toString().toLowerCase();
        const message = (log.RenderedMessage || log.MessageTemplate || '').toString().toLowerCase();
        const cleanMsg = localFilterMessage.toLowerCase();
        if (!exception.includes(cleanMsg) && !message.includes(cleanMsg)) {
          return false;
        }
      }

      // Filtrado local por Event ID (lupa)
      if (localFilterId) {
        if (log.Id !== localFilterId && (log as any)['@Id'] !== localFilterId) {
          return false;
        }
      }

      if (!localSearchQuery.trim()) return true;

      const query = localSearchQuery.toLowerCase();
      const message = isSqlAggregation
        ? (log.Properties ? log.Properties.map(p => `${p.Name} ${JSON.stringify(p.Value)}`).join(' ') : '').toLowerCase()
        : (log.RenderedMessage || log.MessageTemplate || '').toLowerCase();
      
      const propertiesStr = log.Properties 
        ? log.Properties.map(p => `${p.Name} ${JSON.stringify(p.Value)}`).join(' ').toLowerCase() 
        : '';
      const exceptionStr = (log.Exception || '').toLowerCase();

      return message.includes(query) || propertiesStr.includes(query) || exceptionStr.includes(query);
    });
  }, [
    logs, 
    activeLevels, 
    localSearchQuery, 
    activeConnectionFilters, 
    filterOnlyAlerts, 
    alertOrigins, 
    alertDestinations, 
    localFilterOrigin, 
    localFilterDestino, 
    localFilterMessage, 
    localFilterId,
    ignoredErrors
  ]);

  // Toggle de nivel en los chips de filtro local
  const toggleLocalLevel = (lvl: string) => {
    setActiveLevels(prev => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  // Obtener el conteo de eventos filtrados por conexión (respetando filtros de nivel de log y buscador local)
  const getConnectionLogCount = (connectionId: string) => {
    return logs.filter(log => {
      if (log.connectionId !== connectionId) return false;
      const isSqlAggregation = !log.Timestamp || isNaN(Date.parse(log.Timestamp));
      if (!isSqlAggregation) {
        const level = log.Level || 'Information';
        if (!activeLevels.has(level)) return false;
      }
      if (!localSearchQuery.trim()) return true;
      const query = localSearchQuery.toLowerCase();
      const message = isSqlAggregation
        ? (log.Properties ? log.Properties.map(p => `${p.Name} ${JSON.stringify(p.Value)}`).join(' ') : '').toLowerCase()
        : (log.RenderedMessage || log.MessageTemplate || '').toLowerCase();
      
      const propertiesStr = log.Properties 
        ? log.Properties.map(p => `${p.Name} ${JSON.stringify(p.Value)}`).join(' ').toLowerCase() 
        : '';
      const exceptionStr = (log.Exception || '').toLowerCase();

      return message.includes(query) || propertiesStr.includes(query) || exceptionStr.includes(query);
    }).length;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-2xl relative">
      
      {/* Toast System */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-3 rounded-lg border shadow-lg flex items-start gap-2 animate-slide-in pointer-events-auto bg-white dark:bg-[#131313] ${
              toast.type === 'success' ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' :
              toast.type === 'error' ? 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5' :
              toast.type === 'warning' ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5' :
              'border-[#71BF44]/30 text-[#71BF44] bg-[#71BF44]/5'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <Bell className="w-4 h-4 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Activity className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header del Monitor */}
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111] p-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#71BF44]/10 border border-[#71BF44]/20 flex items-center justify-center text-[#71BF44]">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-wider uppercase">Seq Monitor</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-neutral-450 dark:bg-neutral-600'
              }`} />
              <span className="text-[10px] text-neutral-550 dark:text-neutral-400 font-medium">{connectionStatusText}</span>
            </div>
          </div>
        </div>

        {/* Navegación Tabs Oficiales */}
        <div className="shrink-0 self-start sm:self-center -mb-4 sm:mb-0">
          <Tabs
            tabs={[
              { id: 'monitor', label: 'Monitor', icon: <Activity className="w-4 h-4" /> },
              { id: 'tasks', label: 'Tareas', icon: <Bell className="w-4 h-4" /> },
              { id: 'connections', label: 'Conexiones', icon: <Server className="w-4 h-4" /> },
              { id: 'ignored', label: 'Silenciados', icon: <BellOff className="w-4 h-4" /> }
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
          />
        </div>
      </header>

      {/* Cuerpo principal */}
      <div className="flex-1 flex overflow-hidden min-h-[550px]">
        {activeTab === 'monitor' && (
          <>
            {/* Panel Principal */}
            <main className="flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-[#0a0a0a] p-4 gap-4">
              {/*               {/* Barra de Controles y Entrada de Query (2 filas optimizadas) */}
              <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col gap-3.5 shadow-sm">
                {/* FILA 1: Configuración de Herramientas */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-neutral-100 dark:border-neutral-900 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* 1. Selector Múltiple de Conexiones */}
                    <div className="relative" ref={connectionDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsConnectionDropdownOpen(!isConnectionDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-850 transition-colors select-none whitespace-nowrap"
                        title="Seleccionar orígenes de Seq"
                      >
                        <Server className="w-3.5 h-3.5 text-[#71BF44]" />
                        <span>
                          {selectedConnectionIds.size === 0 ? 'Sin Conexión' : 
                           selectedConnectionIds.size === connections.length ? 'Todas las Conexiones' : 
                           `${selectedConnectionIds.size} de ${connections.length} Conexiones`}
                        </span>
                        <ChevronDown className="w-3 h-3 text-neutral-450" />
                      </button>

                      {isConnectionDropdownOpen && (
                        <div className="absolute left-0 mt-1 bg-white dark:bg-[#151515] border border-neutral-250 dark:border-neutral-800 rounded-xl shadow-2xl p-3 z-40 w-64 flex flex-col gap-2 animate-scale-in">
                          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-850 pb-1.5">
                            <span className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider">Orígenes de Seq</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedConnectionIds(new Set(connections.map(c => c.id)));
                                  showToast('Todos los orígenes seleccionados', 'info');
                                }}
                                className="text-[9px] text-[#71BF44] hover:underline font-semibold"
                              >
                                Todos
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedConnectionIds(new Set());
                                  showToast('Orígenes limpiados', 'info');
                                }}
                                className="text-[9px] text-red-500 hover:underline font-semibold"
                              >
                                Ninguno
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pt-1">
                            {connections.length === 0 ? (
                              <span className="text-[11px] text-neutral-450 italic p-1">No hay conexiones configuradas</span>
                            ) : (
                              connections.map(c => {
                                const isChecked = selectedConnectionIds.has(c.id);
                                return (
                                  <label
                                    key={c.id}
                                    className="flex items-center gap-2 p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-lg cursor-pointer text-xs select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedConnectionIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(c.id)) next.delete(c.id);
                                          else next.add(c.id);
                                          return next;
                                        });
                                      }}
                                      className="rounded border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[#71BF44] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{c.name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-850" />

                    {/* 2. Dropdown de Consultas Guardadas con Buscador */}
                    <div className="relative" ref={savedQueriesDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsSavedQueriesOpen(!isSavedQueriesOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none whitespace-nowrap"
                        title="Buscar o cargar consultas guardadas"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#71BF44]" />
                        <span>Consultas Guardadas</span>
                        <ChevronDown className="w-3 h-3 text-neutral-450" />
                      </button>

                      {isSavedQueriesOpen && (
                        <div className="absolute left-0 mt-1 bg-white dark:bg-[#151515] border border-neutral-250 dark:border-neutral-800 rounded-xl shadow-2xl p-3 z-40 w-72 flex flex-col gap-2.5 animate-scale-in">
                          <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider">Consultas Guardadas</h5>
                          
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-450 dark:text-neutral-550" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Filtrar consultas..."
                              value={searchSavedQueryText}
                              onChange={(e) => setSearchSavedQueryText(e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-[#1e1e1e] border border-neutral-250 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                            />
                          </div>

                          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850">
                            {(() => {
                              const term = searchSavedQueryText.trim().toLowerCase();
                              const filtered = savedQueries.filter(q => q.name.toLowerCase().includes(term));
                              if (filtered.length === 0) {
                                return <span className="text-[11px] text-neutral-450 italic p-2 select-none">No se encontraron consultas</span>;
                              }
                                return filtered.map(q => (
                                  <div
                                    key={q.id}
                                    className="flex items-center justify-between p-2 hover:bg-[#71BF44]/5 dark:hover:bg-[#71BF44]/10 cursor-pointer rounded-lg group text-xs transition-colors"
                                    onClick={() => {
                                      clearLocalFilters();
                                      setCurrentFilter(q.filter);
                                      setTimeout(() => {
                                        stateRef.current.currentFilter = q.filter;
                                        fetchLogs(false);
                                      }, 50);
                                      setIsSavedQueriesOpen(false);
                                      setSearchSavedQueryText('');
                                    }}
                                  >
                                    <div className="flex flex-col min-w-0 pr-3">
                                      <span className="font-medium text-neutral-855 dark:text-neutral-200 truncate">{q.name}</span>
                                      {(q.createdBy || q.updatedBy) && (
                                        <span className="text-[8px] text-neutral-450 dark:text-neutral-500 truncate mt-0.5">
                                          Autor: {q.updatedBy || q.createdBy}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setQueryNameInput(q.name);
                                           setQueryFilterInput(q.filter);
                                           setEditingQuery(q);
                                           setIsSaveQueryModalOpen(true);
                                           setIsSavedQueriesOpen(false);
                                         }}
                                         className="text-neutral-400 hover:text-[#71BF44] p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
                                         title="Editar consulta"
                                       >
                                         <Edit className="w-3.5 h-3.5" />
                                       </button>
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setSelectedQueryForAlert(q);
                                           if (q.alertConfig) {
                                             setAlertConfig({
                                               timeWindowMinutes: q.alertConfig.timeWindowMinutes,
                                               clientEventsThreshold: q.alertConfig.clientEventsThreshold,
                                               serverEventsThreshold: q.alertConfig.serverEventsThreshold,
                                               serverClientsThreshold: q.alertConfig.serverClientsThreshold,
                                               includeVersion: q.alertConfig.includeVersion,
                                               includeApp: q.alertConfig.includeApp,
                                               includeHostname: q.alertConfig.includeHostname,
                                               includeCliente: q.alertConfig.includeCliente,
                                               isActive: q.alertConfig.isActive !== undefined ? q.alertConfig.isActive : true
                                             });
                                           } else {
                                             setAlertConfig({
                                               timeWindowMinutes: 10,
                                               clientEventsThreshold: 30,
                                               serverEventsThreshold: 30,
                                               serverClientsThreshold: 3,
                                               includeVersion: true,
                                               includeApp: true,
                                               includeHostname: true,
                                               includeCliente: true,
                                               isActive: true
                                             });
                                           }
                                           setAlertQueryFilter(q.filter);
                                           setGeneratedJsAlert('');
                                           setCustomJsAlert('');
                                           setIsCustomAlertEdited(false);
                                           setIsAlertModalOpen(true);
                                           setIsSavedQueriesOpen(false);
                                         }}
                                         className={`p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors ${
                                           q.alertConfig 
                                             ? q.alertConfig.isActive
                                               ? 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold' 
                                               : 'text-emerald-500/40 hover:text-emerald-500 dark:text-emerald-400/30 dark:hover:text-emerald-400' 
                                             : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'
                                         }`}
                                         title={q.alertConfig ? `Alerta configurada (${q.alertConfig.isActive ? 'Activa' : 'Inactiva'}). Clic para editar` : "Configurar alerta para n8n"}
                                       >
                                         <Bell className="w-3.5 h-3.5" />
                                       </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteQuery(q.id);
                                        }}
                                        className="text-neutral-400 hover:text-red-500 dark:text-neutral-550 dark:hover:text-red-400 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
                                        title="Eliminar consulta"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ));
                            })()}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setQueryNameInput('');
                              setQueryFilterInput(currentFilter);
                              setEditingQuery(null);
                              setIsSaveQueryModalOpen(true);
                              setIsSavedQueriesOpen(false);
                            }}
                            className="mt-1.5 w-full py-2 text-center text-[10px] font-bold text-[#71BF44] bg-[#71BF44]/5 hover:bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-lg transition-all"
                          >
                            + Guardar Consulta Actual
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-850" />

                    {/* 3. Selector de fecha / Time Picker al estilo de Seq */}
                    <div className="relative" ref={timePickerRef}>
                      <button
                        onClick={() => setIsTimePickerOpen(!isTimePickerOpen)}
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg text-xs text-neutral-850 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none whitespace-nowrap"
                        title="Limitar rango de tiempo (FIRST to NOW)"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#71BF44]" />
                        <span>
                          {queryStartTime ? new Date(queryStartTime).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'FIRST'}
                        </span>
                        <span className="text-neutral-450 dark:text-neutral-600 font-bold px-0.5">to</span>
                        <span>
                          {queryEndTime ? new Date(queryEndTime).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'NOW'}
                        </span>
                        {(queryStartTime || queryEndTime) && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueryStartTime('');
                              setQueryEndTime('');
                              showToast('Rango de tiempo restablecido (FIRST to NOW)', 'info');
                            }}
                            className="ml-1 p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-750 rounded text-neutral-400 hover:text-red-500 transition-colors"
                            title="Limpiar rango"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </button>

                      {isTimePickerOpen && (
                        <div className="absolute left-0 mt-1 bg-white dark:bg-[#151515] border border-neutral-250 dark:border-neutral-800 rounded-xl shadow-2xl p-4 z-40 w-72 flex flex-col gap-3 animate-scale-in">
                          <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider">Rango de Consulta</h5>
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-neutral-550 dark:text-neutral-450 font-bold uppercase">Desde (Inicio)</label>
                            <input
                              type="datetime-local"
                              value={queryStartTime}
                              onChange={(e) => setQueryStartTime(e.target.value)}
                              className="bg-neutral-50 dark:bg-[#1e1e1e] border border-neutral-250 dark:border-neutral-800 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] w-full"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-neutral-550 dark:text-neutral-450 font-bold uppercase">Hasta (Fin)</label>
                            <input
                              type="datetime-local"
                              value={queryEndTime}
                              onChange={(e) => setQueryEndTime(e.target.value)}
                              className="bg-neutral-50 dark:bg-[#1e1e1e] border border-neutral-250 dark:border-neutral-800 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] w-full"
                            />
                          </div>

                          <div className="border-t border-neutral-100 dark:border-neutral-850 pt-2 flex flex-col gap-1.5">
                            <span className="text-[9px] text-neutral-450 dark:text-neutral-400 font-bold uppercase tracking-wider">Intervalos rápidos:</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { label: '30 Minutos', value: 30 },
                                { label: '1 Hora', value: 60 },
                                { label: '4 Horas', value: 240 },
                                { label: '24 Horas', value: 1440 },
                              ].map((opt) => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => {
                                    const now = new Date();
                                    const start = new Date(now.getTime() - opt.value * 60 * 1000);
                                    const tzOffset = start.getTimezoneOffset() * 60000;
                                    const localISOTime = (new Date(start.getTime() - tzOffset)).toISOString().slice(0, 16);
                                    
                                    setQueryStartTime(localISOTime);
                                    setQueryEndTime('');
                                    setIsTimePickerOpen(false);
                                    showToast(`Filtrando por: ${opt.label}`, 'info');
                                  }}
                                  className="px-2 py-1 bg-neutral-50 dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 hover:bg-[#71BF44]/10 hover:border-[#71BF44]/30 rounded text-[10px] text-neutral-600 dark:text-neutral-350 hover:text-[#71BF44] text-center transition-all font-semibold"
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQueryStartTime('');
                                setQueryEndTime('');
                                setIsTimePickerOpen(false);
                                showToast('Filtro temporal limpiado', 'info');
                              }}
                              className="mt-1 w-full py-1 text-center text-[10px] font-bold text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded transition-all"
                            >
                              Limpiar Rango (FIRST to NOW)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón rápido + 3h */}
                    <button
                      onClick={handleInjectTimeFilter}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 hover:bg-[#71BF44]/10 hover:text-[#71BF44] hover:border-[#71BF44]/30 transition-colors select-none whitespace-nowrap"
                      title="Insertar condición de tiempo 'and @Timestamp >= Now() - 3h' al final del WHERE y antes del GROUP BY si existe"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#71BF44]" />
                      <span>+ 3h</span>
                    </button>

                    <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-850" />

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-550 dark:text-neutral-450 font-bold uppercase tracking-wider whitespace-nowrap">Límite:</span>
                      <input
                        type="number"
                        value={limit}
                        onChange={(e) => {
                          const val = Math.min(2000, Math.max(1, parseInt(e.target.value) || 50));
                          setLimit(val);
                          localStorage.setItem('seq_monitor_limit', val.toString());
                        }}
                        className="w-14 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-900 dark:text-white text-center focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                      />
                    </div>
                  </div>

                  {/* Configuración de streaming & Limpiar a la derecha */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-neutral-55 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 px-2 py-1 rounded-lg">
                      <input
                        type="checkbox"
                        id="auto-refresh"
                        checked={isStreaming}
                        onChange={(e) => {
                          if (e.target.checked) startStreaming();
                          else stopStreaming();
                        }}
                        className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[#71BF44] focus:ring-0 w-3 h-3"
                      />
                      <label htmlFor="auto-refresh" className="text-[9px] text-neutral-550 dark:text-neutral-450 font-bold uppercase select-none cursor-pointer">Auto-refrescar</label>
                    </div>

                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                      disabled={!isStreaming}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 disabled:opacity-50 text-neutral-850 dark:text-neutral-200 text-[10px] rounded-lg px-1.5 py-1 focus:outline-none"
                    >
                      <option value="3000">3s</option>
                      <option value="5000">5s</option>
                      <option value="10000">10s</option>
                      <option value="30000">30s</option>
                    </select>

                    <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-850" />

                    <button
                      onClick={handleClearLogs}
                      className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors"
                      title="Restablecer filtros y consola"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* FILA 2: Entrada de Filtro y Acción */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-450 dark:text-neutral-500" />
                    <textarea
                      ref={textareaRef}
                      placeholder="Filtro (ej: @Level = 'Error' or @Message like '%error%' o select count(*) from stream...)"
                      value={currentFilter}
                      onChange={(e) => {
                        setCurrentFilter(e.target.value);
                        stateRef.current.currentFilter = e.target.value;
                        setIsSuggestionsOpen(true);
                      }}
                      onFocus={() => setIsSuggestionsOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleExecuteQuery();
                          setIsSuggestionsOpen(false);
                        } else if (e.key === 'Escape') {
                          setIsSuggestionsOpen(false);
                        }
                      }}
                      rows={1}
                      className="w-full bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg pl-9 pr-16 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] font-mono resize-y min-h-[36px] placeholder:opacity-35"
                    />
                    <div className="absolute right-2 bottom-1.5 text-[8px] text-neutral-450 dark:text-neutral-500 pointer-events-none select-none font-sans bg-neutral-100 dark:bg-[#111] px-1 rounded border border-neutral-200 dark:border-neutral-800">
                      Ctrl+Enter
                    </div>

                    {/* Sugerencias de Historial Autocompletable */}
                    {isSuggestionsOpen && historyQueries.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#151515] border border-neutral-250 dark:border-neutral-800 rounded-lg shadow-xl max-h-60 overflow-y-auto z-40 divide-y divide-neutral-100 dark:divide-neutral-850"
                      >
                        {(() => {
                          const filterVal = currentFilter.trim().toLowerCase();
                          const filteredHistory = historyQueries.filter(h => 
                            h.query.toLowerCase().includes(filterVal)
                          );
                          if (filteredHistory.length === 0) {
                            return (
                              <div className="p-3 text-xs text-neutral-500 italic select-none">
                                Sin coincidencias en el historial
                              </div>
                            );
                          }
                          return filteredHistory.map((h, i) => (
                            <div 
                              key={i} 
                              className="flex items-center justify-between p-2.5 hover:bg-[#71BF44]/5 dark:hover:bg-[#71BF44]/10 cursor-pointer group text-xs transition-colors"
                              onClick={() => {
                                setCurrentFilter(h.query);
                                stateRef.current.currentFilter = h.query;
                                setIsSuggestionsOpen(false);
                                textareaRef.current?.focus();
                              }}
                            >
                              <div className="flex items-center gap-2 truncate pr-4 text-neutral-855 dark:text-neutral-200">
                                <Clock className="w-3.5 h-3.5 text-neutral-450 dark:text-neutral-500 shrink-0" />
                                <span className="font-mono truncate select-all">{h.query}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-sans select-none shrink-0 bg-neutral-100 dark:bg-[#181818] px-1 rounded">
                                  {h.timestamp}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHistoryQuery(h.query);
                                  }}
                                  className="text-neutral-400 hover:text-red-500 dark:text-neutral-550 dark:hover:text-red-400 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
                                  title="Eliminar del historial"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleExecuteQuery}
                    disabled={isLoadingLogs}
                    className="bg-[#71BF44] hover:bg-[#71BF44]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-[#131313] text-xs font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 h-[36px]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    {isLoadingLogs ? 'Procesando...' : 'Ejecutar'}
                  </button>
                </div>
              </div>

              {/* Filtros Locales / Rápidos */}
              <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider shrink-0">Nivel de Log:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {LOG_LEVELS.map(lvl => {
                        const isActive = activeLevels.has(lvl);
                        return (
                          <button
                            key={lvl}
                            onClick={() => toggleLocalLevel(lvl)}
                            style={{
                              borderColor: isActive ? LEVEL_COLORS[lvl] : 'transparent',
                              backgroundColor: isActive ? `${LEVEL_COLORS[lvl]}15` : undefined,
                              color: isActive ? LEVEL_COLORS[lvl] : undefined
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                              isActive ? '' : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-[#181818] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border-transparent'
                            }`}
                          >
                            {lvl === 'Information' ? 'Info' : lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-850 hidden lg:block" />

                  <div className="flex items-center gap-2 flex-wrap border-t lg:border-t-0 border-neutral-200 dark:border-neutral-800 pt-2 lg:pt-0">
                    <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-bold uppercase tracking-wider shrink-0">Orígenes Visibles:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {connections.map(c => {
                        const isActive = activeConnectionFilters.has(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setActiveConnectionFilters(prev => {
                                const next = new Set(prev);
                                if (next.has(c.id)) next.delete(c.id);
                                else next.add(c.id);
                                return next;
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                              isActive 
                                ? 'bg-[#71BF44]/15 border-[#71BF44]/35 text-[#71BF44]' 
                                : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-[#181818] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border-transparent'
                            }`}
                          >
                            {c.name} ({getConnectionLogCount(c.id)})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 select-none w-full lg:w-auto justify-end">
                  {!rawSqlResult && logs.length > 0 && (
                    <label className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-amber-500/20 transition-all whitespace-nowrap text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={filterOnlyAlerts}
                        onChange={(e) => setFilterOnlyAlerts(e.target.checked)}
                        className="rounded border-amber-500/30 bg-white dark:bg-neutral-800 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Solo Alertas ⚠️</span>
                    </label>
                  )}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Filtrar por texto en consola..."
                      value={localSearchQuery}
                      onChange={(e) => setLocalSearchQuery(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>
                </div>
              </div>
 
              {/* Indicador de Filtros Locales Activos */}
              {(localFilterOrigin || localFilterDestino || localFilterMessage || localFilterId) && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl flex items-center justify-between text-xs font-medium animate-fade-in shadow-sm select-none">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      <strong>Filtro local activo:</strong>{' '}
                      {localFilterOrigin && `Origen (${localFilterOrigin.cliente} / ${localFilterOrigin.hostname})`}
                      {localFilterDestino && `Destino (${localFilterDestino})`}
                      {localFilterMessage && `Mensaje ("${localFilterMessage.length > 40 ? localFilterMessage.substring(0, 40) + '...' : localFilterMessage}")`}
                      {localFilterId && `ID de Evento (${localFilterId})`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setLocalFilterOrigin(null);
                      setLocalFilterDestino(null);
                      setLocalFilterMessage(null);
                      setLocalFilterId(null);
                      showToast('Filtro local limpiado', 'info');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider"
                  >
                    <X className="w-3 h-3" />
                    Limpiar
                  </button>
                </div>
              )}

              {/* Visor de Eventos (Consola / Grid / Gráficas) */}
              <div className="flex-1 flex flex-col border border-teal-200/35 dark:border-teal-900 bg-[#f0faf7] dark:bg-[#071714] text-[#0f2d26] dark:text-[#d3ebe6] rounded-xl overflow-hidden min-h-0 relative shadow-inner">
                {isLoadingLogs && (
                  <div className="absolute inset-0 bg-[#f0faf7]/75 dark:bg-[#071714]/75 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 z-30 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full border-2 border-teal-800 dark:border-teal-900 border-t-[#71BF44] animate-spin" />
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 font-mono tracking-wider animate-pulse">Procesando consulta en Seq...</span>
                  </div>
                )}
                <div className="bg-[#e6f5f0] dark:bg-[#0b211d] border-b border-teal-200/50 dark:border-teal-950 px-4 py-2 flex flex-col md:flex-row md:items-center justify-between text-xs font-bold text-teal-850 dark:text-teal-400 gap-2 select-none">
                  <div className="flex items-center gap-2">
                    <span>Visor de Eventos</span>
                    {rawSqlResult ? (
                      <span className="text-[9px] bg-[#71BF44]/10 text-[#71BF44] border border-[#71BF44]/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        SQL Dataset
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-neutral-200 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full font-semibold">
                          Mostrando {filteredLogs.length} de {logs.length} logs
                        </span>
                        <button
                          onClick={() => setShowLiveAnalysisPanel(!showLiveAnalysisPanel)}
                          type="button"
                          className={`ml-2 flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                            showLiveAnalysisPanel
                              ? 'bg-[#71BF44] text-[#131313] border-[#71BF44]'
                              : 'bg-[#71BF44]/10 text-[#71BF44] border-[#71BF44]/35 hover:bg-[#71BF44]/20'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{showLiveAnalysisPanel ? 'Cerrar Análisis' : 'Analizar Errores 🔍'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {showLiveAnalysisPanel && !rawSqlResult && (
                    <div className="absolute top-[37px] left-0 right-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4 z-20 shadow-2xl animate-slide-down max-h-[70vh] overflow-y-auto text-neutral-950 dark:text-neutral-50">
                      <div className="flex flex-col gap-3 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-[#71BF44] animate-pulse" />
                            <span>Análisis de Errores y Alertas en Tiempo Real (Consola Activa)</span>
                          </h4>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => {
                                if (!selectedQueryForAlert) {
                                  setSelectedQueryForAlert({
                                    id: 'temp-console-alert',
                                    name: 'Consulta de Consola Activa',
                                    filter: currentFilter || "@Level = 'Error' or @Level = 'Fatal'",
                                    alertConfig: alertConfig
                                  });
                                  setAlertQueryFilter(currentFilter || "@Level = 'Error' or @Level = 'Fatal'");
                                } else {
                                  setAlertQueryFilter(selectedQueryForAlert.filter);
                                }
                                setIsCustomAlertEdited(false);
                                setCustomJsAlert('');
                                setIsAlertModalOpen(true);
                              }}
                              className="flex items-center gap-1.5 bg-[#71BF44]/10 hover:bg-[#71BF44]/25 text-[#5ba135] dark:text-[#71BF44] border border-[#71BF44]/30 px-2.5 py-1 rounded text-[10px] font-bold transition-all"
                              title="Ver y editar el script de la alerta asociada para N8N"
                            >
                              <Bell className="w-3.5 h-3.5 text-[#5ba135] dark:text-[#71BF44]" />
                              <span>Ver/Editar Script</span>
                            </button>
                            <button
                              onClick={handleDownloadAnalysisJson}
                              className="flex items-center gap-1 bg-[#71BF44]/10 hover:bg-[#71BF44]/25 text-[#5ba135] dark:text-[#71BF44] border border-[#71BF44]/30 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                              title="Descargar resumen del análisis en formato JSON"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Descargar Resumen JSON</span>
                            </button>
                            <div className="flex items-center gap-1 text-[10px] text-neutral-600 dark:text-neutral-350">
                              <span>¿Alerta Disparada?:</span>
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                                simulatedResult.alertaGenerada
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-300 dark:border-red-900/30 animate-pulse'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900/20'
                              }`}>
                                {simulatedResult.alertaGenerada ? 'SÍ (CRÍTICA)' : 'NO (SANO)'}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowLiveAnalysisPanel(false)}
                              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-450 dark:hover:text-white p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Filtro de Mensajes de Error en el Análisis */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-lg shadow-sm">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Search className="w-3.5 h-3.5 text-neutral-450 dark:text-neutral-500 shrink-0" />
                            <span className="text-[10px] text-neutral-650 dark:text-neutral-400 font-bold uppercase tracking-wider whitespace-nowrap">Filtrar análisis por texto:</span>
                            <input
                              type="text"
                              value={analysisErrorTextFilter}
                              onChange={(e) => setAnalysisErrorTextFilter(e.target.value)}
                              placeholder="Buscar error, origen o app en el análisis..."
                              className="bg-white dark:bg-neutral-900 border border-neutral-350 dark:border-neutral-800 rounded-md px-2 py-1 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] w-full sm:w-80"
                            />
                            {analysisErrorTextFilter && (
                              <button
                                type="button"
                                onClick={() => setAnalysisErrorTextFilter('')}
                                className="text-red-500 hover:text-red-650 text-[10px] font-bold px-1.5 uppercase hover:underline"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] text-neutral-450 italic hidden sm:inline">
                            Recalculando alertas dinámicamente según el texto de búsqueda.
                          </span>
                        </div>

                        {/* Controles de Umbrales Dinámicos */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 p-3 rounded-lg">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase">Ventana Evaluada (Min)</label>
                            <input
                              type="number"
                              value={alertConfig.timeWindowMinutes}
                              onChange={(e) => setAlertConfig(prev => ({ ...prev, timeWindowMinutes: Math.max(1, parseInt(e.target.value) || 10) }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase">Umbral Cliente (Eventos)</label>
                            <input
                              type="number"
                              value={alertConfig.clientEventsThreshold}
                              onChange={(e) => setAlertConfig(prev => ({ ...prev, clientEventsThreshold: Math.max(1, parseInt(e.target.value) || 20) }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase">Umbral Infraestructura (Eventos)</label>
                            <input
                              type="number"
                              value={alertConfig.serverEventsThreshold}
                              onChange={(e) => setAlertConfig(prev => ({ ...prev, serverEventsThreshold: Math.max(1, parseInt(e.target.value) || 10) }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold uppercase">Mín. Clientes Afectados (Infra)</label>
                            <input
                              type="number"
                              value={alertConfig.serverClientsThreshold}
                              onChange={(e) => setAlertConfig(prev => ({ ...prev, serverClientsThreshold: Math.max(1, parseInt(e.target.value) || 3) }))}
                              className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] text-center"
                            />
                          </div>
                        </div>

                        {/* Desglose de Alertas y Conteo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Columna Mesa de Ayuda (Clientes) */}
                          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                            <h5 className="text-[11px] font-bold text-neutral-850 dark:text-neutral-200 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800 pb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span>Errores por Origen (Clientes)</span>
                                <div className="flex items-center gap-1 font-sans text-[9px] normal-case font-normal select-none">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMesaAyudaSortBy('origen');
                                      setMesaAyudaSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    }}
                                    className={`px-1.5 py-0.5 rounded border transition-colors ${
                                      mesaAyudaSortBy === 'origen' 
                                        ? 'bg-[#71BF44] text-white dark:text-[#131313] border-transparent font-bold' 
                                        : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-850 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                    title="Ordenar por nombre de origen"
                                  >
                                    Origen {mesaAyudaSortBy === 'origen' && (mesaAyudaSortOrder === 'asc' ? '↑' : '↓')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMesaAyudaSortBy('eventos');
                                      setMesaAyudaSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    }}
                                    className={`px-1.5 py-0.5 rounded border transition-colors ${
                                      mesaAyudaSortBy === 'eventos' 
                                        ? 'bg-[#71BF44] text-white dark:text-[#131313] border-transparent font-bold' 
                                        : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-850 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                    title="Ordenar por número de eventos"
                                  >
                                    Eventos {mesaAyudaSortBy === 'eventos' && (mesaAyudaSortOrder === 'asc' ? '↑' : '↓')}
                                  </button>
                                </div>
                              </div>
                              <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-[10px] text-neutral-600 dark:text-neutral-400 font-bold shrink-0">
                                {simulatedResult.alertasMesaDeAyuda.length} detectados
                              </span>
                            </h5>
                            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                              {simulatedResult.alertasMesaDeAyuda.length === 0 ? (
                                <span className="text-[11px] text-neutral-500 italic p-2">Sin orígenes de error reportados en esta ventana.</span>
                              ) : (
                                simulatedResult.alertasMesaDeAyuda.map((a, idx) => {
                                  const isIgnored = a.isIgnored || a.eventosNoIgnorados === 0;
                                  return (
                                    <div key={idx} className={`pt-2.5 first:pt-0 flex flex-col gap-1 text-[11px] ${isIgnored ? 'opacity-60' : ''}`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-bold ${isIgnored ? 'text-neutral-500 line-through' : 'text-neutral-900 dark:text-white'}`}>{a.origen}</span>
                                          <button
                                            onClick={() => handleFilterByOrigin(a.cliente, a.hostname)}
                                            className="text-[#5ba135] dark:text-[#71BF44] hover:text-[#71BF44]/80 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                            title={`Buscar / filtrar eventos para este origen: ${a.origen}`}
                                          >
                                            <Search className="w-3 h-3" />
                                          </button>
                                          {a.ejemplo && (
                                            <button
                                              onClick={() => {
                                                setIgnoreOriginalError(a.ejemplo.error);
                                                setIgnorePattern(a.ejemplo.error);
                                                setIgnoreDurationOption('hoy');
                                                setIgnoreManualDate('');
                                                setIsIgnoreModalOpen(true);
                                              }}
                                              className={`p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${isIgnored ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-neutral-450 hover:text-red-500'}`}
                                              title={isIgnored ? "Silencio activo. Clic para editar" : "Configurar silencio (Ignorar) para este origen"}
                                            >
                                              <BellOff className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          {isIgnored && <span className="text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1 py-0.2 rounded font-bold uppercase select-none">Silenciado 🔕</span>}
                                        </div>
                                      </div>
                                      <span
                                        onClick={() => handleFilterByOrigin(a.cliente, a.hostname)}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer hover:opacity-85 transition-all ${
                                          isIgnored
                                            ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900/60 dark:text-neutral-400'
                                            : a.superaUmbral
                                              ? 'bg-red-100 text-red-750 border border-red-200 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/30 animate-pulse'
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400'
                                        }`}
                                        title={`Filtrar localmente por origen: ${a.origen}`}
                                      >
                                        {a.eventosNoIgnorados} activos / {a.totalEventos} err / Umbral {a.umbralDefinido}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Columna Infraestructura */}
                          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                            <h5 className="text-[11px] font-bold text-neutral-850 dark:text-neutral-200 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800 pb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span>Errores de Servidor (Infraestructura)</span>
                                <div className="flex items-center gap-1 font-sans text-[9px] normal-case font-normal select-none">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInfraSortBy('destino');
                                      setInfraSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    }}
                                    className={`px-1.5 py-0.5 rounded border transition-colors ${
                                      infraSortBy === 'destino' 
                                        ? 'bg-[#71BF44] text-white dark:text-[#131313] border-transparent font-bold' 
                                        : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-850 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                    title="Ordenar por nombre de destino"
                                  >
                                    Destino {infraSortBy === 'destino' && (infraSortOrder === 'asc' ? '↑' : '↓')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInfraSortBy('eventos');
                                      setInfraSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    }}
                                    className={`px-1.5 py-0.5 rounded border transition-colors ${
                                      infraSortBy === 'eventos' 
                                        ? 'bg-[#71BF44] text-white dark:text-[#131313] border-transparent font-bold' 
                                        : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-850 hover:text-neutral-700 dark:hover:text-neutral-200'
                                    }`}
                                    title="Ordenar por número de eventos"
                                  >
                                    Eventos {infraSortBy === 'eventos' && (infraSortOrder === 'asc' ? '↑' : '↓')}
                                  </button>
                                </div>
                              </div>
                              <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-[10px] text-neutral-600 dark:text-neutral-400 font-bold shrink-0">
                                {simulatedResult.alertasInfraestructura.length} destinos
                              </span>
                            </h5>
                            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                              {simulatedResult.alertasInfraestructura.length === 0 ? (
                                <span className="text-[11px] text-neutral-500 italic p-2">Sin fallas de infraestructura en esta ventana.</span>
                              ) : (
                                simulatedResult.alertasInfraestructura.map((a, idx) => {
                                  const isIgnored = a.isIgnored || a.totalEventosErrorNoIgnorados === 0;
                                  return (
                                    <div key={idx} className={`pt-2.5 first:pt-0 flex flex-col gap-1 text-[11px] ${isIgnored ? 'opacity-60' : ''}`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className={`font-bold truncate pr-2 ${isIgnored ? 'text-neutral-500 line-through' : 'text-neutral-900 dark:text-white'}`} title={a.destino}>{a.destino}</span>
                                          <button
                                            onClick={() => handleFilterByDestino(a.destino)}
                                            className="text-[#5ba135] dark:text-[#71BF44] hover:text-[#71BF44]/80 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                                            title={`Buscar / filtrar eventos para este destino: ${a.destino}`}
                                          >
                                            <Search className="w-3 h-3" />
                                          </button>
                                          {a.ejemplo && (
                                            <button
                                              onClick={() => {
                                                setIgnoreOriginalError(a.ejemplo.mensajeError);
                                                setIgnorePattern(a.ejemplo.mensajeError);
                                                setIgnoreDurationOption('hoy');
                                                setIgnoreManualDate('');
                                                setIsIgnoreModalOpen(true);
                                              }}
                                              className={`p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 ${isIgnored ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-neutral-450 hover:text-red-500'}`}
                                              title={isIgnored ? "Silencio activo. Clic para editar" : "Configurar silencio (Ignorar) para este destino"}
                                            >
                                              <BellOff className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          {isIgnored && <span className="text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1 py-0.2 rounded font-bold uppercase select-none shrink-0">Silenciado 🔕</span>}
                                        </div>
                                      </div>
                                      <span
                                        onClick={() => handleFilterByDestino(a.destino)}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap cursor-pointer hover:opacity-85 transition-all ${
                                          isIgnored
                                            ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900/60 dark:text-neutral-400'
                                            : a.superaUmbral
                                              ? 'bg-red-100 text-red-750 border border-red-200 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/30 animate-pulse'
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400'
                                        }`}
                                        title={`Filtrar localmente por destino: ${a.destino}`}
                                      >
                                        {a.totalEventosErrorNoIgnorados} activos / {a.totalEventosError} err / {a.clientesAfectados.length} clientes (Umbral: &gt;10 err y &gt;3 clientes)
                                      </span>
                                      <div className="text-[10px] text-neutral-650 dark:text-neutral-400 pl-1 font-semibold">
                                        <strong>Clientes Afectados:</strong> {a.clientesAfectados.join(', ')}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!rawSqlResult && filteredLogs.length > 0 && (
                    <div className="flex items-center gap-2 font-sans">
                      <span className="text-[10px] text-neutral-450 whitespace-nowrap">Nombre archivo:</span>
                      <input
                        type="text"
                        value={downloadFileName}
                        onChange={(e) => setDownloadFileName(e.target.value)}
                        className="w-32 bg-white dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded px-1.5 py-0.5 text-[10px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] font-mono"
                        placeholder="resultados_logs"
                      />
                      <button
                        onClick={handleDownloadAllLogsJson}
                        className="flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 hover:bg-[#71BF44]/10 hover:border-[#71BF44]/30 hover:text-[#71BF44] text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded transition-all shrink-0"
                        title="Descargar todos los logs filtrados en formato JSON"
                      >
                        JSON ({filteredLogs.length})
                      </button>
                    </div>
                  )}

                  {rawSqlResult && (
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Selectores de vista SQL */}
                      <div className="flex items-center gap-1 bg-white dark:bg-[#111] p-0.5 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                        <button
                          onClick={() => setSqlViewMode('grid')}
                          className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                            sqlViewMode === 'grid'
                              ? 'bg-[#71BF44] text-white dark:text-[#111]'
                              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                          }`}
                        >
                          Tabla
                        </button>
                        <button
                          onClick={() => setSqlViewMode('chart')}
                          className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                            sqlViewMode === 'chart'
                              ? 'bg-[#71BF44] text-white dark:text-[#111]'
                              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                          }`}
                        >
                          Gráfica
                        </button>
                        <button
                          onClick={() => setSqlViewMode('logs')}
                          className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                            sqlViewMode === 'logs'
                              ? 'bg-[#71BF44] text-white dark:text-[#111]'
                              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                          }`}
                        >
                          Logs
                        </button>
                      </div>

                      {sqlViewMode === 'chart' && (
                        <>
                          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setHiddenSeries(new Set())}
                              className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 hover:bg-[#71BF44]/10 hover:border-[#71BF44]/30 text-neutral-750 dark:text-neutral-300 hover:text-[#71BF44] rounded transition-all select-none"
                              title="Mostrar todas las series en el gráfico"
                            >
                              Mostrar Todas
                            </button>
                            <button
                              onClick={() => {
                                const { seriesList } = parseSqlChartData(rawSqlResult.columns, rawSqlResult.rows);
                                setHiddenSeries(new Set(seriesList));
                              }}
                              className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 hover:bg-red-500/10 hover:border-red-500/30 text-neutral-750 dark:text-neutral-300 hover:text-red-500 rounded transition-all select-none"
                              title="Ocultar todas las series en el gráfico"
                            >
                              Ocultar Todas
                            </button>
                          </div>
                        </>
                      )}

                      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />

                      {/* Botones de Descarga */}
                      <div className="flex items-center gap-2 font-sans">
                        <span className="text-[10px] text-neutral-450 hidden sm:inline whitespace-nowrap">Nombre archivo:</span>
                        <input
                          type="text"
                          value={downloadFileName}
                          onChange={(e) => setDownloadFileName(e.target.value)}
                          className="w-32 bg-white dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] font-mono"
                          placeholder="resultados_logs"
                        />
                        <button
                          onClick={handleDownloadSqlJson}
                          className="flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded transition-colors"
                        >
                          JSON
                        </button>
                        <button
                          onClick={handleDownloadSqlCsv}
                          className="flex items-center gap-1 text-[10px] font-bold bg-white dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded transition-colors"
                        >
                          CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {rawSqlResult && sqlViewMode === 'grid' ? (
                  /* VISTA GRID DE TABLA */
                  <div className="flex-1 overflow-auto p-3 bg-[#0d0d0d] text-neutral-200">
                    <div className="overflow-x-auto rounded-lg border border-neutral-850">
                      <table className="w-full text-left border-collapse text-[11px] font-mono">
                        <thead>
                          <tr className="bg-[#181818] border-b border-neutral-850 text-neutral-450 font-bold uppercase select-none">
                            {rawSqlResult.columns.map((col, i) => (
                              <th key={i} className="p-2 border-r border-neutral-850">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                          {rawSqlResult.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-[#1e1e1e]/40 transition-colors border-b border-neutral-900">
                              {row.map((cell, cellIndex) => {
                                const columnName = rawSqlResult.columns[cellIndex];
                                const isActionable = cell !== null && cell !== undefined && columnName;
                                return (
                                  <td key={cellIndex} className="p-2 border-r border-neutral-900 break-all select-all group relative">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <span className="truncate flex-1">
                                        {cell === null || cell === undefined ? (
                                          <span className="text-red-400 italic">null</span>
                                        ) : typeof cell === 'object' ? (
                                          JSON.stringify(cell)
                                        ) : (
                                          String(cell)
                                        )}
                                      </span>
                                      {isActionable && (
                                        <button
                                          onClick={() => handleSearchProperty(columnName, cell)}
                                          className="opacity-0 group-hover:opacity-100 bg-[#71BF44]/20 hover:bg-[#71BF44]/40 text-[#71BF44] dark:text-[#8ae65c] text-[9px] font-bold px-1.5 py-0.5 rounded transition-all shrink-0 select-none cursor-pointer"
                                          title={`Filtrar por ${cleanPropertyName(columnName)} = '${cell}'`}
                                        >
                                          Filtrar
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : rawSqlResult && sqlViewMode === 'chart' ? (
                  /* VISTA GRÁFICA DE RECHARTS LINECHART */
                  (() => {
                    const { chartData, seriesList } = parseSqlChartData(rawSqlResult.columns, rawSqlResult.rows);
                    return (
                      <div className="flex-1 bg-[#0d0d0d] p-4 flex flex-col min-h-0">
                        {chartData.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2 text-neutral-500 text-xs">
                            <Activity className="w-8 h-8 opacity-40 animate-pulse" />
                            <p>No hay datos con series de tiempo suficientes para mostrar la gráfica.</p>
                            <p className="text-[10px] text-neutral-600">Asegúrate de que la consulta incluya una columna 'time' y agrupaciones temporales.</p>
                          </div>
                        ) : (
                          <div className="flex-1 w-full min-h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 15, right: 30, left: -20, bottom: 5 }}>
                                <XAxis 
                                  dataKey="timeLabel" 
                                  tick={{ fill: '#888', fontSize: 9 }}
                                  axisLine={{ stroke: '#333' }}
                                  tickLine={{ stroke: '#333' }}
                                />
                                <YAxis 
                                  tick={{ fill: '#888', fontSize: 9 }}
                                  axisLine={{ stroke: '#333' }}
                                  tickLine={{ stroke: '#333' }}
                                  allowDecimals={false}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: '#181818',
                                    borderColor: '#333',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    color: '#fff'
                                  }}
                                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                                <Legend 
                                  verticalAlign="top" 
                                  align="right" 
                                  iconSize={8}
                                  wrapperStyle={{ fontSize: '9px', color: '#888', paddingBottom: '15px' }}
                                  onClick={handleLegendClick}
                                  formatter={renderLegendText}
                                />
                                {seriesList.map((seriesName, index) => {
                                  const colors = [
                                    '#71BF44', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899', 
                                    '#a855f7', '#14b8a6', '#6366f1', '#e11d48', '#10b981'
                                  ];
                                  const color = colors[index % colors.length];
                                  return (
                                    <Line
                                      key={seriesName}
                                      type="monotone"
                                      dataKey={seriesName}
                                      stroke={color}
                                      activeDot={{ r: 5 }}
                                      dot={{ r: 2 }}
                                      strokeWidth={1.5}
                                      hide={hiddenSeries.has(seriesName)}
                                    />
                                  );
                                })}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* VISTA ORIGINAL DE LISTA DE LOGS (CONSOLA) */
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 font-mono text-xs">
                    {filteredLogs.length === 0 ? (
                      logs.length > 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3 text-neutral-450 dark:text-neutral-400 select-none">
                          <AlertTriangle className="w-8 h-8 text-amber-500 opacity-80 animate-pulse" />
                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-neutral-250 dark:text-neutral-200">Resultados ocultos por filtros locales</p>
                            <p className="text-[11px] text-neutral-500 max-w-sm">
                              Se recuperaron {logs.length} logs de Seq que coinciden con tu consulta, pero están ocultos debido a los filtros de nivel de log seleccionados o al filtro de texto local (<strong>"{localSearchQuery}"</strong>).
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setLocalSearchQuery('');
                              setActiveLevels(new Set(LOG_LEVELS));
                              setActiveConnectionFilters(new Set(connections.map(c => c.id)));
                              showToast('Filtros locales restablecidos', 'success');
                            }}
                            className="mt-2 px-3 py-1.5 bg-[#71BF44]/10 hover:bg-[#71BF44]/20 border border-[#71BF44]/35 text-[#71BF44] dark:text-[#8ae65c] text-[10px] font-bold rounded-lg transition-all"
                          >
                            Restablecer filtros locales
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2 text-neutral-500">
                          <FileText className="w-8 h-8 opacity-40" />
                          <p className="text-xs">No hay eventos que mostrar. Configura tu conexión y ejecuta una consulta.</p>
                        </div>
                      )
                    ) : (
                      filteredLogs.map((log, index) => {
                        const isSqlAggregation = !log.Timestamp || isNaN(Date.parse(log.Timestamp));
                        const rowId = log.Id || `agg-${index}`;
                        const isExpanded = expandedLogIds.has(rowId);
                        const level = log.Level || 'Information';
                        const date = new Date(log.Timestamp);
                        const timeStr = isSqlAggregation 
                          ? 'SQL' 
                          : date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
                        
                        const message = isSqlAggregation
                          ? (log.Properties && log.Properties.length > 0 
                              ? log.Properties.map(p => `${p.Name}: ${typeof p.Value === 'object' ? JSON.stringify(p.Value) : String(p.Value)}`).join(' | ')
                              : '(Resultado de Agregación)')
                          : (log.RenderedMessage || log.MessageTemplate || '(Sin mensaje)');

                        return (
                          <div
                            key={rowId}
                            className={`group flex flex-col rounded border transition-all ${
                              log.isIgnored
                                ? 'opacity-50 bg-neutral-100/40 dark:bg-neutral-900/40 border-neutral-200/30 dark:border-neutral-800/30 my-0.5 text-neutral-400'
                                : isExpanded 
                                  ? 'bg-white/70 dark:bg-[#122e26] border-teal-200/50 dark:border-teal-800/40 my-1 text-[#0f2d26] dark:text-white shadow-sm' 
                                  : 'hover:bg-white/40 dark:hover:bg-[#112a23]/40 border-transparent text-[#12332c] dark:text-[#d1ebe6]'
                            }`}
                          >
                            <div
                              onClick={() => toggleLogExpand(rowId)}
                              className="flex items-start p-2 gap-2 cursor-pointer select-none"
                            >
                              <button className="text-teal-600/70 dark:text-teal-400 shrink-0 mt-0.5 transition-transform">
                                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              
                              <span className="text-[10px] text-teal-650 dark:text-teal-400 shrink-0 select-none mt-0.5 font-bold">{timeStr}</span>

                              {log.isIgnored && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500 flex items-center gap-0.5">
                                  Ignorado 🔕
                                </span>
                              )}

                              {log.connectionName && (
                                <span 
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none bg-teal-100/60 dark:bg-teal-950/40 border-teal-200/30 dark:border-teal-900/30 text-teal-800 dark:text-teal-300"
                                  title={`Origen: ${log.connectionName}`}
                                >
                                  {log.connectionName}
                                </span>
                              )}
                              
                              {isSqlAggregation ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none text-[#71BF44] bg-[#71BF44]/10 border-[#71BF44]/20">
                                  Agg
                                </span>
                              ) : (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none ${LEVEL_TEXT_CLASSES[level]}`}>
                                  {level === 'Information' ? 'Info' : level}
                                </span>
                              )}
                              
                              <span className={`text-[#0f2d26] dark:text-[#d1ebe6] break-all flex-1 ${
                                isExpanded 
                                  ? ((log.Properties && log.Properties.length > 0) || log.Exception) 
                                    ? 'line-clamp-1 text-teal-900/60 dark:text-teal-500 font-medium' 
                                    : 'line-clamp-none' 
                                  : 'line-clamp-1'
                              }`}>
                                {message}
                              </span>
 
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyLog(log);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-teal-600/70 hover:text-teal-900 dark:text-teal-450 dark:hover:text-white p-0.5 shrink-0 transition-opacity"
                                title="Copiar log completo (JSON)"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
 
                            {isExpanded && (
                              <div className="border-t border-teal-200/40 dark:border-[#1c3831] bg-white/45 dark:bg-[#0e211d]/50 p-3 flex flex-col gap-3 animate-fade-in text-[11px]">
                                {log.MessageTemplate && !isSqlAggregation && (
                                  <div>
                                    <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider mb-1">Message Template</h5>
                                    <div className="bg-white/80 dark:bg-[#15332c] border border-teal-200/30 dark:border-teal-900/35 p-2 rounded text-teal-900 dark:text-teal-100 font-mono select-all">
                                      {log.MessageTemplate}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider">Propiedades Estructuradas Interactivas</h5>
                                    <div className="flex items-center gap-2 select-none">
                                      <button
                                        onClick={() => handleCopyLog(log)}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-[#181818] border border-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2 py-1 rounded transition-colors"
                                        title="Copiar log completo (JSON)"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        Copiar JSON
                                      </button>
                                      <button
                                        onClick={() => handleDownloadLog(log)}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-[#181818] border border-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2 py-1 rounded transition-colors"
                                        title="Descargar log como archivo .json"
                                      >
                                        <FileText className="w-3 h-3 text-[#71BF44]" />
                                        Descargar JSON
                                      </button>
                                    </div>
                                  </div>
                                <div className="bg-[#181818] border border-neutral-850 rounded-lg overflow-hidden max-w-full">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-[#1e1e1e] border-b border-neutral-850 text-[10px] text-neutral-400 font-bold uppercase select-none">
                                          <th className="p-2 w-1/4">Propiedad</th>
                                          <th className="p-2 w-1/2">Valor</th>
                                          <th className="p-2 w-1/4 text-right">Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-900 font-mono text-[11px]">
                                        {log.Properties && log.Properties.map(p => (
                                          <tr key={p.Name} className="hover:bg-[#181818]/45 transition-colors">
                                            <td className="p-2 font-semibold text-[#71BF44] break-all">{p.Name}</td>
                                            <td className="p-2 text-neutral-100 break-all">{typeof p.Value === 'object' ? JSON.stringify(p.Value) : String(p.Value)}</td>
                                            <td className="p-2 text-right whitespace-nowrap space-x-1.5 select-none">
                                              <button
                                                onClick={() => handleSearchProperty(p.Name, p.Value)}
                                                className="text-[9px] font-bold bg-[#71BF44]/10 hover:bg-[#71BF44]/20 text-[#71BF44] px-1.5 py-0.5 rounded transition-colors"
                                                title={`Filtrar por ${p.Name} = ${p.Value}`}
                                              >
                                                Buscar (+)
                                              </button>
                                              <button
                                                onClick={() => handleSearchOthers(p.Name)}
                                                className="text-[9px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded transition-colors"
                                                title={`Ver valores distintos de ${p.Name}`}
                                              >
                                                Otros
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const propJson = JSON.stringify({ [p.Name]: p.Value }, null, 2);
                                                  navigator.clipboard.writeText(propJson)
                                                    .then(() => showToast(`Propiedad '${p.Name}' copiada`, 'success'))
                                                    .catch(err => showToast(`Error al copiar: ${err.message}`, 'error'));
                                                }}
                                                className="text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-350 px-1.5 py-0.5 rounded transition-colors"
                                                title="Copiar propiedad y valor en formato JSON"
                                              >
                                                Copiar
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                        {log.Exception && (
                                          <tr className="hover:bg-[#181818]/45 transition-colors">
                                            <td className="p-2 font-semibold text-red-400 break-all">@Exception</td>
                                            <td className="p-2 text-neutral-100 break-all font-mono whitespace-pre-wrap">{log.Exception}</td>
                                            <td className="p-2 text-right whitespace-nowrap space-x-1.5 select-none">
                                              <button
                                                onClick={() => handleSearchProperty('@Exception', log.Exception)}
                                                className="text-[9px] font-bold bg-[#71BF44]/10 hover:bg-[#71BF44]/20 text-[#71BF44] px-1.5 py-0.5 rounded transition-colors"
                                              >
                                                Buscar (+)
                                              </button>
                                              <button
                                                onClick={() => handleSearchOthers('@Exception')}
                                                className="text-[9px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded transition-colors"
                                              >
                                                Otros
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const excJson = JSON.stringify({ "@Exception": log.Exception }, null, 2);
                                                  navigator.clipboard.writeText(excJson)
                                                    .then(() => showToast('Excepción copiada', 'success'))
                                                    .catch(err => showToast(`Error al copiar: ${err.message}`, 'error'));
                                                }}
                                                className="text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-350 px-1.5 py-0.5 rounded transition-colors"
                                                title="Copiar excepción en formato JSON"
                                              >
                                                Copiar
                                              </button>
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </main>
          </>
        )}

        {/* Pestaña de Tareas */}
        {activeTab === 'tasks' && (
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-[#0d0d0d] flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Tareas de Monitoreo Activo</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Reglas en segundo plano ejecutadas periódicamente que disparan notificaciones o webhooks HTTP.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({
                    name: '',
                    connectionId: selectedConnectionId,
                    query: currentFilter,
                    intervalSeconds: 60,
                    condition: 'is_not_empty',
                    conditionValue: '0',
                    actionType: 'notification',
                    actionWebhookUrl: ''
                  });
                  setIsTaskModalOpen(true);
                }}
                className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Tarea
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl p-12 flex flex-col items-center justify-center text-center text-neutral-500">
                <Bell className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No hay tareas programadas actualmente</p>
                <p className="text-xs mt-1 max-w-sm text-neutral-400">Crea una regla de control para buscar patrones de error recurrentes de forma automática.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col gap-3 justify-between shadow-sm">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{task.name}</h4>
                          <span className="text-[10px] text-neutral-500 font-mono break-all">{task.seqUrl}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#71BF44] bg-[#71BF44]/10 border border-[#71BF44]/20 px-2 py-0.5 rounded-full uppercase">
                          Cada {task.intervalSeconds}s
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-1.5 text-xs text-neutral-550 dark:text-neutral-400">
                        {task.query && (
                          <div className="flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span className="font-mono bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-850 px-1.5 py-0.5 rounded truncate text-neutral-850 dark:text-neutral-300" title={task.query}>
                              {task.query}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                          <span>Condición: 
                            <strong className="text-neutral-800 dark:text-neutral-200 ml-1">
                              {task.condition === 'is_empty' ? 'Está Vacío (0)' :
                               task.condition === 'is_not_empty' ? 'No Vacío (>0)' :
                               task.condition === 'count_greater_than' ? `Mayor a ${task.conditionValue}` :
                               `Igual a ${task.conditionValue}`}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                          <span className="truncate">Acción: 
                            <strong className="text-neutral-800 dark:text-neutral-200 ml-1 uppercase">
                              {task.actionType === 'notification' ? 'Notificación Web' : `Webhook (${task.actionWebhookUrl})`}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                          <span>Última ejecución: 
                            <span className="text-neutral-700 dark:text-neutral-300 ml-1">
                              {task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Pendiente de inicio'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-3">
                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setTaskForm({
                            name: task.name,
                            connectionId: connections.find(c => c.url === task.seqUrl)?.id || '',
                            query: task.query || '',
                            intervalSeconds: task.intervalSeconds,
                            condition: task.condition,
                            conditionValue: task.conditionValue || '0',
                            actionType: task.actionType,
                            actionWebhookUrl: task.actionWebhookUrl || ''
                          });
                          setIsTaskModalOpen(true);
                        }}
                        className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pestaña de Conexiones */}
        {activeTab === 'connections' && (
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-[#0d0d0d] flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Conexiones a Seq</h3>
                <p className="text-xs text-neutral-550 dark:text-neutral-400 mt-1">
                  Gestiona las URL y credenciales de acceso a las instancias de Seq habilitadas para monitoreo.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingConnection(null);
                  setConnectionForm({ name: '', url: '', apiKey: '', usuario: '', clave: '' });
                  setIsConnectionModalOpen(true);
                }}
                className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Conexión
              </button>
            </div>

            {connections.length === 0 ? (
              <div className="border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl p-12 flex flex-col items-center justify-center text-center text-neutral-500">
                <Server className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No hay servidores configurados</p>
                <p className="text-xs mt-1 text-neutral-400">Agrega tu primer servidor de Seq para comenzar a monitorear eventos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connections.map(conn => (
                  <div key={conn.id} className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col gap-3 justify-between shadow-sm">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{conn.name}</h4>
                        <Server className="w-4 h-4 text-[#71BF44] opacity-80" />
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-mono break-all flex items-center gap-1">
                        <a 
                          href={conn.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="hover:text-[#71BF44] hover:underline flex items-center gap-1.5"
                        >
                          {conn.url}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="inline-block text-[10px] font-bold bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-450">
                          {conn.apiKey ? 'API Key Configurada' : 'Sin API Key'}
                        </span>
                        {isAdmin && (conn.usuario || conn.clave) && (
                          <span className="inline-block text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">
                            Credenciales Guardadas
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="mt-3 space-y-2 border-t border-neutral-100 dark:border-neutral-900 pt-3">
                          {conn.usuario && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-400">Usuario:</span>
                              <span className="font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-850 truncate max-w-[150px]">
                                {conn.usuario}
                              </span>
                            </div>
                          )}
                          {conn.clave && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-400">Clave:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-850 max-w-[150px] truncate select-all">
                                  ••••••••
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(conn.clave || '')
                                      .then(() => showToast('Clave copiada al portapapeles', 'success'))
                                      .catch(err => showToast(`Error al copiar: ${err.message}`, 'error'));
                                  }}
                                  className="text-neutral-400 hover:text-[#71BF44] p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                  title="Copiar Clave"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-3">
                      <button
                        onClick={() => {
                          setEditingConnection(conn);
                          setConnectionForm({
                            name: conn.name,
                            url: conn.url,
                            apiKey: conn.apiKey || '',
                            usuario: conn.usuario || '',
                            clave: conn.clave || ''
                          });
                          setIsConnectionModalOpen(true);
                        }}
                        className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => deleteConnection(conn.id)}
                        className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pestaña de Errores Silenciados / Ignorados */}
        {activeTab === 'ignored' && (
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-50 dark:bg-[#0d0d0d] flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <BellOff className="w-5 h-5 text-neutral-550 dark:text-neutral-400" />
                  Errores Silenciados (Ignorados)
                </h3>
                <p className="text-xs text-neutral-550 dark:text-neutral-400 mt-1">
                  Gestiona los patrones de error configurados para no disparar alertas automáticas en n8n ni contabilizarse en las simulaciones de alerta.
                </p>
              </div>
            </div>

            {ignoredErrors.length === 0 ? (
              <div className="border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl p-12 flex flex-col items-center justify-center text-center text-neutral-500">
                <BellOff className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No hay errores silenciados</p>
                <p className="text-xs mt-1 text-neutral-400 font-sans">
                  Usa el menú desplegable "Ignorar..." de un error en el tablero de análisis para silenciarlo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ignoredErrors.map(err => {
                  const isExpired = err.expiresAt && new Date(err.expiresAt).getTime() < Date.now();
                  const expirationDate = err.expiresAt ? new Date(err.expiresAt) : null;
                  const timeOptionLabels = {
                    hoy: 'Hoy',
                    semana: '1 Semana',
                    mes: '1 Mes',
                    manual: 'Manual'
                  };

                  return (
                    <div key={err.id} className={`bg-white dark:bg-[#111] border rounded-xl p-4 flex flex-col gap-3 justify-between shadow-sm transition-all ${
                      isExpired ? 'border-red-200 dark:border-red-905/30 opacity-60' : 'border-neutral-200 dark:border-neutral-800'
                    }`}>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white break-all font-mono bg-neutral-50 dark:bg-neutral-900/60 p-2 rounded border border-neutral-200 dark:border-neutral-800 flex-1">
                            {err.pattern}
                          </span>
                          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded border ${
                            isExpired 
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' 
                              : 'bg-[#71BF44]/10 border-[#71BF44]/20 text-[#71BF44]'
                          }`}>
                            {isExpired ? 'Expirado' : 'Activo'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-neutral-550 dark:text-neutral-400">
                          <div className="flex justify-between">
                            <span>Tipo de Duración:</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 uppercase">
                              {timeOptionLabels[err.timeOption as keyof typeof timeOptionLabels] || err.timeOption}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fecha de Expiración:</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
                              {expirationDate ? expirationDate.toLocaleString() : 'Nunca (Permanente)'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-neutral-450">
                            <span>Creado Por:</span>
                            <span className="truncate max-w-[180px]" title={err.createdBy}>{err.createdBy}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-neutral-450">
                            <span>Creado el:</span>
                            <span>{new Date(err.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end border-t border-neutral-100 dark:border-neutral-900 pt-3 mt-1">
                        <button
                          onClick={() => handleUnignoreError(err.id)}
                          className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 text-neutral-700 dark:text-neutral-350"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          Remover Silencio
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODAL GUARDAR/EDITAR QUERY --- */}
      {isSaveQueryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                {editingQuery ? 'Editar Consulta' : 'Guardar Consulta'}
              </h3>
              <button 
                onClick={() => {
                  setIsSaveQueryModalOpen(false);
                  setEditingQuery(null);
                }} 
                className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-450 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveQuery} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Nombre de la Consulta</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Errores de API"
                  value={queryNameInput}
                  onChange={(e) => setQueryNameInput(e.target.value)}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Expresión de Filtro</label>
                <textarea
                  value={queryFilterInput}
                  onChange={(e) => setQueryFilterInput(e.target.value)}
                  placeholder="Escribe el query o filtro aquí..."
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white font-mono h-24 resize-y focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveQueryModalOpen(false);
                    setEditingQuery(null);
                  }}
                  className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg text-neutral-600 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingQuery ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL NUEVA/EDITAR TAREA --- */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-lg shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea de Monitoreo'}
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-neutral-550 hover:text-neutral-805 dark:text-neutral-400 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Nombre de la Tarea</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Alerta Errores RAG"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Servidor Seq</label>
                <select
                  required
                  value={taskForm.connectionId}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, connectionId: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                >
                  <option value="">-- Selecciona una conexión --</option>
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.url})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Consulta de Filtro</label>
                <input
                  type="text"
                  placeholder="Ej: @Level = 'Error'"
                  value={taskForm.query}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, query: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Intervalo (segundos)</label>
                  <input
                    type="number"
                    min="5"
                    required
                    value={taskForm.intervalSeconds}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, intervalSeconds: parseInt(e.target.value) || 60 }))}
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Condición</label>
                  <select
                    value={taskForm.condition}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, condition: e.target.value }))}
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                  >
                    <option value="is_not_empty">No Vacío (&gt; 0 logs)</option>
                    <option value="is_empty">Vacío (0 logs)</option>
                    <option value="count_greater_than">Cantidad Mayor A</option>
                    <option value="count_equal_to">Cantidad Igual A</option>
                  </select>
                </div>

                {(taskForm.condition === 'count_greater_than' || taskForm.condition === 'count_equal_to') && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Valor Límite</label>
                    <input
                      type="number"
                      value={taskForm.conditionValue}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, conditionValue: e.target.value }))}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Acción</label>
                  <select
                    value={taskForm.actionType}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, actionType: e.target.value }))}
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                  >
                    <option value="notification">Notificación Web</option>
                    <option value="webhook">Llamar Webhook HTTP</option>
                  </select>
                </div>

                {taskForm.actionType === 'webhook' && (
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">URL del Webhook</label>
                    <input
                      type="url"
                      required
                      placeholder="https://webhook.site/..."
                      value={taskForm.actionWebhookUrl}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, actionWebhookUrl: e.target.value }))}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg text-neutral-600 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL NUEVA/EDITAR CONEXIÓN --- */}
      {isConnectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                {editingConnection ? 'Editar Conexión' : 'Nueva Conexión a Seq'}
              </h3>
              <button onClick={() => setIsConnectionModalOpen(false)} className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-450 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveConnection} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Nombre de la Conexión</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Producción API"
                  value={connectionForm.name}
                  onChange={(e) => setConnectionForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">URL de Seq</label>
                <input
                  type="url"
                  required
                  placeholder="http://192.168.1.100:5341"
                  value={connectionForm.url}
                  onChange={(e) => setConnectionForm(prev => ({ ...prev, url: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#71BF44] dark:text-[#71BF44] font-bold uppercase tracking-wider">API Key (Opcional)</label>
                <input
                  type="password"
                  placeholder="Tu API key de Seq"
                  value={connectionForm.apiKey}
                  onChange={(e) => setConnectionForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                />
              </div>

              {isAdmin && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Usuario Seq</label>
                    <input
                      type="text"
                      placeholder="Nombre de usuario"
                      value={connectionForm.usuario}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, usuario: e.target.value }))}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Clave Seq</label>
                    <input
                      type="password"
                      placeholder="Contraseña de usuario"
                      value={connectionForm.clave}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, clave: e.target.value }))}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                <button
                  type="button"
                  onClick={() => setIsConnectionModalOpen(false)}
                  className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg text-neutral-600 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Guardar Conexión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIGURAR ALERTA DINÁMICA --- */}
      {isAlertModalOpen && selectedQueryForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 w-full max-w-4xl shadow-2xl animate-scale-in flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#71BF44]" />
                  Configurar Alerta para N8N
                </h3>
                <p className="text-[11px] text-neutral-450">
                  Consulta: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{selectedQueryForAlert.name}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(false)}
                  className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-3 py-2 rounded-lg text-neutral-600 dark:text-neutral-305 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveAlertConfig();
                    navigator.clipboard.writeText(customJsAlert);
                    setIsAlertModalOpen(false);
                  }}
                  className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Copiar y Guardar Alerta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Ajustes de Configuración */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <h4 className="text-xs font-bold text-[#71BF44] uppercase tracking-wider">Parámetros del Umbral</h4>
                
                {/* Control de Activación de Monitoreo */}
                <div className="flex items-center justify-between bg-[#71BF44]/5 border border-[#71BF44]/20 p-2.5 rounded-lg mb-2">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-250">Monitoreo Activo</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertConfig.isActive}
                      onChange={(e) => setAlertConfig(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-300 dark:bg-neutral-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#71BF44]"></div>
                  </label>
                </div>

                {/* Editor de la Consulta evaluada */}
                <div className="flex flex-col gap-1.5 border border-neutral-200 dark:border-neutral-800/80 p-2.5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] text-neutral-500 dark:text-neutral-400 font-bold uppercase">Consulta Evaluada</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpdateAndSaveQuery}
                        className="text-[9px] font-bold text-[#71BF44] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Guardar la consulta editada en el monitor y refrescar simulación"
                      >
                        <Save className="w-2.5 h-2.5" />
                        Guardar Filtro
                      </button>
                      <span className="text-neutral-300 dark:text-neutral-700 text-[10px]">|</span>
                      <button
                        type="button"
                        onClick={handleUpdateSimulation}
                        className="text-[9px] font-bold text-neutral-600 dark:text-neutral-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Ejecutar consulta en Seq y actualizar logs de la simulación"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Solo Simular
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={alertQueryFilter}
                    onChange={(e) => setAlertQueryFilter(e.target.value)}
                    placeholder="Filtro de consulta..."
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800/80 rounded-lg p-2 text-xs text-neutral-900 dark:text-white font-mono h-16 resize-y focus:outline-none focus:border-[#71BF44] placeholder:opacity-30"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-neutral-400 font-bold uppercase">Ventana de Tiempo (Minutos)</label>
                  <input
                    type="number"
                    min="1"
                    value={alertConfig.timeWindowMinutes}
                    onChange={(e) => setAlertConfig(prev => ({ ...prev, timeWindowMinutes: Math.max(1, parseInt(e.target.value) || 10) }))}
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
                  />
                </div>

                <div className="border-t border-neutral-100 dark:border-neutral-900 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase tracking-wider">Mesa de Ayuda (Errores del Cliente)</span>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase"># Eventos Umbral</label>
                    <input
                      type="number"
                      min="1"
                      value={alertConfig.clientEventsThreshold}
                      onChange={(e) => setAlertConfig(prev => ({ ...prev, clientEventsThreshold: Math.max(1, parseInt(e.target.value) || 30) }))}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
                    />
                    <span className="text-[10px] text-neutral-450 italic">Alertará si una combinación (_cliente / _hostname) tiene &gt;= {alertConfig.clientEventsThreshold} errores en {alertConfig.timeWindowMinutes} min.</span>
                  </div>
                </div>

                <div className="border-t border-neutral-100 dark:border-neutral-900 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase tracking-wider">Infraestructura (Errores del Servidor)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-neutral-400 font-bold uppercase"># Eventos</label>
                      <input
                        type="number"
                        min="1"
                        value={alertConfig.serverEventsThreshold}
                        onChange={(e) => setAlertConfig(prev => ({ ...prev, serverEventsThreshold: Math.max(1, parseInt(e.target.value) || 30) }))}
                        className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-neutral-400 font-bold uppercase">Mín. Clientes</label>
                      <input
                        type="number"
                        min="1"
                        value={alertConfig.serverClientsThreshold}
                        onChange={(e) => setAlertConfig(prev => ({ ...prev, serverClientsThreshold: Math.max(1, parseInt(e.target.value) || 3) }))}
                        className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-450 italic">Alertará si &gt;= {alertConfig.serverClientsThreshold} clientes distintos registran &gt;= {alertConfig.serverEventsThreshold} fallos de servidor en {alertConfig.timeWindowMinutes} min.</span>
                </div>

                <div className="border-t border-neutral-100 dark:border-neutral-900 pt-3 flex flex-col gap-2">
                  <span className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase tracking-wider">Detalles a incluir en Alerta</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'includeVersion', label: '_version' },
                      { key: 'includeApp', label: '_app' },
                      { key: 'includeHostname', label: 'Origen (_hostname)' },
                      { key: 'includeCliente', label: '_cliente' }
                    ].map(field => (
                      <label key={field.key} className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={(alertConfig as any)[field.key]}
                          onChange={(e) => setAlertConfig(prev => ({ ...prev, [field.key]: e.target.checked }))}
                          className="rounded border-neutral-350 dark:border-neutral-700 text-[#71BF44] focus:ring-0 w-3.5 h-3.5"
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visor de Código JS / Simulación */}
              <div className="lg:col-span-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAlertModalTab('script')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        alertModalTab === 'script'
                          ? 'bg-[#71BF44] text-white dark:text-[#131313]'
                          : 'bg-neutral-50 dark:bg-[#181818] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-105 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Script para N8N
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertModalTab('simulation')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        alertModalTab === 'simulation'
                          ? 'bg-[#71BF44] text-white dark:text-[#131313]'
                          : 'bg-neutral-50 dark:bg-[#181818] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-105 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span>Simulación en Vivo</span>
                      <span className={`w-2 h-2 rounded-full ${simulatedResult.alertaGenerada ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400'}`}></span>
                    </button>
                  </div>

                  {alertModalTab === 'script' ? (
                    <div className="flex items-center gap-2">
                      {isCustomAlertEdited && (
                        <button
                          onClick={() => {
                            setCustomJsAlert(generatedJsAlert);
                            setIsCustomAlertEdited(false);
                            showToast('Restablecido al script por defecto', 'info');
                          }}
                          type="button"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-[#131313] text-amber-500 rounded-lg transition-all text-[10px] font-bold"
                          title="Descartar cambios manuales y restablecer a la plantilla autogenerada"
                        >
                          <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
                          Restablecer
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(customJsAlert);
                          showToast('Script de alerta copiado al portapapeles', 'success');
                        }}
                        type="button"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#71BF44]/10 border border-[#71BF44]/30 hover:bg-[#71BF44] hover:text-white dark:hover:text-[#131313] text-[#71BF44] rounded-lg transition-all text-[10px] font-bold"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Script
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadCSV}
                        type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500 hover:text-white text-sky-600 dark:text-sky-400 rounded-lg transition-all text-[10px] font-bold"
                        title="Descargar datos simulados en formato CSV para Excel"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Descargar CSV
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(simulatedResult, null, 2));
                          showToast('Resultado de simulación copiado al portapapeles', 'success');
                        }}
                        type="button"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#71BF44]/10 border border-[#71BF44]/30 hover:bg-[#71BF44] hover:text-white dark:hover:text-[#131313] text-[#71BF44] rounded-lg transition-all text-[10px] font-bold"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar JSON
                      </button>
                    </div>
                  )}
                </div>

                {alertModalTab === 'script' ? (
                  <>
                    <textarea
                      value={customJsAlert}
                      onChange={(e) => {
                        setCustomJsAlert(e.target.value);
                        setIsCustomAlertEdited(true);
                      }}
                      className="bg-[#0b0b0b] border border-neutral-250 dark:border-neutral-850 rounded-xl p-4 font-mono text-[10.5px] leading-relaxed text-emerald-400 overflow-auto h-96 max-h-[50vh] w-full resize-y focus:outline-none focus:border-[#71BF44]"
                    />
                    <p className="text-[10px] text-neutral-450 italic mt-1">
                      Este código procesa dinámicamente el log, parsea el destino (ej. `RequestUri`) y envía payloads agrupados listos para los destinatarios (Mesa de Ayuda / Infraestructura). Puedes editarlo libremente en esta caja de texto.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Banner de Estado de la Simulación */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      simulatedResult.alertaGenerada 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Bell className={`w-4 h-4 ${simulatedResult.alertaGenerada ? 'animate-bounce text-amber-500' : 'text-emerald-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {simulatedResult.alertaGenerada ? 'ALERTA SÍ GENERADA (Se superaron los umbrales)' : 'SIN ALERTAS (No se superaron los umbrales)'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded font-mono text-neutral-700 dark:text-neutral-350">
                        {logs.length} logs evaluados
                      </span>
                    </div>

                    {/* JSON de Resultados de Simulación */}
                    <div className="bg-[#0b0b0b] border border-neutral-250 dark:border-neutral-850 rounded-xl p-4 font-mono text-[10.5px] leading-relaxed text-emerald-400 overflow-auto h-80 max-h-[42vh]">
                      {renderHighlightedJson([
                        { Name: 'resultadoSimulacion', Value: simulatedResult }
                      ])}
                    </div>
                    <p className="text-[10px] text-neutral-450 italic">
                      Esta simulación corre localmente sobre los {logs.length} logs que están actualmente cargados en pantalla en el monitor, aplicando las mismas reglas exactas.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-2"></div>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONFIRMACIÓN PERSONALIZADO --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-250 dark:border-neutral-800 rounded-xl p-5 w-full max-w-sm shadow-2xl animate-scale-in flex flex-col gap-4">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-350 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2 rounded-lg text-neutral-600 dark:text-neutral-350 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL SILENCIAR ERROR (IGNORAR) --- */}
      {isIgnoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-lg shadow-2xl animate-scale-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-1">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <BellOff className="w-4 h-4 text-[#71BF44]" />
                Silenciar Evento (Ignorar)
              </h3>
              <button 
                onClick={() => {
                  setIsIgnoreModalOpen(false);
                }} 
                className="text-neutral-550 hover:text-neutral-800 dark:text-neutral-450 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Texto Original del Error</label>
                <div className="bg-neutral-50 dark:bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-850 text-xs text-neutral-600 dark:text-neutral-400 font-mono break-all max-h-24 overflow-y-auto select-all">
                  {ignoreOriginalError}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Patrón de Texto para Excluir</label>
                <textarea
                  value={ignorePattern}
                  onChange={(e) => setIgnorePattern(e.target.value)}
                  placeholder="El evento se ignorará si contiene este texto..."
                  className="w-full bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-white font-mono h-24 resize-y focus:outline-none focus:border-[#71BF44]"
                />
                <span className="text-[10px] text-neutral-450 italic">
                  Puedes editar este texto para excluir una frase más general y filtrar variaciones dinámicas del mismo error.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Duración de la Exclusión</label>
                  <select
                    value={ignoreDurationOption}
                    onChange={(e) => {
                      const option = e.target.value as any;
                      setIgnoreDurationOption(option);
                      if (option === 'manual') {
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        const tzOffset = tomorrow.getTimezoneOffset() * 60000;
                        const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
                        setIgnoreManualDate(localISOTime);
                      }
                    }}
                    className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] cursor-pointer"
                  >
                    <option value="hoy">Hoy (Hasta las 23:59)</option>
                    <option value="semana">1 Semana (7 días)</option>
                    <option value="mes">1 Mes (30 días)</option>
                    <option value="manual">Manual (Fecha específica)</option>
                  </select>
                </div>

                {ignoreDurationOption === 'manual' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-neutral-550 dark:text-neutral-400 font-bold uppercase">Fecha y Hora Límite</label>
                    <input
                      type="datetime-local"
                      value={ignoreManualDate}
                      onChange={(e) => setIgnoreManualDate(e.target.value)}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-850 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44] w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 border-t border-neutral-100 dark:border-neutral-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsIgnoreModalOpen(false);
                }}
                className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleIgnoreError(ignorePattern, ignoreDurationOption, ignoreManualDate);
                  setIsIgnoreModalOpen(false);
                }}
                disabled={!ignorePattern.trim()}
                className="bg-[#71BF44] hover:bg-[#71BF44]/90 disabled:opacity-55 disabled:cursor-not-allowed text-white dark:text-[#131313] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <BellOff className="w-3.5 h-3.5" />
                Ignorar Evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
