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
  Hash
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

        const estados = emisorActivities.map(a => a.EstadoReporte?.toUpperCase());
        let estado = 'SIN ACTIVIDAD';
        if (estados.includes('ACTIVO')) estado = 'ACTIVO';
        else if (estados.includes('AÑOS ANTERIORES')) estado = 'AÑOS ANTERIORES';

        const estabs = new Set(emisorActivities.map(a => a.Establecimiento));

        return {
          ID_Emisor: c.IdEmisor,
          Nemonico: c.Nemonico,
          Identificacion: c.Identificacion,
          RazonSocial: c.RazonSocial,
          NombrePais: c.NombrePais || 'Ecuador',
          Pais_ID: c.IdPais,
          totalOk,
          totalError,
          ultimaAutorizacion: maxDate(emisorActivities, 'UltimoAutorizado'),
          ultimaError: maxDate(emisorActivities, 'UltimoNoAutorizado'),
          estabCount: estabs.size,
          puntosCount: emisorActivities.length,
          estadoReporte: estado,
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
      const matchSelected = !selectedEmisorId || g.ID_Emisor === selectedEmisorId;

      return matchSearch && matchStatus && matchSelected;
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
  }, [emitterGroups, searchTerm, statusFilter, selectedEmisorId, sortConfig]);

  const kpis = useMemo(() => {
    return {
      activo: emitterGroups.filter(g => g.estadoReporte === 'ACTIVO').length,
      aniosAnteriores: emitterGroups.filter(g => g.estadoReporte === 'AÑOS ANTERIORES').length,
      sinActividad: emitterGroups.filter(g => g.estadoReporte === 'SIN ACTIVIDAD').length,
      total: emitterGroups.length,
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
            Regresar
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase mb-1">
                Actividad Emisores <span className="text-[#71BF44] opacity-40 text-sm ml-1">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 bg-[#71BF44]/10 rounded-full">
                    <div className="w-1.5 h-1.5 bg-[#71BF44] rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest">En Línea</span>
                 </div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Consolidado V5 de Auditoría Transaccional</p>
              </div>
            </div>
          </div>

          <button onClick={() => fetchData(true)} disabled={refreshing} className="bg-[#71BF44] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-3 shadow-xl shadow-[#71BF44]/20 active:scale-95">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div 
          onClick={() => handleKPIFilter('ACTIVO')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-3xl p-6 shadow-sm transition-all border-l-4 ${statusFilter === 'ACTIVO' ? 'border-[#71BF44] ring-4 ring-[#71BF44]/10' : 'border-neutral-200 dark:border-neutral-800 border-l-[#71BF44] opacity-70 hover:opacity-100 hover:translate-y-[-2px]'}`}
        >
           <p className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest mb-4">Emisores Activos</p>
           <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.activo}</h3>
           <p className="text-[10px] font-black text-neutral-400 uppercase mt-2 tracking-tighter">Estado: ACTIVO</p>
        </div>

        <div 
          onClick={() => handleKPIFilter('AÑOS ANTERIORES')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-3xl p-6 shadow-sm transition-all border-l-4 ${statusFilter === 'AÑOS ANTERIORES' ? 'border-orange-400 ring-4 ring-orange-400/10' : 'border-neutral-200 dark:border-neutral-800 border-l-orange-400 opacity-70 hover:opacity-100 hover:translate-y-[-2px]'}`}
        >
           <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4">Años Anteriores</p>
           <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.aniosAnteriores}</h3>
           <p className="text-[10px] font-black text-neutral-400 uppercase mt-2 tracking-tighter">Histórico Reportado</p>
        </div>

        <div 
          onClick={() => handleKPIFilter('SIN ACTIVIDAD')}
          className={`cursor-pointer bg-white dark:bg-[#111] border rounded-3xl p-6 shadow-sm transition-all border-l-4 ${statusFilter === 'SIN ACTIVIDAD' ? 'border-red-500 ring-4 ring-red-500/10' : 'border-neutral-200 dark:border-neutral-800 border-l-red-500 opacity-70 hover:opacity-100 hover:translate-y-[-2px]'}`}
        >
           <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Sin Actividad</p>
           <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.sinActividad}</h3>
           <p className="text-[10px] font-black text-neutral-400 uppercase mt-2 tracking-tighter">Cruce Catálogo Vacío</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Volumen Global</p>
           <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-wider">OK</span>
                <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tighter">{kpis.globalOk.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">FAIL</span>
                <span className="text-xl font-black text-red-500 tracking-tighter">{kpis.globalError.toLocaleString()}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-xl shadow-neutral-100 dark:shadow-none">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6 bg-neutral-50/30 dark:bg-neutral-800/20">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar por Nemónico o Razón Social..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold focus:ring-2 focus:ring-[#71BF44] outline-none transition-all"
            />
          </div>
          {(selectedEmisorId || statusFilter) && (
            <button onClick={() => { setSelectedEmisorId(null); setStatusFilter(null); }} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 border border-red-100 dark:border-red-500/20">
              Limpiar Filtros <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('ID_Emisor')}>
                  <div className="flex items-center gap-2"><Hash className="w-3 h-3" /> ID {renderSortIcon('ID_Emisor')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('RazonSocial')}>
                  <div className="flex items-center gap-2">Emisor {renderSortIcon('RazonSocial')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('estabCount')}>
                  <div className="flex items-center gap-2">Estabs. {renderSortIcon('estabCount')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('puntosCount')}>
                  <div className="flex items-center gap-2">Puntos {renderSortIcon('puntosCount')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('ultimaAutorizacion')}>
                  <div className="flex items-center gap-2">Último OK {renderSortIcon('ultimaAutorizacion')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('ultimaError')}>
                  <div className="flex items-center gap-2">Último Fail {renderSortIcon('ultimaError')}</div>
                </th>
                <th className="px-8 py-5 text-right cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]" onClick={() => handleSort('totalOk')}>
                  <div className="flex items-center justify-end gap-2">Volumen {renderSortIcon('totalOk')}</div>
                </th>
                <th className="px-8 py-5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {sortedAndFilteredGroups.map(g => (
                <Fragment key={g.ID_Emisor}>
                  <tr 
                    className={`group transition-all cursor-pointer ${selectedEmisorId === g.ID_Emisor ? 'bg-[#71BF44]/5' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.01]'}`}
                    onClick={() => setSelectedEmisorId(g.ID_Emisor)}
                  >
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-black text-neutral-400">#{g.ID_Emisor}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${g.estadoReporte === 'ACTIVO' ? 'bg-[#71BF44]/10 text-[#71BF44]' : g.estadoReporte === 'AÑOS ANTERIORES' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-500/10 text-red-500'}`}>
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-100 leading-none">{g.RazonSocial}</span>
                            <span className="text-[10px] font-black text-[#71BF44] bg-[#71BF44]/5 px-1.5 py-0.5 rounded tracking-tighter">{g.Nemonico}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{g.NombrePais}</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${g.estadoReporte === 'ACTIVO' ? 'bg-[#71BF44]/10 text-[#71BF44]' : g.estadoReporte === 'AÑOS ANTERIORES' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-500/10 text-red-500'}`}>
                                {g.estadoReporte}
                             </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[13px] font-black text-neutral-700 dark:text-neutral-300 tracking-tighter">{g.estabCount}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[13px] font-black text-neutral-700 dark:text-neutral-300 tracking-tighter">{g.puntosCount}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${g.ultimaAutorizacion !== '---' ? 'text-[#71BF44]' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-bold ${g.ultimaAutorizacion !== '---' ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-300 italic'}`}>
                          {g.ultimaAutorizacion}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <XCircle className={`w-3.5 h-3.5 ${g.ultimaError !== '---' ? 'text-red-500' : 'text-neutral-200'}`} />
                        <span className={`text-[11px] font-bold ${g.ultimaError !== '---' ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-300 italic'}`}>
                          {g.ultimaError}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex flex-col items-end">
                         <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tighter">{g.totalOk.toLocaleString()}</span>
                         <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Docs</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <button onClick={(e) => { e.stopPropagation(); toggleExpand(g.ID_Emisor); }} className="p-2.5 hover:bg-[#71BF44]/10 rounded-xl transition-all hover:scale-110 active:scale-90">
                         {expandedEmisores.has(g.ID_Emisor) ? <ChevronUp className="w-5 h-5 text-[#71BF44]" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
                       </button>
                    </td>
                  </tr>
                  
                  {expandedEmisores.has(g.ID_Emisor) && (
                    <tr className="bg-neutral-50/50 dark:bg-neutral-900/40">
                      <td colSpan={8} className="px-10 py-10 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="max-w-[1400px] animate-in fade-in slide-in-from-top-4 duration-500">
                           <div className="flex items-center gap-4 mb-8">
                              <div className="p-3 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700">
                                 <LayoutGrid className="w-5 h-5 text-[#71BF44]" />
                              </div>
                              <div>
                                 <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">Desglose Operativo de {g.Nemonico}</h4>
                                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Auditoría por Establecimiento y Punto de Emisión</p>
                              </div>
                           </div>
                           
                           <div className="space-y-12">
                             {Object.entries(g.details.reduce((acc, d) => {
                               if (!acc[d.Establecimiento]) acc[d.Establecimiento] = [];
                               acc[d.Establecimiento].push(d);
                               return acc;
                             }, {} as Record<string, ActivityRecord[]>)).map(([estab, points]) => (
                               <div key={estab} className="relative pl-10 border-l-2 border-dashed border-[#71BF44]/30 space-y-4">
                                  <div className="absolute -left-[11px] top-0 w-5 h-5 bg-[#71BF44] text-white rounded-full flex items-center justify-center ring-4 ring-white dark:ring-[#111]">
                                     <Building2 className="w-2.5 h-2.5" />
                                  </div>
                                  
                                  <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-1.5 rounded-lg uppercase shadow-sm">
                                          ESTABLECIMIENTO {estab}
                                        </span>
                                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{points.length} Puntos Activos</span>
                                     </div>
                                     <div className="h-px flex-1 mx-8 bg-neutral-200 dark:bg-neutral-800"></div>
                                  </div>
                                  
                                  <div className="overflow-hidden bg-white dark:bg-[#111] rounded-[24px] border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                     <table className="w-full text-left text-[11px]">
                                        <thead>
                                           <tr className="bg-neutral-50 dark:bg-neutral-800/40 text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 dark:border-neutral-800">
                                              <th className="px-6 py-3">Punto Emisión</th>
                                              <th className="px-6 py-3">Tipo Documento</th>
                                              <th className="px-6 py-3">Último OK</th>
                                              <th className="px-6 py-3">Último Fail</th>
                                              <th className="px-6 py-3 text-right">Volumen Autorizado</th>
                                              <th className="px-6 py-3 text-right">Errores</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/30">
                                           {points.map((p, idx) => (
                                              <tr key={idx} className="hover:bg-[#71BF44]/[0.02] transition-colors">
                                                 <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                       <div className="w-6 h-6 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center text-neutral-400">
                                                          <Store className="w-3 h-3" />
                                                       </div>
                                                       <span className="font-black text-neutral-800 dark:text-neutral-200 uppercase">{p.PuntoEmision}</span>
                                                    </div>
                                                 </td>
                                                 <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 bg-[#71BF44]/5 text-[#71BF44] font-black rounded uppercase">{p.CodigoTipoDocumento}</span>
                                                 </td>
                                                 <td className="px-6 py-4">
                                                    <span className={`font-bold ${p.UltimoAutorizado !== 'NULL' && p.UltimoAutorizado ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-300'}`}>
                                                       {p.UltimoAutorizado || '---'}
                                                    </span>
                                                 </td>
                                                 <td className="px-6 py-4">
                                                    <span className={`font-bold ${p.UltimoNoAutorizado !== 'NULL' && p.UltimoNoAutorizado ? 'text-red-400' : 'text-neutral-300'}`}>
                                                       {p.UltimoNoAutorizado || '---'}
                                                    </span>
                                                 </td>
                                                 <td className="px-6 py-4 text-right">
                                                    <span className="font-black text-neutral-900 dark:text-white">{Number(p.TotalAutorizados).toLocaleString()}</span>
                                                 </td>
                                                 <td className="px-6 py-4 text-right">
                                                    <span className={`font-black ${Number(p.TotalErrores) > 0 ? 'text-red-500' : 'text-neutral-300'}`}>
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
                               <div className="py-20 text-center bg-white dark:bg-[#111] rounded-[32px] border-2 border-dashed border-neutral-100 dark:border-neutral-800">
                                  <AlertCircle className="w-16 h-16 text-neutral-200 mx-auto mb-6 opacity-30" />
                                  <p className="text-xs font-black text-neutral-400 uppercase tracking-[0.5em] italic">Sin Actividad Operativa Registrada</p>
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
