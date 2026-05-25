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
  Save
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const DEFAULT_QUERIES: SavedQuery[] = [
  { id: 'q-all', name: 'Todos los Logs', filter: '' },
  { id: 'q-err', name: 'Errores y Fatal', filter: "@Level = 'Error' or @Level = 'Fatal'" },
  { id: 'q-warn', name: 'Advertencias (Warning)', filter: "@Level = 'Warning'" },
  { id: 'q-info', name: 'Mensajes Informativos', filter: "@Level = 'Information'" },
  { id: 'q-ai', name: 'AI & RAG Flows', filter: "App = 'RAG' or App = 'SARA' or @Message like '%RAG%' or @Message like '%SARA%'" },
  { id: 'q-exc', name: 'Excepciones / Errores Críticos', filter: "has(@Exception) or @Level = 'Fatal'" }
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

export default function SeqMonitor() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'tasks' | 'connections'>('monitor');
  const [isDarkMode, setIsDarkMode] = useState(false);

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
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionStatusText, setConnectionStatusText] = useState<string>('Desconectado');
  
  // Queries
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [currentFilter, setCurrentFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [logs, setLogs] = useState<SeqLog[]>([]);
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
  
  // Ediciones en Modales
  const [editingTask, setEditingTask] = useState<SeqTask | null>(null);
  const [editingConnection, setEditingConnection] = useState<SeqConnection | null>(null);
  
  // Inputs Formularios Modales
  const [queryNameInput, setQueryNameInput] = useState('');
  
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
    apiKey: ''
  });

  // Logs expandidos
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Refs para temporizadores y streaming
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef({ seqUrl: '', apiKey: '', currentFilter: '', limit: 50, isStreaming: false });

  // Sincronizar referencias del estado para el callback de setInterval
  useEffect(() => {
    const activeConn = connections.find(c => c.id === selectedConnectionId);
    stateRef.current = {
      seqUrl: activeConn?.url || '',
      apiKey: activeConn?.apiKey || '',
      currentFilter,
      limit,
      isStreaming
    };
  }, [connections, selectedConnectionId, currentFilter, limit, isStreaming]);

  // Mostrar Toast
  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Cargar Ajustes y Datos al inicio
  useEffect(() => {
    // Cargar queries guardadas de localStorage
    const saved = localStorage.getItem('seq_monitor_queries');
    if (saved) {
      setSavedQueries(JSON.parse(saved));
    } else {
      setSavedQueries(DEFAULT_QUERIES);
      localStorage.setItem('seq_monitor_queries', JSON.stringify(DEFAULT_QUERIES));
    }

    // Cargar límite
    const savedLimit = localStorage.getItem('seq_monitor_limit');
    if (savedLimit) {
      setLimit(parseInt(savedLimit, 10));
    }

    // Cargar conexiones y tareas iniciales
    fetchConnections();
    fetchTasks();

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

  // CRUD Conexiones
  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/seq/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
        // Autoseleccionar la primera si no hay ninguna seleccionada
        if (data.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(data[0].id);
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
        apiKey: connectionForm.apiKey
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
        setConnectionForm({ name: '', url: '', apiKey: '' });
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
    if (!confirm('¿Seguro que deseas eliminar esta conexión?')) return;
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
    if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
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
  };

  // Obtener logs de Seq
  const fetchLogs = async (isAutoRefresh = false) => {
    const { seqUrl, apiKey, currentFilter: filterExpr, limit: maxCount } = stateRef.current;
    if (!seqUrl) {
      if (!isAutoRefresh) showToast('No hay una conexión de Seq activa', 'warning');
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        seqUrl,
        count: maxCount.toString(),
        render: 'true'
      });
      
      if (filterExpr && filterExpr.trim() !== '') {
        queryParams.append('filter', filterExpr);
      }

      const response = await fetch(`/api/seq/events?${queryParams}`, {
        headers: {
          'X-Seq-ApiKey': apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(`Error de Seq: ${errorData.error || 'Servidor inalcanzable'}`, 'error');
        if (isStreaming) stopStreaming();
        return;
      }

      const data = await response.json();
      const fetchedLogs = Array.isArray(data) ? data : (data.Events || []);

      setLogs(prevLogs => {
        if (!isAutoRefresh) return fetchedLogs;
        
        // Unificar y evitar duplicados por ID
        const existingIds = new Set(prevLogs.map(l => l.Id));
        const newLogs = fetchedLogs.filter((l: any) => !existingIds.has(l.Id));
        
        if (newLogs.length === 0) return prevLogs;

        const combined = [...newLogs, ...prevLogs];
        // Recortar al límite
        return combined.slice(0, maxCount * 2);
      });

    } catch (err: any) {
      console.error(err);
      showToast(`Error de conexión: ${err.message}`, 'error');
      if (isStreaming) stopStreaming();
    }
  };

  // Conectarse manualmente a la conexión seleccionada
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const conn = connections.find(c => c.id === selectedConnectionId);
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
    setLogs([]);
    showToast('Consola e inputs restablecidos', 'info');
  };

  // Guardar consulta personalizada
  const handleSaveQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryNameInput.trim()) return;

    const newQuery: SavedQuery = {
      id: 'q-custom-' + Date.now(),
      name: queryNameInput.trim(),
      filter: currentFilter
    };

    const updated = [...savedQueries, newQuery];
    setSavedQueries(updated);
    localStorage.setItem('seq_monitor_queries', JSON.stringify(updated));
    setIsSaveQueryModalOpen(false);
    setQueryNameInput('');
    showToast(`Consulta "${newQuery.name}" guardada`, 'success');
  };

  // Borrar consulta guardada
  const handleDeleteQuery = (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('seq_monitor_queries', JSON.stringify(updated));
    showToast('Consulta guardada eliminada', 'info');
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

  // Expandir / colapsar log
  const toggleLogExpand = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Buscar eventos por una propiedad de forma acumulativa
  const handleSearchProperty = (name: string, value: any) => {
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

    const cond = `${name} = ${formattedValue}`;
    let newFilter = '';

    if (!currentFilter || currentFilter === '*' || currentFilter.trim() === '') {
      newFilter = `has(${name}) and ${cond}`;
    } else {
      if (currentFilter.includes(cond)) {
        showToast(`El filtro ya contiene la condición: ${cond}`, 'info');
        return;
      }
      newFilter = `${currentFilter} and ${cond}`;
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
    const newFilter = `select distinct(${name}) from stream`;
    setCurrentFilter(newFilter);
    showToast(`Buscando valores distintos de: ${name}`, 'success');

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

  // Filtrado local y por texto (Memoizado)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
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
    });
  }, [logs, activeLevels, localSearchQuery]);

  // Agrupamiento de Gráfico (Recharts AreaChart)
  const chartData = useMemo(() => {
    const validLogs = logs.filter(log => log.Timestamp && !isNaN(Date.parse(log.Timestamp)));
    if (validLogs.length === 0) {
      return [{ timeLabel: 'Sin Datos', Verbose: 0, Debug: 0, Information: 0, Warning: 0, Error: 0, Fatal: 0, startIso: '', endIso: '' }];
    }

    // Agrupar en intervalos de 10 segundos
    const intervalMetadata: { [key: number]: { label: string; startIso: string; endIso: string } } = {};
    validLogs.forEach(log => {
      const date = new Date(log.Timestamp);
      const roundedSeconds = Math.floor(date.getSeconds() / 10) * 10;
      
      const startOfInterval = new Date(date);
      startOfInterval.setSeconds(roundedSeconds, 0);
      
      const endOfInterval = new Date(startOfInterval);
      endOfInterval.setSeconds(startOfInterval.getSeconds() + 10);

      const labelTime = startOfInterval.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const key = startOfInterval.getTime();

      if (!intervalMetadata[key]) {
        intervalMetadata[key] = {
          label: labelTime,
          startIso: startOfInterval.toISOString(),
          endIso: endOfInterval.toISOString()
        };
      }
    });

    const sortedKeys = Object.keys(intervalMetadata).map(Number).sort((a, b) => a - b);

    // Mapear conteos por nivel en los intervalos temporales definidos
    return sortedKeys.map(key => {
      const meta = intervalMetadata[key];
      const intervalLogs = validLogs.filter(log => {
        const logTime = new Date(log.Timestamp).getTime();
        return logTime >= key && logTime < (key + 10000);
      });

      const row: any = {
        timeLabel: meta.label,
        startIso: meta.startIso,
        endIso: meta.endIso,
        Verbose: 0,
        Debug: 0,
        Information: 0,
        Warning: 0,
        Error: 0,
        Fatal: 0
      };

      intervalLogs.forEach(log => {
        const lvl = log.Level || 'Information';
        if (row[lvl] !== undefined) {
          row[lvl]++;
        }
      });

      return row;
    });
  }, [logs]);

  // Aplicar filtros haciendo clic en el gráfico
  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const clickedData = data.activePayload[0].payload;
      const start = clickedData.startIso;
      const end = clickedData.endIso;
      const timeLabel = clickedData.timeLabel;
      
      // Aplicar filtro temporal en Seq
      const filterExpr = `@Timestamp >= DateTime('${start}') and @Timestamp < DateTime('${end}')`;
      setCurrentFilter(filterExpr);
      showToast(`Filtrando logs en el intervalo temporal: ${timeLabel}`, 'info');
      // Forzar recarga con el nuevo filtro
      setTimeout(() => fetchLogs(false), 50);
    }
  };

  const handleLevelClick = (level: string) => {
    const filterExpr = `@Level = '${level}'`;
    setCurrentFilter(filterExpr);
    showToast(`Filtrando logs por nivel: ${level}`, 'info');
    setTimeout(() => fetchLogs(false), 50);
  };

  // Toggle de nivel en los chips de filtro local
  const toggleLocalLevel = (lvl: string) => {
    setActiveLevels(prev => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
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
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">{connectionStatusText}</span>
            </div>
          </div>
        </div>

        {/* Navegación Tabs Oficiales */}
        <div className="shrink-0 self-start sm:self-center -mb-4 sm:mb-0">
          <Tabs
            tabs={[
              { id: 'monitor', label: 'Monitor', icon: <Activity className="w-4 h-4" /> },
              { id: 'tasks', label: 'Tareas', icon: <Bell className="w-4 h-4" /> },
              { id: 'connections', label: 'Conexiones', icon: <Server className="w-4 h-4" /> }
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
            {/* Sidebar de Conexiones y Filtros */}
            <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111] hidden md:flex flex-col p-4 shrink-0 overflow-y-auto gap-5">
              
              {/* Conexión activa */}
              <section className="flex flex-col gap-2.5">
                <h4 className="text-[10px] font-bold text-[#71BF44] dark:text-[#71BF44] tracking-wider uppercase">Conexión Activa</h4>
                <form onSubmit={handleConnect} className="flex flex-col gap-2">
                  <select
                    value={selectedConnectionId}
                    onChange={(e) => {
                      setSelectedConnectionId(e.target.value);
                      setConnectionStatus('disconnected');
                      setConnectionStatusText('Desconectado');
                    }}
                    className="w-full bg-white dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg p-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                  >
                    <option value="">-- Selecciona --</option>
                    {connections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedConnectionId || connectionStatus === 'connecting'}
                    className="w-full bg-[#71BF44] text-white dark:text-[#131313] hover:bg-[#71BF44]/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Conectar
                  </button>
                </form>
              </section>

              {/* Consultas Guardadas */}
              <section className="flex-1 flex flex-col min-h-0 gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-[#71BF44] dark:text-[#71BF44] tracking-wider uppercase">Queries Guardadas</h4>
                  <button
                    onClick={() => {
                      setQueryNameInput('');
                      setIsSaveQueryModalOpen(true);
                    }}
                    className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors"
                    title="Guardar consulta actual"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {savedQueries.map(q => {
                    const isActive = currentFilter === q.filter;
                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          setCurrentFilter(q.filter);
                          setTimeout(() => fetchLogs(false), 50);
                        }}
                        className={`group flex items-start justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                          isActive 
                            ? 'bg-[#71BF44]/10 border-[#71BF44]/30 text-[#71BF44] dark:text-white font-medium' 
                            : 'bg-white dark:bg-[#181818]/50 border-neutral-200 dark:border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-800'
                        }`}
                        title={q.filter || 'Sin filtro'}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="text-xs truncate">{q.name}</span>
                          <span className="text-[9px] text-neutral-450 dark:text-neutral-500 truncate">{q.filter || 'Todos los logs'}</span>
                        </div>
                        {!q.id.startsWith('q-') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuery(q.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-neutral-450 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-all p-0.5 shrink-0"
                            title="Eliminar consulta"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>

            {/* Panel Principal */}
            <main className="flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-[#0a0a0a] p-4 gap-4">
              
              {/* Barra de Búsqueda y Parámetros */}
              <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-450 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Filtro (ej: @Level = 'Error' or App = 'RAG' o propiedades estructuradas)"
                      value={currentFilter}
                      onChange={(e) => setCurrentFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchLogs(false);
                      }}
                      className="w-full bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">Límite</label>
                    <input
                      type="number"
                      value={limit}
                      onChange={(e) => {
                        const val = Math.min(500, Math.max(1, parseInt(e.target.value) || 50));
                        setLimit(val);
                        localStorage.setItem('seq_monitor_limit', val.toString());
                      }}
                      className="w-16 bg-neutral-50 dark:bg-[#181818] border border-neutral-250 dark:border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-900 dark:text-white text-center focus:outline-none focus:border-[#71BF44] dark:focus:border-[#71BF44]"
                    />
                    <button
                      onClick={() => fetchLogs(false)}
                      className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Ejecutar
                    </button>
                  </div>
                </div>

                {/* Controles de Streaming */}
                <div className="flex flex-wrap items-center justify-between border-t border-neutral-100 dark:border-neutral-900 pt-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400 dark:bg-neutral-600'}`} />
                    <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                      {isStreaming 
                        ? `Monitoreando Seq en vivo (refresco ${autoRefreshInterval / 1000}s)` 
                        : 'Streaming en tiempo real pausado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-neutral-55 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 px-2 py-1 rounded-lg">
                      <input
                        type="checkbox"
                        id="auto-refresh"
                        checked={isStreaming}
                        onChange={(e) => {
                          if (e.target.checked) startStreaming();
                          else stopStreaming();
                        }}
                        className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[#71BF44] focus:ring-0"
                      />
                      <label htmlFor="auto-refresh" className="text-[10px] text-neutral-550 dark:text-neutral-450 font-bold uppercase select-none cursor-pointer">Auto-refrescar</label>
                    </div>

                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                      disabled={!isStreaming}
                      className="bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 disabled:opacity-50 text-neutral-800 dark:text-neutral-200 text-[11px] rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="3000">3s</option>
                      <option value="5000">5s</option>
                      <option value="10000">10s</option>
                      <option value="30000">30s</option>
                    </select>

                    <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-850" />

                    <button
                      onClick={isStreaming ? stopStreaming : startStreaming}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isStreaming 
                          ? 'border-[#71BF44]/30 bg-[#71BF44]/10 text-[#71BF44] hover:bg-[#71BF44]/20' 
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-55 dark:bg-[#181818] text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
                      }`}
                      title={isStreaming ? 'Pausar' : 'Iniciar Monitoreo'}
                    >
                      {isStreaming ? <Pause className="w-3.5 h-3.5 fill-[#71BF44]" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>

                    <button
                      onClick={handleClearLogs}
                      className="border border-neutral-200 dark:border-neutral-800 bg-neutral-55 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white p-1.5 rounded-lg transition-colors"
                      title="Limpiar Consola"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filtros Locales / Rápidos */}
              <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

              {/* Gráfico Analítico de Eventos */}
              <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Frecuencia de Eventos por Nivel</h4>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Haz clic en un punto de la gráfica para filtrar temporalmente en Seq
                  </span>
                </div>
                <div className="h-28 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      onClick={handleChartClick}
                      margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="timeLabel"
                        tick={{ fill: '#666', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#666', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#131313' : '#ffffff',
                          borderColor: isDarkMode ? '#222' : '#e5e5e5',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: isDarkMode ? '#fff' : '#333'
                        }}
                        labelStyle={{ color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconSize={6}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '9px', paddingBottom: '10px' }}
                        onClick={(props: any) => handleLevelClick(props.dataKey)}
                      />
                      {LOG_LEVELS.map(lvl => (
                        <Area
                          key={lvl}
                          type="monotone"
                          dataKey={lvl}
                          stroke={LEVEL_COLORS[lvl]}
                          fill={`${LEVEL_COLORS[lvl]}05`}
                          strokeWidth={1.5}
                          dot={{ r: 1.5, strokeWidth: 0.5 }}
                          activeDot={{ r: 3 }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Visor de Eventos (Consola) */}
              <div className="flex-1 flex flex-col border border-neutral-200 dark:border-neutral-800 bg-[#0d0d0d] rounded-xl overflow-hidden min-h-0">
                <div className="bg-neutral-100 dark:bg-[#181818] border-b border-neutral-200 dark:border-neutral-850 px-4 py-2 flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400">
                  <span>Visor de Eventos</span>
                  <span className="text-[10px] bg-neutral-200 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full font-semibold">
                    Mostrando {filteredLogs.length} de {logs.length} logs
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 font-mono text-xs">
                  {filteredLogs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2 text-neutral-500">
                      <FileText className="w-8 h-8 opacity-40" />
                      <p className="text-xs">No hay eventos que mostrar. Configura tu conexión y ejecuta una consulta.</p>
                    </div>
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
                          className={`group flex flex-col rounded border border-transparent transition-all ${
                            isExpanded ? 'bg-[#181818]/60 border-neutral-850 my-1' : 'hover:bg-[#181818]/30'
                          }`}
                        >
                          <div
                            onClick={() => toggleLogExpand(rowId)}
                            className="flex items-start p-2 gap-2 cursor-pointer select-none"
                          >
                            <button className="text-neutral-500 hover:text-white shrink-0 mt-0.5 transition-transform">
                              <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            
                            <span className="text-[10px] text-neutral-500 shrink-0 select-none mt-0.5">{timeStr}</span>
                            
                            {isSqlAggregation ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none text-[#71BF44] bg-[#71BF44]/10 border-[#71BF44]/20">
                                Agg
                              </span>
                            ) : (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 select-none ${LEVEL_TEXT_CLASSES[level]}`}>
                                {level === 'Information' ? 'Info' : level}
                              </span>
                            )}
                            
                            <span className="text-neutral-200 break-all line-clamp-1 group-hover:line-clamp-none flex-1">
                              {message}
                            </span>

                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyLog(log);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-white p-0.5 shrink-0 transition-opacity"
                              title="Copiar log completo (JSON)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-neutral-900 bg-[#131313]/50 p-3 flex flex-col gap-3 animate-fade-in text-[11px]">
                              {log.MessageTemplate && !isSqlAggregation && (
                                <div>
                                  <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider mb-1">Message Template</h5>
                                  <div className="bg-[#181818] border border-neutral-850 p-2 rounded text-neutral-300 font-mono select-all">
                                    {log.MessageTemplate}
                                  </div>
                                </div>
                              )}

                              <div>
                                <h5 className="text-[10px] text-[#71BF44] font-bold uppercase tracking-wider mb-1">Propiedades Estructuradas Interactivas</h5>
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
                                          <td className="p-2 text-neutral-350 break-all">{typeof p.Value === 'object' ? JSON.stringify(p.Value) : String(p.Value)}</td>
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
                                          </td>
                                        </tr>
                                      ))}
                                      {log.Exception && (
                                        <tr className="hover:bg-[#181818]/45 transition-colors">
                                          <td className="p-2 font-semibold text-red-400 break-all">@Exception</td>
                                          <td className="p-2 text-neutral-350 break-all font-mono whitespace-pre-wrap">{log.Exception}</td>
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
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                <details className="mt-2 group">
                                  <summary className="text-[10px] text-neutral-500 hover:text-neutral-350 cursor-pointer select-none font-bold uppercase transition-colors">
                                    Ver JSON Original Completo
                                  </summary>
                                  <div className="bg-[#181818] border border-neutral-850 p-3 rounded font-mono overflow-x-auto max-h-64 mt-1">
                                    {renderHighlightedJson(log.Properties || [], log.Exception, log.MessageTemplate)}
                                  </div>
                                </details>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
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
                  setConnectionForm({ name: '', url: '', apiKey: '' });
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
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-mono break-all">{conn.url}</p>
                      <span className="inline-block mt-3 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-450">
                        {conn.apiKey ? 'API Key Configurada' : 'Sin API Key'}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-3">
                      <button
                        onClick={() => {
                          setEditingConnection(conn);
                          setConnectionForm({
                            name: conn.name,
                            url: conn.url,
                            apiKey: conn.apiKey || ''
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
      </div>

      {/* --- MODAL GUARDAR QUERY --- */}
      {isSaveQueryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Guardar Consulta</h3>
              <button onClick={() => setIsSaveQueryModalOpen(false)} className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-450 dark:hover:text-white">
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
                  readOnly
                  value={currentFilter || '(Consulta vacía - todos los logs)'}
                  className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2.5 text-xs text-neutral-600 dark:text-neutral-450 font-mono h-20 resize-none focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveQueryModalOpen(false)}
                  className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#181818] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold px-4 py-2.5 rounded-lg text-neutral-600 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#71BF44] hover:bg-[#71BF44]/90 text-white dark:text-[#131313] text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar
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
    </div>
  );
}
