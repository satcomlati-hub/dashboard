'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Server, ExternalLink, Clock, RefreshCw, Inbox, Users, Gauge, AlertTriangle, Info, XCircle, Copy, Key, Edit2, Trash2, Plus, Search, Save, X, Settings, Play, Pause } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useSession } from 'next-auth/react';
import { useNotification } from '@/components/NotificationProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Cola {
  NombreCola: string;
  Mensajes: number;
  Rate: number;
  Consumidores: number;
}

interface AmbienteRabbit {
  Ambiente: string;
  Url: string;
  Tipo: string;
  Colas: Cola[];
  HoraMonitoreo: string;
  US?: string; // Authorized only
  PK?: string; // Authorized only
}

interface EventData {
  created_at: string;
  ambiente: string;
  pais: string | null;
  num_eventos: string | null;
  evento: string;
  key: string;
}

function getTipoConfig(tipo: string | null | undefined) {
  const safeTipo = tipo || '';
  if (safeTipo.includes('Error')) {
    return {
      border: 'border-red-500',
      bg: 'bg-red-500/5',
      badgeBg: 'bg-red-500/10',
      badgeText: 'text-red-500',
      iconBg: 'bg-red-500',
      ring: 'ring-red-500/40',
      hoverBorder: 'hover:border-red-400',
      icon: <XCircle className="w-5 h-5" />,
      label: 'Error',
    };
  }
  if (safeTipo.includes('Alerta')) {
    return {
      border: 'border-amber-500',
      bg: 'bg-amber-500/5',
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-500',
      iconBg: 'bg-amber-500',
      ring: 'ring-amber-500/40',
      hoverBorder: 'hover:border-amber-400',
      icon: <AlertTriangle className="w-5 h-5" />,
      label: 'Alerta',
    };
  }
  // Default: Informativo
  return {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    iconBg: 'bg-blue-500',
    ring: 'ring-blue-500/40',
    hoverBorder: 'hover:border-blue-400',
    icon: <Info className="w-5 h-5" />,
    label: 'Informativo',
  };
}

const AUTHORIZED_USERS = [
  'kleber.toapanta@satcomla.com', 
  'kevin.valle@satcomla.com', 
  'jaime.lucas@satcomla.com',
  'hector.paullan@satcomla.com',
  'jesus.navarrete@satcomla.com'
];

