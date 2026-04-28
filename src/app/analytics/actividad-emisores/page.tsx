'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Activity, 
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Clock,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle
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
  ultimaAutorizacion: string;
  ultimaError: string;
  puntosCount: number;
  transaccionoAyer: boolean;
  details: ActivityRecord[];
}

export default function ActividadEmisoresPage() {
  const [emitterGroups, setEmitterGroups] = useState<EmitterGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
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
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const [resCatalog, resActivity] = await Promise.all([
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_emisores_2026`),
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_actividad_emisor_2026`)
      ]);

      if (!resCatalog.ok || !resActivity.ok) throw new Error('Error al obtener datos');
      
      const [jsonCatalog, jsonActivity] = await Promise.all([resCatalog.json(), resActivity.json()]);

      let catalog: CatalogEmisor[] = [];
      if (Array.isArray(jsonCatalog)) {
        jsonCatalog.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) catalog = [...catalog, ...p];
          else if (p.IdEmisor) catalog.push(p);
        });
      }

      let activity: ActivityRecord[] = [];
      if (Array.isArray(jsonActivity)) {
        jsonActivity.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) activity = [...activity, ...p];
          else if (p.ID_Emisor) activity.push(p);
        });
      }

      const groups: EmitterGroup[] = catalog.map(c => {
        const emisorActivities = activity.filter(a => Number(a.ID_Emisor) === Number(c.IdEmisor));
        
        const totalOk = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0);
        const totalError = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalErrores) || 0), 0);
        
        const maxDate = (records: ActivityRecord[], field: keyof ActivityRecord) => {
          const vals = records.map(r => String(r[field])).filter(d => d && d !== '---').sort((a, b) => b.localeCompare(a));
          return vals[0] || 'Sin registro';
        };

        const transaccionoAyer = emisorActivities.some(a => {
           const fecha = a.UltimaFechaAutorizacion?.split(' ')[0];
           return fecha === yesterdayStr;
        });

        return {
          ID_Emisor: c.IdEmisor,
          Nemonico: c.Nemonico,
          Identificacion: c.Identificacion,
          RazonSocial: c.RazonSocial,
          NombrePais: c.NombrePais || 'Ecuador',
          Pais_ID: c.IdPais,
          totalOk,
          totalError,
          ultimaAutorizacion: maxDate(emisorActivities, 'UltimaFechaAutorizacion'),
          ultimaError: maxDate(emisorActivities, 'UltimaFechaError'),
          puntosCount: emisorActivities.length,
          transaccionoAyer,
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
    const activosAyer = emitterGroups.filter(g => g.transaccionoAyer).length;
    const inactivosAyer = emitterGroups.length - activosAyer;

    return {
      activosAyer,
      inactivosAyer,
      totalEmitters: emitterGroups.length,
      globalOk: emitterGroups.reduce((acc, g) => acc + g.totalOk, 0),
      globalError: emitterGroups.reduce((acc, g) => acc + g.totalError, 0)
    };
  }, [emitterGroups]);

  const timelineData = useMemo(() => {
    const daily: Record<string, { date: string, ok: number, error: number }> = {};
    emitterGroups.forEach(g => {
      g.details.forEach(d => {
        const date = d.UltimaFechaAutorizacion?.split(' ')[0];
        if (date && date !== '---' && date !== 'Sin registro') {
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
            Analytics Portal
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter mb-1 uppercase">
                Actividad de Emisores <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                <span className="px-2 py-0.5 bg-[#71BF44]/10 text-[#71BF44] rounded text-[10px] font-bold uppercase">Estado Operativo</span>
                <p className="text-xs text-neutral-500 font-medium">Análisis de actividad transaccional basada en logs de ayer.</p>
              </div>
            </div>
          </div>

          <button onClick={() => fetchData(true)} disabled={refreshing} className="bg-[#71BF44] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-3 shadow-xl shadow-[#71BF44]/20">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Datos
          </button>
        </div>
      </header>

      {/* KPI Cards Focus: Yesterday */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group hover:border-[#71BF44] transition-all relative overflow-hidden">
           <Building2 className="absolute -right-4 -bottom-4 w-24 h-24 text-[#71BF44] opacity-[0.03]" />
           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Total Catálogo</p>
           <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.totalEmitters}</h3>
           <p className="text-[10px] font-bold text-neutral-400 uppercase mt-1 tracking-tight">Empresas registradas en V5</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group hover:border-[#71BF44] transition-all border-l-4 border-l-[#71BF44]">
           <p className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest mb-4">Activos (Ayer)</p>
           <div className="flex items-baseline gap-2">
             <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.activosAyer}</h3>
             <span className="text-xs font-bold text-[#71BF44]">Empresas</span>
           </div>
           <p className="text-[9px] font-medium text-neutral-400 mt-2 uppercase tracking-widest flex items-center gap-1">
             <Clock className="w-3 h-3" /> Transaccionaron ayer
           </p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group hover:border-red-500 transition-all border-l-4 border-l-red-500">
           <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Inactivos (Ayer)</p>
           <div className="flex items-baseline gap-2">
             <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.inactivosAyer}</h3>
             <span className="text-xs font-bold text-red-500">Empresas</span>
           </div>
           <p className="text-[9px] font-medium text-neutral-400 mt-2 uppercase tracking-widest flex items-center gap-1">
             <AlertCircle className="w-3 h-3" /> Sin actividad ayer
           </p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Volumen Global</p>
           <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-[#71BF44] uppercase">OK</span>
                <span className="text-xl font-black text-neutral-900 dark:text-white">{kpis.globalOk.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-red-500 uppercase">Fail</span>
                <span className="text-xl font-black text-red-500">{kpis.globalError.toLocaleString()}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Filtrar por Nemónico, Razón Social..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-12 pr-4 py-3 text-xs font-bold"
            />
          </div>
          {selectedEmisorId && (
            <button onClick={() => setSelectedEmisorId(null)} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 rounded-xl">
              Limpiar Selección <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-8 py-5">Emisor</th>
                <th className="px-8 py-5">Último Autorizado (OK)</th>
                <th className="px-8 py-5">Último No Autorizado (FAIL)</th>
                <th className="px-8 py-5 text-right">Volumen</th>
                <th className="px-8 py-5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredGroups.map(g => (
                <Fragment key={g.ID_Emisor}>
                  <tr 
                    className={`group transition-all cursor-pointer ${selectedEmisorId === g.ID_Emisor ? 'bg-[#71BF44]/5' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.01]'}`}
                    onClick={() => setSelectedEmisorId(g.ID_Emisor)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${g.transaccionoAyer ? 'bg-[#71BF44]/10 text-[#71BF44]' : 'bg-neutral-100 text-neutral-400'}`}>
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
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${g.ultimaAutorizacion !== 'Sin registro' ? 'text-[#71BF44]' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-black ${g.ultimaAutorizacion !== 'Sin registro' ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300'}`}>
                          {g.ultimaAutorizacion}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <XCircle className={`w-4 h-4 ${g.ultimaError !== 'Sin registro' ? 'text-red-500' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-black ${g.ultimaError !== 'Sin registro' ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300'}`}>
                          {g.ultimaError}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex flex-col items-end">
                         <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tighter">{g.totalOk.toLocaleString()}</span>
                         <span className="text-[9px] font-black text-neutral-400 uppercase">Docs</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <button onClick={(e) => { e.stopPropagation(); toggleExpand(g.ID_Emisor); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                         {expandedEmisores.has(g.ID_Emisor) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                       </button>
                    </td>
                  </tr>
                  
                  {expandedEmisores.has(g.ID_Emisor) && (
                    <tr className="bg-neutral-50 dark:bg-neutral-900/30">
                      <td colSpan={5} className="px-8 py-6">
                        <div className="space-y-4">
                           <h4 className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">Detalle por Puntos y Tipos de Documento</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {g.details.map((d, idx) => (
                               <div key={idx} className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                                  <div className="flex justify-between items-start mb-4">
                                    <div>
                                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Estab. {d.Establecimiento} - Caja {d.PuntoEmision}</p>
                                      <p className="text-[9px] font-bold text-[#71BF44] uppercase">{d.CodigoTipoDocumento || 'S/N'}</p>
                                    </div>
                                    <span className="text-[8px] font-black px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500 uppercase">
                                      V5 ID: {d.ID_Emisor}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                                     <div className="flex justify-between items-center">
                                       <span className="text-[9px] font-black text-neutral-400 uppercase">Último Autorizado</span>
                                       <span className="text-[10px] font-bold text-[#71BF44]">{d.UltimaFechaAutorizacion?.split(' ')[0] || '---'}</span>
                                     </div>
                                     <div className="flex justify-between items-center">
                                       <span className="text-[9px] font-black text-neutral-400 uppercase">Último Fallido</span>
                                       <span className="text-[10px] font-bold text-red-500">{d.UltimaFechaError?.split(' ')[0] || '---'}</span>
                                     </div>
                                     <div className="flex justify-between items-center">
                                       <span className="text-[9px] font-black text-neutral-400 uppercase">Transacción Ayer</span>
                                       <span className={`text-[10px] font-bold ${d.UltimaFechaAutorizacion?.startsWith(new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]) ? 'text-[#71BF44]' : 'text-neutral-300'}`}>
                                          {d.UltimaFechaAutorizacion?.startsWith(new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]) ? 'SÍ' : 'NO'}
                                       </span>
                                     </div>
                                  </div>
                               </div>
                             ))}
                             {g.details.length === 0 && (
                               <div className="col-span-full py-10 flex flex-col items-center justify-center text-neutral-400 gap-2">
                                 <AlertCircle className="w-8 h-8 opacity-20" />
                                 <p className="text-[10px] font-black uppercase tracking-widest">Sin actividad detallada registrada</p>
                               </div>
                             )}
                           </div>
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
