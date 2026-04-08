'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Server, ExternalLink, Clock, RefreshCw, Inbox, Users, Gauge, AlertTriangle, Info, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

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

export default function MonitoreoRabbitPage() {
  const [data, setData] = useState<AmbienteRabbit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await fetch('https://sara.mysatcomla.com/webhook/MonitorRabbit');
      if (!res.ok) throw new Error('Error al obtener datos de RabbitMQ');
      const json = await res.json();
      
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
          // If none of the above, try to find an array in any property
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
        <div className="flex items-center gap-2 mb-4">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Analytics
          </Link>
        </div>

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
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Próxima actualización en</span>
              <span className="text-sm font-mono font-bold text-[#71BF44]">{formatCountdown(countdown)}</span>
            </div>
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
                <a
                  href={env.Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-neutral-500 dark:text-neutral-400 truncate mb-3 flex items-center gap-1 hover:text-[#71BF44] transition-colors group/link"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover/link:scale-110 transition-transform" />
                  <span className="truncate underline-offset-2 group-hover/link:underline">{env.Url}</span>
                </a>

                {/* Footer info */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50">
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(env.HoraMonitoreo, true)}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500">
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
                    </tr>
                  </thead>
                  <tbody>
                    {selectedData.Colas.map((cola, i) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
