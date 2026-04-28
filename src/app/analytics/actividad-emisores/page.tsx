'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Activity, 
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Clock,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface CatalogEmisor {
  IdEmisor: number;
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  IdPais: number;
  NombrePais?: string;
}

interface ActivityRecord {
  ID_Emisor: number;
  Establecimiento: string;
  PuntoEmision: string;
  EstadoReporte: string;
  TotalAutorizados: number;
  TotalErrores: number;
  UltimaFechaAutorizacion: string;
  UltimaHoraIngreso: string;
  UltimaFechaError: string;
  UltimaHoraError: string;
  CodigoTipoDocumento: string;
  FechaSincronizacion: string;
}

interface EmitterGroup {
  ID_Emisor: number;
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  NombrePais: string;
  Pais_ID: number;
  totalOk: number;
  totalError: number;
  ultimaActividad: string;
  ultimaHora: string;
  puntosCount: number;
  details: ActivityRecord[];
}

export default function ActividadEmisoresPage() {
  const [emitterGroups, setEmitterGroups] = useState<EmitterGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmisores, setExpandedEmisores] = useState<Set<number>>(new Set());
  const [selectedEmisorId, setSelectedEmisorId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedEmisores);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedEmisores(newSet);
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [resCatalog, resActivity] = await Promise.all([
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_emisores_2026`),
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_actividad_emisor_2026`)
      ]);

      if (!resCatalog.ok || !resActivity.ok) throw new Error('Error al obtener datos');
      
      const [jsonCatalog, jsonActivity] = await Promise.all([resCatalog.json(), resActivity.json()]);

      // Parsear catálogos
      let catalog: CatalogEmisor[] = [];
      if (Array.isArray(jsonCatalog)) {
        jsonCatalog.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) catalog = [...catalog, ...p];
          else if (p.IdEmisor) catalog.push(p);
        });
      }

      // Parsear actividad
      let activity: ActivityRecord[] = [];
      if (Array.isArray(jsonActivity)) {
        jsonActivity.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) activity = [...activity, ...p];
          else if (p.ID_Emisor) activity.push(p);
        });
      }

      // Agrupación por Emisor
      const groups: EmitterGroup[] = catalog.map(c => {
        // CORRECCIÓN: Usamos Number() para asegurar el match
        const emisorActivities = activity.filter(a => Number(a.ID_Emisor) === Number(c.IdEmisor));
        
        const totalOk = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0);
        const totalError = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalErrores) || 0), 0);
        
        // Encontrar la fecha más reciente de actividad
        const dates = emisorActivities
          .map(a => a.UltimaFechaAutorizacion)
          .filter(d => d && d !== '---')
          .sort((a, b) => b.localeCompare(a));
        
        const latestDate = dates[0] || '';
        const latestActivity = emisorActivities.find(a => a.UltimaFechaAutorizacion === latestDate);

        return {
          ID_Emisor: c.IdEmisor,
          Nemonico: c.Nemonico,
          Identificacion: c.Identificacion,
          RazonSocial: c.RazonSocial,
          NombrePais: c.NombrePais || 'Ecuador',
          Pais_ID: c.IdPais,
          totalOk,
          totalError,
          ultimaActividad: latestDate.split(' ')[0] || '',
          ultimaHora: latestActivity?.UltimaHoraIngreso || '',
          puntosCount: emisorActivities.length,
          details: emisorActivities
        };
      });
      
      setEmitterGroups(groups);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredGroups = useMemo(() => {
    return emitterGroups.filter(g => {
      const matchSearch = !searchTerm || 
        g.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.RazonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.Identificacion?.includes(searchTerm);
      
      const matchSelected = !selectedEmisorId || g.ID_Emisor === selectedEmisorId;

      return matchSearch && matchSelected;
    });
  }, [emitterGroups, searchTerm, selectedEmisorId]);

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sumByDate = (dateStr?: string) => {
      let ok = 0, err = 0;
      emitterGroups.forEach(g => {
        g.details.forEach(d => {
          if (!dateStr || (d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion).toDateString() === dateStr)) {
            ok += Number(d.TotalAutorizados) || 0;
            err += Number(d.TotalErrores) || 0;
          }
        });
      });
      return { ok, err };
    };

    return {
      hoy: sumByDate(todayStr),
      ayer: sumByDate(yesterdayStr),
      global: sumByDate(),
      activos: emitterGroups.filter(g => g.totalOk > 0).length,
      total: emitterGroups.length
    };
  }, [emitterGroups]);

  const timelineData = useMemo(() => {
    const daily: Record<string, { date: string, ok: number, error: number }> = {};
    emitterGroups.forEach(g => {
      g.details.forEach(d => {
        const date = d.UltimaFechaAutorizacion?.split(' ')[0];
        if (date && date !== '---') {
          if (!daily[date]) daily[date] = { date, ok: 0, error: 0 };
          daily[date].ok += Number(d.TotalAutorizados) || 0;
          daily[date].error += Number(d.TotalErrores) || 0;
        }
      });
    });
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  }, [emitterGroups]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Header */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Regresar
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl">
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase">
                Actividad Emisores <span className="text-[#71BF44] opacity-50 text-sm ml-2">2026</span>
              </h1>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Monitoreo Detallado por Establecimiento y Punto de Emisión</p>
            </div>
          </div>

          <button onClick={() => fetchData(true)} disabled={refreshing} className="bg-[#71BF44] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-[#71BF44]/20">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Emisores</p>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[9px] font-black text-[#71BF44] uppercase">Activos</span>
              <h3 className="text-3xl font-black">{kpis.activos}</h3>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-neutral-400 uppercase">Total</span>
              <h4 className="text-lg font-black text-neutral-400">{kpis.total}</h4>
            </div>
          </div>
        </div>
        
        {[{ t: 'Hoy', s: kpis.hoy }, { t: 'Ayer', s: kpis.ayer }, { t: 'Global', s: kpis.global }].map((k, i) => (
          <div key={i} className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">{k.t}</p>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[9px] font-black text-[#71BF44] uppercase">OK</span>
                <h3 className="text-3xl font-black text-[#71BF44]">{k.s.ok.toLocaleString()}</h3>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-red-500 uppercase">Fail</span>
                <h4 className="text-lg font-black text-red-500">{k.s.err.toLocaleString()}</h4>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 mb-10">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-xs font-black uppercase tracking-widest">Historial de Procesamiento</h3>
           {selectedEmisorId && (
             <button onClick={() => setSelectedEmisorId(null)} className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1">
               Limpiar Filtro <X className="w-3 h-3" />
             </button>
           )}
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorOk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#71BF44" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '12px', fontSize: '10px', color: '#fff' }} />
              <Area type="monotone" dataKey="ok" stroke="#71BF44" strokeWidth={3} fillOpacity={1} fill="url(#colorOk)" />
              <Area type="monotone" dataKey="error" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Expansion */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800">
           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
             <input 
               type="text" 
               placeholder="Buscar emisor..." 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-12 pr-4 py-3 text-xs font-bold"
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-8 py-5">Emisor / País</th>
                <th className="px-8 py-5">Puntos</th>
                <th className="px-8 py-5 text-right">OK (Global)</th>
                <th className="px-8 py-5 text-right">Fail (Global)</th>
                <th className="px-8 py-5">Última Fecha</th>
                <th className="px-8 py-5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredGroups.map(g => (
                <Fragment key={g.ID_Emisor}>
                  <tr className={`group transition-all cursor-pointer ${selectedEmisorId === g.ID_Emisor ? 'bg-[#71BF44]/5' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02]'}`} onClick={() => setSelectedEmisorId(g.ID_Emisor)}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${g.totalOk > 0 ? 'bg-[#71BF44]/10 text-[#71BF44]' : 'bg-neutral-100 text-neutral-400'}`}>
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase">{g.RazonSocial}</span>
                            <span className="text-[10px] font-bold text-[#71BF44]">{g.Nemonico}</span>
                          </div>
                          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{g.NombrePais}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[11px] font-black text-neutral-500 uppercase">{g.puntosCount} Puntos</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`text-xl font-black ${g.totalOk > 0 ? 'text-[#71BF44]' : 'text-neutral-300'}`}>{g.totalOk.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`text-xl font-black ${g.totalError > 0 ? 'text-red-500' : 'text-neutral-200'}`}>{g.totalError.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black flex items-center gap-1"><Calendar className="w-3 h-3" /> {g.ultimaActividad || '---'}</span>
                        <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {g.ultimaHora || '--:--'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <button onClick={(e) => { e.stopPropagation(); toggleExpand(g.ID_Emisor); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                         {expandedEmisores.has(g.ID_Emisor) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                       </button>
                    </td>
                  </tr>
                  
                  {expandedEmisores.has(g.ID_Emisor) && (
                    <tr>
                      <td colSpan={6} className="px-8 py-4 bg-neutral-50 dark:bg-neutral-900/50">
                        <div className="grid grid-cols-1 gap-3">
                          <h4 className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-2 px-4">Desglose por Puntos de Emisión</h4>
                          {g.details.length === 0 ? (
                            <div className="p-8 text-center text-xs text-neutral-400 font-bold uppercase italic">Sin registros de actividad detallada</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {g.details.map((d, idx) => (
                                <div key={idx} className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Punto {d.Establecimiento}-{d.PuntoEmision}</p>
                                      <p className="text-[9px] font-bold text-neutral-400">Doc: {d.CodigoTipoDocumento || '---'}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${d.EstadoReporte === 'AUTORIZADO' ? 'bg-[#71BF44]/10 text-[#71BF44]' : 'bg-red-500/10 text-red-500'}`}>
                                      {d.EstadoReporte}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-50 dark:border-neutral-800">
                                    <div>
                                      <p className="text-[8px] font-black text-neutral-400 uppercase">Autorizados</p>
                                      <p className="text-lg font-black text-[#71BF44]">{Number(d.TotalAutorizados).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] font-black text-neutral-400 uppercase">Errores</p>
                                      <p className="text-lg font-black text-red-500">{Number(d.TotalErrores).toLocaleString()}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
