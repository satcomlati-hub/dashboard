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
  ChevronDown, 
  ChevronUp, 
  X, 
  AlertCircle, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Store, 
  Filter, 
  LayoutGrid,
  Hash,
  Layers,
  MapPin
} from 'lucide-react';

interface CatalogEmisor {
  IdEmisor: number;
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  IdPais: number;
  NombrePais?: string;
}

interface ActivityRecord {
  IdEmisor: number;
  Establecimiento: string;
  PuntoEmision: string;
  EstadoReporte: string;
  TotalAutorizados: number;
  TotalErrores: number;
  UltimoAutorizado: string;
  UltimoNoAutorizado: string;
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
  estabCount: number;
  puntosCount: number;
  estadoReporte: string;
  isDisconnected: boolean;
  disconnectedEstabs: string[];
  details: ActivityRecord[];
}

type SortKey = 'ID_Emisor' | 'RazonSocial' | 'ultimaAutorizacion' | 'ultimaError' | 'totalOk' | 'estabCount' | 'puntosCount';

export default function ActividadEmisoresPage() {
  const [emitterGroups, setEmitterGroups] = useState<EmitterGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedEmisores, setExpandedEmisores] = useState<Set<number>>(new Set());
  const [selectedEmisorId, setSelectedEmisorId] = useState<number | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>({ key: 'ultimaAutorizacion', direction: 'desc' });

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedEmisores);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedEmisores(newSet);
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
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
          else if (p.IdEmisor) activity.push(p);
        });
      }

      const groups: EmitterGroup[] = catalog.map(c => {
        const emisorActivities = activity.filter(a => Number(a.IdEmisor) === Number(c.IdEmisor));
        const totalOk = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0);
        const totalError = emisorActivities.reduce((acc, curr) => acc + (Number(curr.TotalErrores) || 0), 0);
        
        const maxDate = (records: ActivityRecord[], field: keyof ActivityRecord) => {
          const vals = records.map(r => String(r[field])).filter(d => d && d !== '---' && d !== 'NULL').sort((a, b) => b.localeCompare(a));
          return vals[0] || '---';
        };

        // Normalización de estados basada en SQL: ACTIVO, SIN ACTIVIDAD, AÑOS ANTERIOR
        const estados = emisorActivities.map(a => a.EstadoReporte?.toUpperCase());
        let estado = 'SIN ACTIVIDAD';
        if (estados.includes('ACTIVO')) estado = 'ACTIVO';
        else if (estados.includes('AÑOS ANTERIOR') || estados.includes('ULTIMO AUTORIZADO')) estado = 'AÑOS ANTERIOR';

        const estabs = new Set(emisorActivities.map(a => a.Establecimiento));
        
        // Mapeo manual de países si el nombre no viene del SP
        const COUNTRY_MAP: Record<number, string> = {
          593: 'Ecuador',
          506: 'Costa Rica',
          507: 'Panamá',
          57: 'Colombia'
        };

        const nombrePais = c.NombrePais || COUNTRY_MAP[c.IdPais] || 'Ecuador';

        // Lógica de Alertas (Desconexiones)
        // Hoy es 29 de Abril 2026
        const today = new Date('2026-04-29');
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const parseDate = (d: string) => (d && d !== '---' && d !== 'NULL') ? new Date(d) : null;

        const estabsStatus = Array.from(estabs).map(e => {
           // Excluir punto PPPPP de la lógica de alertas
           const eActivities = emisorActivities.filter(a => a.Establecimiento === e && a.PuntoEmision !== 'PPPPP');
           
           if (eActivities.length === 0) return { id: e, lastOk: null, isAlerted: false };

           const lastOk = parseDate(maxDate(eActivities, 'UltimoAutorizado'));
           const hasActiveLastMonth = lastOk && lastOk >= thirtyDaysAgo;
           const hasInactiveLast3Days = !lastOk || lastOk < threeDaysAgo;
           
           return { id: e, lastOk, isAlerted: hasActiveLastMonth && hasInactiveLast3Days };
        });

        const disconnectedEstabs = estabsStatus.filter(e => e.isAlerted).map(e => e.id);
        const isDisconnected = estado === 'ACTIVO' && disconnectedEstabs.length > 0;

        return {
          ID_Emisor: c.IdEmisor,
          Nemonico: c.Nemonico,
          Identificacion: c.Identificacion,
          RazonSocial: c.RazonSocial,
          NombrePais: nombrePais,
          Pais_ID: c.IdPais,
          totalOk,
          totalError,
          ultimaAutorizacion: maxDate(emisorActivities, 'UltimoAutorizado'),
          ultimaError: maxDate(emisorActivities, 'UltimoNoAutorizado'),
          estabCount: estabs.size,
          puntosCount: emisorActivities.length,
          estadoReporte: estado,
          isDisconnected,
          disconnectedEstabs,
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

  const sortedAndFilteredGroups = useMemo(() => {
    let result = emitterGroups.filter(g => {
      const matchSearch = !searchTerm || 
        g.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.RazonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.Identificacion?.includes(searchTerm);
      
      const matchStatus = !statusFilter || g.estadoReporte === statusFilter;
      const matchCountry = !countryFilter || g.NombrePais === countryFilter;
      const matchAlert = !alertFilter || g.isDisconnected;
      const matchSelected = !selectedEmisorId || g.ID_Emisor === selectedEmisorId;

      return matchSearch && matchStatus && matchCountry && matchAlert && matchSelected;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        const isDateKey = sortConfig.key === 'ultimaAutorizacion' || sortConfig.key === 'ultimaError';
        
        if (isDateKey) {
          const aEmpty = !aValue || aValue === '---';
          const bEmpty = !bValue || bValue === '---';
          
          if (aEmpty && bEmpty) return 0;
          if (aEmpty) return 1;
          if (bEmpty) return -1;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [emitterGroups, searchTerm, statusFilter, countryFilter, alertFilter, selectedEmisorId, sortConfig]);

  const countries = useMemo(() => {
    const set = new Set(emitterGroups.map(g => g.NombrePais));
    return Array.from(set).sort();
  }, [emitterGroups]);

  const kpis = useMemo(() => {
    const getStats = (status: string) => {
      const groups = emitterGroups.filter(g => g.estadoReporte === status);
      return {
        emisores: groups.length,
        estabs: groups.reduce((acc, g) => acc + g.estabCount, 0),
        puntos: groups.reduce((acc, g) => acc + g.puntosCount, 0)
      };
    };

    return {
      activo: getStats('ACTIVO'),
      ultimoAutorizado: getStats('AÑOS ANTERIOR'),
      sinActividad: getStats('SIN ACTIVIDAD'),
      desconectados: emitterGroups.filter(g => g.isDisconnected).length,
      globalOk: emitterGroups.reduce((acc, g) => acc + g.totalOk, 0),
      globalError: emitterGroups.reduce((acc, g) => acc + g.totalError, 0)
    };
  }, [emitterGroups]);

  const handleKPIFilter = (status: string) => {
    if (statusFilter === status) setStatusFilter(null);
    else setStatusFilter(status);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]" /> : <ArrowDown className="w-3 h-3 text-[#71BF44]" />;
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Header */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Analytics Portal
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl flex items-center justify-center ring-1 ring-[#71BF44]/20">
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase mb-1">
                Actividad Emisores <span className="text-[#71BF44] opacity-40 text-sm ml-1 font-black italic">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 bg-[#71BF44]/10 rounded-full border border-[#71BF44]/20">
                    <div className="w-1.5 h-1.5 bg-[#71BF44] rounded-full animate-pulse shadow-[0_0_8px_#71BF44]"></div>
                    <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Sincronizado</span>
                 </div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest opacity-60">Auditoría Operativa de Establecimientos y Puntos</p>
              </div>
            </div>
          </div>

          <button onClick={() => fetchData(true)} disabled={refreshing} className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-3 shadow-xl active:scale-95">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Datos
          </button>
        </div>
      </header>

      {/* KPI Cards: Emisores (Grande), Estabs (Pequeño), Puntos (Pequeño) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
        <div 
          onClick={() => handleKPIFilter('ACTIVO')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-[32px] p-8 shadow-sm transition-all border-l-8 ${statusFilter === 'ACTIVO' ? 'border-[#71BF44] ring-4 ring-[#71BF44]/10' : 'border-neutral-100 dark:border-neutral-800 border-l-[#71BF44] hover:border-neutral-200 hover:-translate-y-1'}`}
        >
           <p className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest mb-6">Emisores Activos</p>
           <div className="flex items-baseline gap-2 mb-6">
              <h3 className="text-6xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">{kpis.activo.emisores}</h3>
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Empresas</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <Layers className="w-3 h-3" /> Estabs.
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.activo.estabs.toLocaleString()}</p>
              </div>
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <MapPin className="w-3 h-3" /> Puntos
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.activo.puntos.toLocaleString()}</p>
              </div>
           </div>
        </div>

        <div 
          onClick={() => handleKPIFilter('AÑOS ANTERIOR')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-[32px] p-8 shadow-sm transition-all border-l-8 ${statusFilter === 'AÑOS ANTERIOR' ? 'border-orange-400 ring-4 ring-orange-400/10' : 'border-neutral-100 dark:border-neutral-800 border-l-orange-400 hover:border-neutral-200 hover:-translate-y-1'}`}
        >
           <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-6">Años Anterior</p>
           <div className="flex items-baseline gap-2 mb-6">
              <h3 className="text-6xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">{kpis.ultimoAutorizado.emisores}</h3>
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Empresas</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <Layers className="w-3 h-3" /> Estabs.
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.ultimoAutorizado.estabs.toLocaleString()}</p>
              </div>
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <MapPin className="w-3 h-3" /> Puntos
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.ultimoAutorizado.puntos.toLocaleString()}</p>
              </div>
           </div>
        </div>

        <div 
          onClick={() => handleKPIFilter('SIN ACTIVIDAD')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-[32px] p-8 shadow-sm transition-all border-l-8 ${statusFilter === 'SIN ACTIVIDAD' ? 'border-red-500 ring-4 ring-red-500/10' : 'border-neutral-100 dark:border-neutral-800 border-l-red-500 hover:border-neutral-200 hover:-translate-y-1'}`}
        >
           <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-6">Sin Actividad</p>
           <div className="flex items-baseline gap-2 mb-6">
              <h3 className="text-6xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">{kpis.sinActividad.emisores}</h3>
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Empresas</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <Layers className="w-3 h-3" /> Estabs.
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.sinActividad.estabs.toLocaleString()}</p>
              </div>
              <div>
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                   <MapPin className="w-3 h-3" /> Puntos
                 </p>
                 <p className="text-lg font-black text-neutral-800 dark:text-neutral-200">{kpis.sinActividad.puntos.toLocaleString()}</p>
              </div>
           </div>
        </div>

        <div 
          onClick={() => setAlertFilter(!alertFilter)}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-[32px] p-8 shadow-sm transition-all border-l-8 ${alertFilter ? 'border-red-600 ring-4 ring-red-600/10' : 'border-neutral-100 dark:border-neutral-800 border-l-red-600 hover:border-neutral-200 hover:-translate-y-1'}`}
        >
           <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-2">
             <AlertCircle className="w-3 h-3" /> Posibles Desconexiones
           </p>
           <div className="flex items-baseline gap-2 mb-6">
              <h3 className="text-6xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">{kpis.desconectados}</h3>
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Alertas</span>
           </div>
           <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-relaxed">
             Emisores activos con puntos sin trx en +3 días
           </p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-6 italic opacity-50">Volumen Consolidado</p>
           <div className="space-y-4">
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest group-hover:scale-110 transition-transform">Autorizados</span>
                <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">{kpis.globalOk.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest group-hover:scale-110 transition-transform">Errores</span>
                <span className="text-xl font-black text-red-500 tracking-tighter leading-none">{kpis.globalError.toLocaleString()}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Filtro de País */}
      <div className="flex flex-wrap items-center gap-3 mb-10 overflow-x-auto pb-2 no-scrollbar">
         <button 
           onClick={() => setCountryFilter(null)}
           className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${!countryFilter ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300'}`}
         >
           Todos los Países
         </button>
         {countries.map(c => (
           <button 
             key={c}
             onClick={() => setCountryFilter(c)}
             className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${countryFilter === c ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300'}`}
           >
             <Globe className="w-3 h-3" /> {c}
           </button>
         ))}

         <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700 mx-2 hidden md:block"></div>

         <button 
           onClick={() => setAlertFilter(!alertFilter)}
           className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${alertFilter ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' : 'bg-white dark:bg-neutral-800 text-red-500 border-red-100 dark:border-red-500/20 hover:border-red-300'}`}
         >
           <AlertCircle className="w-3 h-3" /> Solo Alertas
         </button>
      </div>

      {/* Grid Principal */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[40px] overflow-hidden shadow-2xl shadow-neutral-100 dark:shadow-none">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6 bg-neutral-50/20 dark:bg-neutral-800/10">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Filtro rápido por nemónico o razón social..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold focus:ring-4 focus:ring-[#71BF44]/10 outline-none transition-all placeholder:text-neutral-300 placeholder:italic"
            />
          </div>
          {(selectedEmisorId || statusFilter || countryFilter || alertFilter) && (
            <button onClick={() => { setSelectedEmisorId(null); setStatusFilter(null); setCountryFilter(null); setAlertFilter(false); }} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-500/10 rounded-2xl transition-all hover:scale-105 active:scale-95 border border-red-100 dark:border-red-500/20 shadow-lg shadow-red-500/5">
              Reiniciar Auditoría <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('ID_Emisor')}>
                  <div className="flex items-center gap-2"><Hash className="w-3 h-3 text-[#71BF44]" /> ID {renderSortIcon('ID_Emisor')}</div>
                </th>
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('RazonSocial')}>
                  <div className="flex items-center gap-2">Emisor {renderSortIcon('RazonSocial')}</div>
                </th>
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('estabCount')}>
                  <div className="flex items-center gap-2">Estabs. {renderSortIcon('estabCount')}</div>
                </th>
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('puntosCount')}>
                  <div className="flex items-center gap-2">Puntos {renderSortIcon('puntosCount')}</div>
                </th>
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('ultimaAutorizacion')}>
                  <div className="flex items-center gap-2">Último OK {renderSortIcon('ultimaAutorizacion')}</div>
                </th>
                <th className="px-8 py-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('ultimaError')}>
                  <div className="flex items-center gap-2">Último Fail {renderSortIcon('ultimaError')}</div>
                </th>
                <th className="px-8 py-6 text-right cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => handleSort('totalOk')}>
                  <div className="flex items-center justify-end gap-2">Volumen {renderSortIcon('totalOk')}</div>
                </th>
                <th className="px-8 py-6 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {sortedAndFilteredGroups.map(g => (
                <Fragment key={g.ID_Emisor}>
                  <tr 
                    className={`group transition-all cursor-pointer ${selectedEmisorId === g.ID_Emisor ? 'bg-[#71BF44]/5' : 'hover:bg-neutral-50/50 dark:hover:bg-white/[0.01]'}`}
                    onClick={() => setSelectedEmisorId(g.ID_Emisor)}
                  >
                    <td className="px-8 py-8">
                       <span className="text-[11px] font-black text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">#{g.ID_Emisor}</span>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3 shadow-sm ${g.estadoReporte === 'ACTIVO' ? 'bg-[#71BF44]/10 text-[#71BF44]' : g.estadoReporte === 'AÑOS ANTERIOR' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-500/10 text-red-500'}`}>
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-100 tracking-tight leading-none group-hover:text-[#71BF44] transition-colors">{g.RazonSocial}</span>
                            <span className="text-[10px] font-black text-[#71BF44] bg-[#71BF44]/5 px-2 py-0.5 rounded-md border border-[#71BF44]/10">{g.Nemonico}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.25em]">{g.NombrePais}</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${g.estadoReporte === 'ACTIVO' ? 'bg-[#71BF44]/10 text-[#71BF44]' : g.estadoReporte === 'AÑOS ANTERIOR' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-500/10 text-red-500'}`}>
                                {g.estadoReporte}
                             </span>
                             {g.isDisconnected && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md animate-pulse">
                                  <AlertCircle className="w-3 h-3 text-red-500" />
                                  <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter">Posible Desconexión</span>
                                </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                       <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-neutral-300" />
                          <span className="text-[14px] font-black text-neutral-700 dark:text-neutral-300 tracking-tighter">{g.estabCount}</span>
                       </div>
                    </td>
                    <td className="px-8 py-8">
                       <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-neutral-300" />
                          <span className="text-[14px] font-black text-neutral-700 dark:text-neutral-300 tracking-tighter">{g.puntosCount}</span>
                       </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 ${g.ultimaAutorizacion !== '---' ? 'text-[#71BF44]' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-black ${g.ultimaAutorizacion !== '---' ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-300 italic opacity-50'}`}>
                          {g.ultimaAutorizacion}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-2.5">
                        <XCircle className={`w-4 h-4 ${g.ultimaError !== '---' ? 'text-red-500' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-black ${g.ultimaError !== '---' ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-300 italic opacity-50'}`}>
                          {g.ultimaError}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <div className="flex flex-col items-end">
                         <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tighter group-hover:scale-105 transition-transform">{g.totalOk.toLocaleString()}</span>
                         <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] opacity-40">Docs Autorizados</span>
                       </div>
                    </td>
                    <td className="px-8 py-8">
                       <button onClick={(e) => { e.stopPropagation(); toggleExpand(g.ID_Emisor); }} className="p-3 hover:bg-[#71BF44]/10 rounded-2xl transition-all hover:scale-110 active:scale-90 ring-1 ring-transparent hover:ring-[#71BF44]/20">
                         {expandedEmisores.has(g.ID_Emisor) ? <ChevronUp className="w-6 h-6 text-[#71BF44]" /> : <ChevronDown className="w-6 h-6 text-neutral-300 group-hover:text-neutral-600" />}
                       </button>
                    </td>
                  </tr>
                  
                  {expandedEmisores.has(g.ID_Emisor) && (
                    <tr className="bg-neutral-50/50 dark:bg-neutral-900/60 shadow-inner">
                      <td colSpan={8} className="px-12 py-12 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="max-w-[1400px] animate-in fade-in slide-in-from-top-6 duration-700 zoom-in-95">
                           <div className="flex items-center gap-6 mb-12">
                              <div className="p-4 bg-white dark:bg-neutral-800 rounded-3xl shadow-xl shadow-[#71BF44]/5 border border-[#71BF44]/10">
                                 <LayoutGrid className="w-6 h-6 text-[#71BF44]" />
                              </div>
                              <div>
                                 <h4 className="text-base font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest leading-none mb-1">Estructura Operativa de {g.Nemonico}</h4>
                                 <p className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em] opacity-60 italic">Auditoría Transaccional por Punto de Emisión y Tipo Documental</p>
                              </div>
                           </div>
                           
                           <div className="space-y-16">
                             {Object.entries(g.details.reduce((acc, d) => {
                               if (!acc[d.Establecimiento]) acc[d.Establecimiento] = [];
                               acc[d.Establecimiento].push(d);
                               return acc;
                             }, {} as Record<string, ActivityRecord[]>)).map(([estab, points]) => (
                               <div key={estab} className="relative pl-12 border-l-4 border-dashed border-[#71BF44]/20 space-y-6">
                                  <div className="absolute -left-[14px] top-0 w-6 h-6 bg-[#71BF44] text-white rounded-full flex items-center justify-center ring-8 ring-white dark:ring-[#111] shadow-lg shadow-[#71BF44]/20">
                                     <Building2 className="w-3 h-3" />
                                  </div>
                                  
                                  <div className="flex items-center justify-between mb-8">
                                     <div className="flex items-center gap-5">
                                        <div className="flex flex-col">
                                           <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-[0.4em] mb-1">Nivel Auditoría</span>
                                           <span className={`text-sm font-black px-6 py-2.5 rounded-2xl uppercase shadow-xl tracking-widest ${g.disconnectedEstabs.includes(estab) ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-600/20' : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'}`}>
                                             ESTABLECIMIENTO {estab}
                                           </span>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700 shadow-sm mt-4">
                                           <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200">{points.length}</span>
                                           <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Puntos Registrados</span>
                                        </div>
                                     </div>
                                     <div className="h-px flex-1 mx-12 bg-gradient-to-r from-neutral-200 via-neutral-100 to-transparent dark:from-neutral-800 dark:via-neutral-900"></div>
                                  </div>
                                  
                                  <div className="overflow-hidden bg-white dark:bg-[#111] rounded-[32px] border border-neutral-200 dark:border-neutral-800 shadow-2xl shadow-neutral-100 dark:shadow-none">
                                     <table className="w-full text-left text-xs">
                                        <thead>
                                           <tr className="bg-neutral-50 dark:bg-neutral-800/40 text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] border-b border-neutral-100 dark:border-neutral-800">
                                              <th className="px-8 py-5">Punto / Caja</th>
                                              <th className="px-8 py-5 text-center">Tipo Documento</th>
                                              <th className="px-8 py-5">Última Autorización</th>
                                              <th className="px-8 py-5">Último Error</th>
                                              <th className="px-8 py-5 text-right">Volumen OK</th>
                                              <th className="px-8 py-5 text-right">Fails</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/30">
                                           {points.map((p, idx) => (
                                              <tr key={idx} className="hover:bg-[#71BF44]/[0.03] transition-all group/subitem">
                                                 <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                       <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 group-hover/subitem:text-[#71BF44] transition-colors group-hover/subitem:scale-110">
                                                          <Store className="w-4 h-4" />
                                                       </div>
                                                       <span className="font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">{p.PuntoEmision}</span>
                                                    </div>
                                                 </td>
                                                 <td className="px-8 py-5 text-center">
                                                    <span className="px-3 py-1 bg-[#71BF44]/10 text-[#71BF44] font-black rounded-lg uppercase text-[10px] border border-[#71BF44]/20 shadow-sm">{p.CodigoTipoDocumento}</span>
                                                 </td>
                                                 <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                       <div className={`w-1.5 h-1.5 rounded-full ${p.UltimoAutorizado && p.UltimoAutorizado !== 'NULL' ? 'bg-[#71BF44]' : 'bg-neutral-200'}`}></div>
                                                       <span className={`font-black ${p.UltimoAutorizado && p.UltimoAutorizado !== 'NULL' ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300 italic opacity-50'}`}>
                                                          {p.UltimoAutorizado && p.UltimoAutorizado !== 'NULL' ? p.UltimoAutorizado : 'Sin registros'}
                                                       </span>
                                                    </div>
                                                 </td>
                                                 <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                       <div className={`w-1.5 h-1.5 rounded-full ${p.UltimoNoAutorizado && p.UltimoNoAutorizado !== 'NULL' ? 'bg-red-500' : 'bg-neutral-200'}`}></div>
                                                       <span className={`font-black ${p.UltimoNoAutorizado && p.UltimoNoAutorizado !== 'NULL' ? 'text-red-400' : 'text-neutral-300 italic opacity-50'}`}>
                                                          {p.UltimoNoAutorizado && p.UltimoNoAutorizado !== 'NULL' ? p.UltimoNoAutorizado : 'Sin errores'}
                                                       </span>
                                                    </div>
                                                 </td>
                                                 <td className="px-8 py-5 text-right">
                                                    <span className="font-black text-neutral-900 dark:text-white text-lg tracking-tighter group-hover/subitem:text-[#71BF44] transition-colors">{Number(p.TotalAutorizados).toLocaleString()}</span>
                                                 </td>
                                                 <td className="px-8 py-5 text-right">
                                                    <span className={`font-black text-base tracking-tighter ${Number(p.TotalErrores) > 0 ? 'text-red-500' : 'text-neutral-300 opacity-30'}`}>
                                                       {Number(p.TotalErrores).toLocaleString()}
                                                    </span>
                                                 </td>
                                              </tr>
                                           ))}
                                        </tbody>
                                     </table>
                                  </div>
                               </div>
                             ))}
                             
                             {g.details.length === 0 && (
                               <div className="py-24 text-center bg-white dark:bg-[#111] rounded-[40px] border-4 border-dashed border-neutral-100 dark:border-neutral-900">
                                  <AlertCircle className="w-20 h-20 text-neutral-100 dark:text-neutral-800 mx-auto mb-8 animate-pulse" />
                                  <p className="text-sm font-black text-neutral-400 uppercase tracking-[0.6em] italic opacity-40">Módulo sin actividad registrada en bitácora</p>
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