export default function MonitoreoRabbitPage() {
  const { data: session } = useSession();
  const { showNotification } = useNotification();
  const [data, setData] = useState<AmbienteRabbit[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [limits, setLimits] = useState<any[]>([]);

  // Modals state
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickEditData, setQuickEditData] = useState<{ id?: string, ambiente: string, nombre_cola: string, limite_mensajes: number, esta_activo: boolean }>({
    ambiente: '',
    nombre_cola: '',
    limite_mensajes: 100,
    esta_activo: true
  });

  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [generalSearchQuery, setGeneralSearchQuery] = useState('');
  const [showGeneralAddEditModal, setShowGeneralAddEditModal] = useState(false);
  const [generalEditingConfig, setGeneralEditingConfig] = useState<any>({});

  const fetchLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/db/rabbit-alertas');
      if (res.ok) {
        const json = await res.json();
        setLimits(json.data || []);
      }
    } catch (e) {
      console.error('Error fetching rabbit limits:', e);
    }
  }, []);

  const handleSaveLimit = async (limitData: any) => {
    try {
      const method = limitData.id ? 'PUT' : 'POST';
      const res = await fetch('/api/db/rabbit-alertas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limitData)
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(`Límite ${limitData.id ? 'actualizado' : 'creado'} correctamente`, 'success');
        fetchLimits();
        return true;
      } else {
        showNotification(`Error: ${json.error}`, 'error');
        return false;
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
      return false;
    }
  };

  const handleDeleteLimit = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este límite de mensajes?')) return;
    try {
      const res = await fetch('/api/db/rabbit-alertas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showNotification('Límite eliminado correctamente', 'success');
        fetchLimits();
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const handleToggleStatus = async (limitItem: any) => {
    try {
      const updated = { id: limitItem.id, esta_activo: !limitItem.esta_activo };
      const res = await fetch('/api/db/rabbit-alertas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        showNotification(`Límite ${!limitItem.esta_activo ? 'activado' : 'desactivado'} correctamente`, 'success');
        fetchLimits();
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const isAuthorized = session?.user?.email ? AUTHORIZED_USERS.includes(session.user.email.toLowerCase()) : false;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch Rabbit Data
      const res = await fetch('https://sara.mysatcomla.com/webhook/MonitorRabbit');
      if (!res.ok) throw new Error('Error al obtener datos de RabbitMQ');
      const json = await res.json();
      
      // Fetch Event Details
      try {
        const resEvents = await fetch('https://sara.mysatcomla.com/webhook/DetalleEventosRabbit?Evento=Encolamiento-Rabbit');
        if (resEvents.ok) {
          const jsonEvents = await resEvents.json();
          setEvents(Array.isArray(jsonEvents) ? jsonEvents : jsonEvents.data || []);
        }
      } catch (e) {
        console.error('Error fetching events:', e);
      }

      // Fetch Limits
      try {
        await fetchLimits();
      } catch (e) {
        console.error('Error fetching limits in fetchData:', e);
      }
      
      // Normalize data into an array
      let normalizedData: AmbienteRabbit[] = [];
      
      if (Array.isArray(json)) {
        normalizedData = json;
      } else if (json && typeof json === 'object') {
        // Handle common wrappers: { data: [...] } or { results: [...] }
        if (Array.isArray(json.data)) {
          normalizedData = json.data;
        } else if (Array.isArray(json.results)) {
          normalizedData = json.results;
        } else if (json.Ambiente) {
          // It's a single object, wrap it
          normalizedData = [json as AmbienteRabbit];
        } else {
          // If none of the above, try to find an array in any property (handles 'value', etc.)
          const arrayProp = Object.values(json).find(val => Array.isArray(val)) as AmbienteRabbit[];
          if (arrayProp) {
            normalizedData = arrayProp;
          }
        }
      }

      if (normalizedData.length > 0 || (Array.isArray(json) && json.length === 0)) {
        setData(normalizedData);
        setError(null);
      } else {
        console.error('Webhook error - Could not normalize data:', json);
        const keys = json && typeof json === 'object' ? `[${Object.keys(json).join(', ')}]` : typeof json;
        throw new Error(`Formato de datos no reconocido: Recibido ${keys}`);
      }
      
      setCountdown(300); // Reset countdown on successful fetch
    } catch (err: any) {
      console.error('Fetch error in RabbitMQ:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Process data for chart
  const { chartData, uniqueAmbientes } = useMemo(() => {
    if (!events.length) return { chartData: [], uniqueAmbientes: [] };

    const ambientesSet = new Set<string>();
    const timeMap: Record<string, any> = {};

    // Take only the last 48 events to avoid cluttering the chart
    const processedEvents = [...events].slice(0, 48).reverse();

    processedEvents.forEach(ev => {
      const amb = ev.pais || ev.ambiente || 'Otros';
      ambientesSet.add(amb);
      
      const time = ev.key.replace('Rabbit ', ''); // Use the key as the time axis label
      if (!timeMap[time]) {
        timeMap[time] = { time };
      }
      timeMap[time][amb] = parseInt(ev.num_eventos || '0');
    });

    return {
      chartData: Object.values(timeMap),
      uniqueAmbientes: Array.from(ambientesSet)
    };
  }, [events]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const selectedData = Array.isArray(data) ? data.find(d => d.Ambiente === selectedEnv) : null;


  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalColas = Array.isArray(data) ? data.reduce((acc, d) => acc + (d.Colas?.length || 0), 0) : 0;
  const totalMensajes = Array.isArray(data) ? data.reduce((acc, d) => acc + (d.Colas?.reduce((a, c) => a + (c.Mensajes || 0), 0) || 0), 0) : 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Header */}
      <header className="mb-8 py-6 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#71BF44]/10 flex items-center justify-center shadow-inner">
              <Server className="w-7 h-7 text-[#71BF44]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Monitoreo Rabbit</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Estado en tiempo real de las colas RabbitMQ por ambiente.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Último Monitoreo</span>
              <span className="text-xs font-bold text-neutral-500">{data[0]?.HoraMonitoreo ? formatDate(data[0].HoraMonitoreo, true) : '--'}</span>
            </div>
            <div className="hidden sm:flex flex-col items-end border-l border-neutral-200 dark:border-neutral-800 pl-4">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Próxima actualización en</span>
              <span className="text-sm font-mono font-bold text-[#71BF44]">{formatCountdown(countdown)}</span>
            </div>
            <button
              onClick={() => {
                setGeneralEditingConfig({
                  ambiente: 'V5-EC',
                  nombre_cola: '',
                  limite_mensajes: 100,
                  esta_activo: true
                });
                setShowGeneralModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] text-xs font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
            >
              <Settings className="w-4 h-4" />
              Configurar Límites
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] text-xs font-bold text-[#71BF44] border border-[#71BF44]/30 rounded-lg shadow-sm hover:bg-[#71BF44]/5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
      </header>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#71BF44]/5 border border-[#71BF44]/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#71BF44] flex items-center justify-center text-white shadow-lg">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#71BF44] uppercase tracking-wider">Ambientes</p>
            <h4 className="text-xl font-black text-neutral-900 dark:text-white">{data.length}</h4>
          </div>
        </div>
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Colas Activas</p>
            <h4 className="text-xl font-black text-neutral-900 dark:text-white">{totalColas}</h4>
          </div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Mensajes Pendientes</p>
            <h4 className="text-xl font-black text-neutral-900 dark:text-white">{totalMensajes.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-[#71BF44]/30 border-t-[#71BF44] rounded-full animate-spin" />
            <p className="text-sm text-neutral-500 font-medium">Consultando ambientes RabbitMQ…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-500">{error}</p>
          <button onClick={() => fetchData()} className="mt-3 text-xs text-red-400 hover:text-red-300 underline">Reintentar</button>
        </div>
      )}

      {/* Cards Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {data.map((env) => {
            const cfg = getTipoConfig(env.Tipo);
            const isSelected = selectedEnv === env.Ambiente;
            return (
              <button
                key={env.Ambiente}
                onClick={() => setSelectedEnv(isSelected ? null : env.Ambiente)}
                className={`text-left w-full ${cfg.bg} border ${isSelected ? `${cfg.border} ring-2 ${cfg.ring} shadow-lg` : `${cfg.border} ${cfg.hoverBorder}`} rounded-2xl p-6 transition-all hover:-translate-y-1 cursor-pointer group`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    {cfg.icon}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badgeBg} ${cfg.badgeText} uppercase tracking-wider`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Ambiente name */}
                <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white mb-1 tracking-tight">{env.Ambiente}</h3>

                {/* URL - Clickable Link */}
                <div className="flex flex-col gap-2 mb-4">
                  <a
                    href={env.Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1 hover:text-[#71BF44] transition-colors group/link"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover/link:scale-110 transition-transform" />
                    <span className="truncate underline-offset-2 group-hover/link:underline">{env.Url}</span>
                  </a>

                  {isAuthorized && (
                    <div className="flex flex-col gap-1.5 p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
                      {env.US && (
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                          {env.US}
                        </div>
                      )}
                      {env.PK && (
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-neutral-400">••••••••</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(env.PK || '');
                              alert('Clave copiada al portapapeles');
                            }}
                            className="p-1 hover:bg-[#71BF44]/20 rounded transition-colors text-neutral-400 hover:text-[#71BF44]"
                            title="Copiar Clave"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                      <Inbox className="w-3.5 h-3.5" />
                      {env.Colas?.reduce((a, c) => a + (c.Mensajes || 0), 0).toLocaleString()} mensajes
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-neutral-400">
                    {(env.Colas?.length || 0)} cola{(env.Colas?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selectedData && (
        <section id="detail-panel" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em]">
              Detalle de Colas — {selectedData.Ambiente}
            </h3>
            <button
              onClick={() => setSelectedEnv(null)}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
            >
              Cerrar ✕
            </button>
          </div>

          {selectedData.Colas.length === 0 ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white mx-auto mb-3 shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sin colas con acumulación</p>
              <p className="text-xs text-neutral-400 mt-1">Todas las colas de este ambiente están vacías.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-[#0e0e0e] border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Nombre de Cola</th>
                      <th className="text-right px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Mensajes</th>
                      <th className="text-right px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Rate</th>
                      <th className="text-right px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Consumidores</th>
                      <th className="text-right px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Límite Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedData.Colas.map((cola, i) => {
                      const matchedLimit = limits.find(
                        l => l.ambiente === selectedData.Ambiente && l.nombre_cola === cola.NombreCola
                      );
                      return (
                        <tr key={cola.NombreCola} className={`border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors ${i === selectedData.Colas.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <Inbox className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <span className="truncate">{cola.NombreCola}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${cola.Mensajes > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {cola.Mensajes.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-neutral-600 dark:text-neutral-300">{cola.Rate}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-bold ${cola.Consumidores === 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              <Users className="w-3.5 h-3.5" />
                              {cola.Consumidores}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${matchedLimit ? (matchedLimit.esta_activo ? 'bg-red-500/10 text-red-500' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400') : 'text-neutral-400 dark:text-neutral-600'}`}>
                                {matchedLimit ? `${matchedLimit.limite_mensajes.toLocaleString()} msg` : '---'}
                              </span>
                              <button
                                onClick={() => {
                                  setQuickEditData({
                                    id: matchedLimit?.id,
                                    ambiente: selectedData.Ambiente,
                                    nombre_cola: cola.NombreCola,
                                    limite_mensajes: matchedLimit ? matchedLimit.limite_mensajes : 100,
                                    esta_activo: matchedLimit ? matchedLimit.esta_activo : true
                                  });
                                  setShowQuickModal(true);
                                }}
                                className="p-1 hover:bg-[#71BF44]/10 rounded text-neutral-400 hover:text-[#71BF44] transition-colors"
                                title="Configurar Límite"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
      {/* Timeline Section */}
      <section className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#71BF44]" />
              Línea de Tiempo de Encolamiento
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Histórico de mensajes en colas por ambiente.</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 mb-8 shadow-sm h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val: number) => val.toLocaleString()}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111', 
                  border: '1px solid #333', 
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              {uniqueAmbientes.map((amb: string, index: number) => (
                <Line
                  key={amb}
                  type="monotone"
                  dataKey={amb}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Event Details Table */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-[#0e0e0e] border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Ambiente</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Eventos</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Evento</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 20).map((ev, i) => (
                  <tr key={ev.created_at + i} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-6 py-4 text-neutral-500 whitespace-nowrap">
                      {formatDate(ev.created_at, true)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                      {ev.pais || ev.ambiente}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-[#71BF44]">
                        {parseInt(ev.num_eventos || '0').toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {ev.evento} — {ev.key}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL EDICIÓN RÁPIDA (POR COLA) */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-[#0c0c0c]/50">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                {quickEditData.id ? 'Editar Límite de Alerta' : 'Establecer Límite de Alerta'}
              </h3>
              <button onClick={() => setShowQuickModal(false)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Ambiente</label>
                <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5">
                  {quickEditData.ambiente}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Nombre de Cola</label>
                <div className="text-xs font-mono text-neutral-800 dark:text-neutral-300 bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 break-all">
                  {quickEditData.nombre_cola}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Límite de Mensajes</label>
                  <input 
                    type="number"
                    value={quickEditData.limite_mensajes}
                    onChange={e => setQuickEditData({ ...quickEditData, limite_mensajes: Number(e.target.value) })}
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Estado</label>
                  <select 
                    value={quickEditData.esta_activo ? 'true' : 'false'}
                    onChange={e => setQuickEditData({ ...quickEditData, esta_activo: e.target.value === 'true' })}
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button onClick={() => setShowQuickModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const ok = await handleSaveLimit(quickEditData);
                  if (ok) setShowQuickModal(false);
                }} 
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#71BF44] hover:bg-[#5da036] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN GENERAL (HEADER) */}
      {showGeneralModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-[#0c0c0c]/50">
              <div>
                <h3 className="font-bold text-base text-neutral-900 dark:text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-[#71BF44]" /> Gestión de Límites RabbitMQ
                </h3>
                <p className="text-[11px] text-neutral-500">Administración general de límites máximos para disparar alertas en n8n.</p>
              </div>
              <button onClick={() => setShowGeneralModal(false)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar por ambiente o cola..."
                    value={generalSearchQuery}
                    onChange={e => setGeneralSearchQuery(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-[#71BF44] transition-all"
                  />
                </div>
                <button
                  onClick={() => {
                    setGeneralEditingConfig({
                      ambiente: 'V5-EC',
                      nombre_cola: '',
                      limite_mensajes: 100,
                      esta_activo: true
                    });
                    setShowGeneralAddEditModal(true);
                  }}
                  className="bg-[#71BF44] hover:bg-[#5da036] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Límite
                </button>
              </div>

              {limits.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Server className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">No se encontraron límites configurados en base de datos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3 font-bold">Estado</th>
                        <th className="px-4 py-3 font-bold">Ambiente</th>
                        <th className="px-4 py-3 font-bold">Nombre de Cola</th>
                        <th className="px-4 py-3 font-bold">Límite</th>
                        <th className="px-4 py-3 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {limits.filter(c => 
                        c.ambiente.toLowerCase().includes(generalSearchQuery.toLowerCase()) ||
                        c.nombre_cola.toLowerCase().includes(generalSearchQuery.toLowerCase())
                      ).map(config => (
                        <tr key={config.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.01]">
                          <td className="px-4 py-3">
                            <button onClick={() => handleToggleStatus(config)} className="transition-transform active:scale-95">
                              {config.esta_activo ? (
                                <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
                              ) : (
                                <Pause className="w-3.5 h-3.5 text-neutral-400 fill-neutral-400/10" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold">{config.ambiente}</td>
                          <td className="px-4 py-3 font-mono text-[11px] max-w-md truncate">{config.nombre_cola}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[11px] font-bold">
                              {config.limite_mensajes.toLocaleString()} msg
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                setGeneralEditingConfig(config);
                                setShowGeneralAddEditModal(true);
                              }}
                              className="p-1 hover:bg-[#71BF44]/10 rounded text-[#71BF44]"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLimit(config.id)}
                              className="p-1 hover:bg-red-500/10 rounded text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN GENERAL - AGREGAR/EDITAR (ANIDADO) */}
      {showGeneralAddEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-[#0c0c0c]/50">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                {generalEditingConfig.id ? 'Editar Límite de Cola' : 'Nuevo Límite de Cola'}
              </h3>
              <button onClick={() => setShowGeneralAddEditModal(false)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Ambiente</label>
                <select 
                  value={generalEditingConfig.ambiente || ''} 
                  onChange={e => setGeneralEditingConfig({ ...generalEditingConfig, ambiente: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                >
                  <option value="V5-EC">V5-EC</option>
                  <option value="V5-Panama">V5-Panama</option>
                  <option value="ColombiaAWS">ColombiaAWS</option>
                  <option value="Testing">Testing</option>
                  <option value="Bolivia">Bolivia</option>
                  <option value="KFC">KFC</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Nombre de la Cola</label>
                <input 
                  type="text" 
                  value={generalEditingConfig.nombre_cola || ''} 
                  onChange={e => setGeneralEditingConfig({ ...generalEditingConfig, nombre_cola: e.target.value })}
                  placeholder="Ej: ProdAWS_DtoComprobanteSender o * para un límite genérico"
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Límite Máximo de Mensajes</label>
                  <input 
                    type="number" 
                    value={generalEditingConfig.limite_mensajes !== undefined ? generalEditingConfig.limite_mensajes : ''} 
                    onChange={e => setGeneralEditingConfig({ ...generalEditingConfig, limite_mensajes: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Ej: 500"
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Estado</label>
                  <select 
                    value={generalEditingConfig.esta_activo === false ? 'false' : 'true'} 
                    onChange={e => setGeneralEditingConfig({ ...generalEditingConfig, esta_activo: e.target.value === 'true' })}
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44]"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button onClick={() => setShowGeneralAddEditModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const ok = await handleSaveLimit(generalEditingConfig);
                  if (ok) setShowGeneralAddEditModal(false);
                }} 
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#71BF44] hover:bg-[#5da036] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Límite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CHART_COLORS = ['#71BF44', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
