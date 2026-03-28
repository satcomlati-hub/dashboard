'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  FileWarning, 
  ExternalLink, 
  Clock, 
  RefreshCw, 
  Filter, 
  Search, 
  Calendar, 
  Globe, 
  Hash, 
  Building2, 
  MapPin, 
  X,
  AlertCircle,
  TrendingUp,
  Table as TableIcon,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface Voucher {
  ambiente: string;
  co_motivo: string;
  co_pais: number;
  co_nemonico: string;
  Column1: string; // ID
  co_hora_in: string;
  co_fecha_emision: string;
  co_num_comprobante: string;
  co_codigo_tipo_documento: string;
  co_establecimiento: string;
  co_punto_emision: string;
  Reprocesable: boolean;
  co_detalle: string;
  co_ultima_actualizacion: string;
  co_numero_reprocesos: number;
  co_hora_reproceso: string;
  DescripcionEstatus: string;
  DescripcionTipoDocumento: string;
}

const PAIS_MAP: Record<number, string> = {
  593: 'Ecuador',
  57: 'Colombia',
  506: 'Costa Rica',
  507: 'Panamá',
  51: 'Perú',
  54: 'Argentina',
  56: 'Chile',
  502: 'Guatemala',
  503: 'El Salvador',
  504: 'Honduras',
  505: 'Nicaragua',
  58: 'Venezuela',
  1: 'USA/PR',
};

type SortField = keyof Voucher | 'pais_name';
type SortOrder = 'asc' | 'desc';

export default function UnauthorizedVouchersPage() {
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(1800);
  const [copied, setCopied] = useState(false);

  // Layout states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200;
  const [sortField, setSortField] = useState<SortField>('co_hora_in');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'co_nemonico' | 'DescripcionTipoDocumento' | 'DescripcionEstatus' | 'co_detalle'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Global but hidden from top UI (driven by column filters)
  const [filters, setFilters] = useState({
    co_num_comprobante: '',
    co_detalle: '',
    co_nemonico: '',
    co_pais: '',
    ambiente: '',
    DescripcionEstatus: '',
    DescripcionTipoDocumento: '',
    co_establecimiento: '',
    co_punto_emision: '',
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch('https://sara.mysatcomla.com/webhook/MonitoreoNoAutorizados');
      if (!res.ok) throw new Error('Error al obtener datos');
      
      const json: any = await res.json();
      let flattened: Voucher[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data && typeof item.data === 'string') {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) flattened = [...flattened, ...parsed];
            } catch (e) {
              console.error('Error parsing nested JSON', e);
            }
          } else if (item.ambiente || item.Column1) {
            flattened.push(item);
          }
        });
      }
      
      setData(flattened);
      setError(null);
      setCountdown(1800);
      setExpandedGroups(new Set());
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 1800;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const lastUpdate = useMemo(() => {
    if (data.length === 0) return '---';
    const dates = data.map(d => new Date(d.co_ultima_actualizacion).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return '---';
    return new Date(Math.max(...dates)).toLocaleString('es-EC');
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      return (
        (!filters.co_num_comprobante || item.co_num_comprobante.toLowerCase().includes(filters.co_num_comprobante.toLowerCase())) &&
        (!filters.co_detalle || item.co_detalle.toLowerCase().includes(filters.co_detalle.toLowerCase())) &&
        (!filters.co_nemonico || item.co_nemonico.toLowerCase().includes(filters.co_nemonico.toLowerCase())) &&
        (!filters.co_pais || (PAIS_MAP[item.co_pais] || item.co_pais.toString()).toLowerCase().includes(filters.co_pais.toLowerCase())) &&
        (!filters.ambiente || item.ambiente.toLowerCase().includes(filters.ambiente.toLowerCase())) &&
        (!filters.DescripcionEstatus || item.DescripcionEstatus.toLowerCase().includes(filters.DescripcionEstatus.toLowerCase())) &&
        (!filters.DescripcionTipoDocumento || item.DescripcionTipoDocumento.toLowerCase().includes(filters.DescripcionTipoDocumento.toLowerCase())) &&
        (!filters.co_establecimiento || item.co_establecimiento.toLowerCase().includes(filters.co_establecimiento.toLowerCase())) &&
        (!filters.co_punto_emision || item.co_punto_emision.toLowerCase().includes(filters.co_punto_emision.toLowerCase()))
      );
    });

    result.sort((a, b) => {
      let valA: any = a[sortField as keyof Voucher] ?? '';
      let valB: any = b[sortField as keyof Voucher] ?? '';
      if (sortField === 'pais_name') {
        valA = PAIS_MAP[a.co_pais] || '';
        valB = PAIS_MAP[b.co_pais] || '';
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filters, sortField, sortOrder]);

  const anyFilterActive = useMemo(() => Object.values(filters).some(v => v !== ''), [filters]);

  const groupedData = useMemo(() => {
    if (!anyFilterActive) return [];
    if (groupBy === 'none') return [{ key: 'Todos', vouchers: filteredData }];
    const groups: Record<string, Voucher[]> = {};
    filteredData.forEach(v => {
      let key = 'Sin Categoría';
      if (groupBy === 'co_nemonico') key = v.co_nemonico;
      else if (groupBy === 'co_detalle') key = v.co_detalle || 'Sin Detalle';
      else if (groupBy === 'DescripcionEstatus') key = v.DescripcionEstatus || 'Sin Estado';
      else if (groupBy === 'DescripcionTipoDocumento') key = v.DescripcionTipoDocumento || 'Sin Tipo Documento';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return Object.entries(groups).map(([key, vouchers]) => ({ key, vouchers })).sort((a, b) => b.vouchers.length - a.vouchers.length);
  }, [filteredData, groupBy]);

  const displayItems = useMemo(() => {
    const flat: (Voucher | { type: 'header'; label: string; count: number })[] = [];
    if (!anyFilterActive) return [];
    
    for (const group of groupedData) {
      if (groupBy !== 'none') {
        flat.push({ type: 'header', label: group.key, count: group.vouchers.length });
        if (expandedGroups.has(group.key)) {
          flat.push(...group.vouchers);
        }
      } else {
        flat.push(...group.vouchers);
      }
    }
    return flat;
  }, [groupedData, groupBy, expandedGroups, anyFilterActive]);

  const totalPages = Math.ceil(displayItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayItems.slice(start, start + pageSize);
  }, [displayItems, currentPage]);

  const stats = useMemo(() => {
    const byPais = data.reduce((acc, d) => {
      acc[d.co_pais] = (acc[d.co_pais] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byTime = data.reduce((acc, d) => {
      const date = new Date(d.co_hora_in).toLocaleDateString('es-EC');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedDates = Object.entries(byTime).sort((a, b) => {
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    }).slice(-15);

    return { byPais, sortedDates };
  }, [data]);

  const maxDateCount = useMemo(() => Math.max(...stats.sortedDates.map(d => d[1]), 1), [stats.sortedDates]);

  const handleCopy = () => {
    const ids = filteredData.map(v => v.Column1 || (v as any).co_id_comprobante).join('\n');
    navigator.clipboard.writeText(ids);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Header */}
      <header className="mb-8 py-6 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Analytics
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 rounded-[20px] bg-[#71BF44]/10 flex items-center justify-center shadow-inner ring-1 ring-[#71BF44]/20">
                <FileWarning className="w-8 h-8 text-[#71BF44]" />
             </div>
             <div>
                <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Comprobantes No Autorizados</h2>
                <div className="flex items-center gap-3 mt-1">
                   <span className="text-xs font-bold text-neutral-400 uppercase flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> {formatCountdown(countdown)}
                   </span>
                   <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                   <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest">Live Monitor</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchData(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl text-xs font-black shadow-lg shadow-[#71BF44]/10 hover:bg-[#71BF44] dark:hover:bg-[#71BF44] dark:hover:text-white transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
        <div className="xl:col-span-3">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-black text-[10px] text-neutral-400 uppercase tracking-widest">
                 <Globe className="w-4 h-4 text-[#71BF44]" /> Resumen por Localidad
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#131313] rounded-lg border border-neutral-800">
                 <span className="text-[9px] font-black text-neutral-500 uppercase tracking-tighter">Última Act:</span>
                 <span className="text-[10px] font-mono font-bold text-[#71BF44]">{lastUpdate}</span>
              </div>
           </div>
           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(stats.byPais).map(([code, count]) => {
                const countryName = PAIS_MAP[Number(code)] || code;
                const isActive = filters.co_pais === countryName;
                return (
                  <button 
                   key={code} 
                   onClick={() => { setFilters(f => ({ ...f, co_pais: isActive ? '' : countryName })); setCurrentPage(1); }}
                   className={`bg-white dark:bg-[#111] border rounded-2xl p-4 shadow-sm relative overflow-hidden group transition-all text-left ${isActive ? 'border-[#71BF44] ring-2 ring-[#71BF44]/20' : 'border-neutral-200 dark:border-neutral-800 border-neutral-200 dark:border-neutral-800 hover:border-[#71BF44]/50'}`}
                  >
                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-[40px] -mr-4 -mt-4 transition-all group-hover:scale-110 ${isActive ? 'bg-[#71BF44]/20' : 'bg-[#71BF44]/5'}`}></div>
                    <span className="text-[9px] font-black text-neutral-400 uppercase block mb-1 truncate">{countryName}</span>
                    <div className={`text-2xl font-black mb-1 ${isActive ? 'text-[#71BF44]' : 'text-neutral-900 dark:text-white'}`}>{count}</div>
                    <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-[#71BF44]" style={{ width: `${(count / data.length) * 100}%` }}></div>
                    </div>
                  </button>
                );
              })}
           </div>
        </div>

        <div className="bg-[#111] border border-neutral-800 rounded-[24px] p-6 flex flex-col justify-center border-t-2 border-t-[#71BF44]">
           <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[#71BF44]" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Consolidado</h3>
           </div>
           <div className="space-y-4">
              <div className="flex items-end justify-between">
                 <span className="text-[10px] font-bold text-neutral-500 uppercase">Total Entidad</span>
                 <span className="text-2xl font-black text-white">{data.length.toLocaleString()}</span>
              </div>
              <div className="flex items-end justify-between">
                 <span className="text-[10px] font-bold text-neutral-500 uppercase">En Vista</span>
                 <span className="text-xl font-black text-[#71BF44]">{filteredData.length.toLocaleString()}</span>
              </div>
              <button 
                onClick={handleCopy}
                disabled={filteredData.length === 0}
                className={`w-full py-3 mt-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-[#71BF44] text-white hover:bg-[#5fa338] shadow-lg shadow-[#71BF44]/20'}`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Exportar Lista IDs'}
              </button>
           </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[24px] p-6 mb-8 shadow-sm">
         <div className="flex items-center gap-2 mb-8">
            <TrendingUp className="w-4 h-4 text-[#71BF44]" />
            <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Trayectoria Temporal de Ingreso (co_hora_in)</h3>
         </div>
         <div className="h-40 flex items-end gap-3 sm:gap-6 px-4">
            {stats.sortedDates.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-2 group relative">
                 <div 
                   className="w-full bg-[#71BF44]/10 border-t-2 border-[#71BF44] rounded-t-sm transition-all group-hover:bg-[#71BF44]/30"
                   style={{ height: `${(count / maxDateCount) * 100}%` }}
                 />
                 <div className="text-[8px] font-bold text-neutral-500 rotate-45 origin-left mt-2 whitespace-nowrap">{date}</div>
              </div>
            ))}
         </div>
      </div>

      {/* Group Selector "Ver por" */}
      <div className="flex flex-wrap items-center gap-6 mb-6">
         <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-6 py-2.5 rounded-2xl shadow-xl">
            <Layers className="w-4 h-4 text-[#71BF44]" />
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Ver por:</span>
            <div className="flex gap-2">
               {[
                 { id: 'none', label: 'Lista Plana' },
                 { id: 'co_nemonico', label: 'Nemónico' },
                 { id: 'DescripcionTipoDocumento', label: 'Documento' },
                 { id: 'DescripcionEstatus', label: 'Estado' },
                 { id: 'co_detalle', label: 'Motivo' }
               ].map(opt => (
                 <button
                  key={opt.id}
                  onClick={() => { setGroupBy(opt.id as any); setCurrentPage(1); setExpandedGroups(new Set()); }}
                  className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${groupBy === opt.id ? 'bg-[#71BF44] text-white' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                 >
                   {opt.label}
                 </button>
               ))}
            </div>
         </div>

         {/* Pagination Controls */}
         {totalPages > 1 && (
            <div className="flex items-center gap-4 bg-[#111] border border-neutral-800 px-4 py-2 rounded-2xl">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronsLeft className="w-5 h-5"/></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronLeft className="w-5 h-5"/></button>
              <span className="text-[10px] font-black text-white px-2">PAG {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronRight className="w-5 h-5"/></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronsRight className="w-5 h-5"/></button>
            </div>
         )}
      </div>

      {/* Main Grid */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-2xl transition-all duration-300">
         <div className="overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                  <tr className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-200 dark:border-neutral-800">
                     <th className="px-6 py-4 min-w-[300px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_num_comprobante')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Comprobante
                              {sortField === 'co_num_comprobante' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="relative group">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700" />
                              <input 
                                placeholder="Filtrar por Número..."
                                value={filters.co_num_comprobante}
                                onChange={(e) => { setFilters(f => ({ ...f, co_num_comprobante: e.target.value })); setCurrentPage(1); }}
                                className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-[10px] font-medium outline-none transition-all focus:ring-1 focus:ring-[#71BF44]/30"
                              />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[200px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_establecimiento')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Establecimiento
                              {sortField === 'co_establecimiento' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="grid grid-cols-2 gap-2">
                             <input placeholder="Est." value={filters.co_establecimiento} onChange={(e) => setFilters(f => ({ ...f, co_establecimiento: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                             <input placeholder="Pto." value={filters.co_punto_emision} onChange={(e) => setFilters(f => ({ ...f, co_punto_emision: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[200px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_nemonico')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Origen
                              {sortField === 'co_nemonico' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="space-y-2">
                              <input placeholder="Nemónico..." value={filters.co_nemonico} onChange={(e) => setFilters(f => ({ ...f, co_nemonico: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                              <input placeholder="País/Amb..." value={filters.ambiente} onChange={(e) => setFilters(f => ({ ...f, ambiente: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[150px]">
                        <button onClick={() => toggleSort('co_hora_in')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                           Ingreso
                           {sortField === 'co_hora_in' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                        </button>
                     </th>
                     <th className="px-6 py-6 min-w-[350px]">
                        <div className="space-y-4">
                           <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Información de Reproceso</span>
                           <div className="grid grid-cols-2 gap-2">
                              <input placeholder="Motivo/Detalle..." value={filters.co_detalle} onChange={(e) => setFilters(f => ({ ...f, co_detalle: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] outline-none" />
                              <input placeholder="Estado..." value={filters.DescripcionEstatus} onChange={(e) => setFilters(f => ({ ...f, DescripcionEstatus: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] outline-none" />
                           </div>
                        </div>
                     </th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/10">
                  {!anyFilterActive ? (
                    <tr><td colSpan={5} className="py-24 text-center">
                       <div className="flex flex-col items-center gap-4 animate-pulse">
                          <Filter className="w-12 h-12 text-neutral-700" />
                          <div className="text-neutral-500 font-black uppercase tracking-[0.2em]">Seleccione un País o aplique un filtro para visualizar datos</div>
                       </div>
                    </td></tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr><td colSpan={5} className="py-24 text-center text-neutral-400 font-black uppercase tracking-[0.5em] opacity-20 text-3xl">Sin Registros</td></tr>
                  ) : (
                    paginatedItems.map((item, i) => {
                      if ('type' in item && item.type === 'header') {
                        const isExp = expandedGroups.has(item.label);
                        return (
                          <tr key={`h-${item.label}`} className="bg-neutral-800 dark:bg-black/90 z-20 transition-all hover:bg-neutral-700 border-l-4 border-l-[#71BF44]">
                             <td colSpan={5} className="px-6 py-4 cursor-pointer" onClick={() => toggleGroup(item.label)}>
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className={`p-1.5 rounded-lg ${isExp ? 'bg-[#71BF44] text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                                         {isExp ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                      </div>
                                      <span className="text-xs font-black text-white uppercase tracking-[0.1em]">{item.label}</span>
                                      <span className="text-xs font-bold text-[#71BF44]">({item.count})</span>
                                   </div>
                                   <div className="h-[1px] flex-1 mx-6 bg-white/5"></div>
                                   <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{isExp ? 'OCULTAR DETALLE' : 'VER DETALLE'}</span>
                                </div>
                             </td>
                          </tr>
                        );
                      }
                      
                      const v = item as Voucher;
                      const ID = v.Column1 || (v as any).co_id_comprobante;
                      const isGrouped = groupBy !== 'none';
                      return (
                        <tr key={ID} className={`group transition-all ${isGrouped ? 'bg-[#71BF44]/[0.02] hover:bg-[#71BF44]/10' : 'hover:bg-[#71BF44]/5'}`}>
                           <td className={`px-6 py-6 transition-all ${isGrouped ? 'pl-10' : 'group-hover:pl-8'}`}>
                              <div className="flex flex-col">
                                 <a 
                                  href={`https://www5.mysatcomla.com/Facturacion/Comprobantes/DetalleReporte?idComprobante=${ID}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-black text-[#71BF44] hover:underline mb-1 flex items-center gap-1 group/link"
                                 >
                                    <Hash className="w-3 h-3" /> {ID}
                                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                 </a>
                                 <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-neutral-900 dark:text-white">{v.co_num_comprobante}</span>
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                                       {v.DescripcionTipoDocumento}
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2 mt-2">
                                    <Calendar className="w-3 h-3 text-neutral-500" />
                                    <span className="text-[10px] font-bold text-neutral-400">{v.co_fecha_emision ? new Date(v.co_fecha_emision).toLocaleDateString('es-EC') : 'S/F'}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2 text-xs font-black text-neutral-800 dark:text-neutral-300">
                                    <Building2 className="w-3.5 h-3.5 text-neutral-600" /> {v.co_establecimiento}
                                 </div>
                                 <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                                    <MapPin className="w-3.5 h-3.5 text-neutral-600" /> {v.co_punto_emision}
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="space-y-2">
                                 <div className="text-[11px] font-black text-neutral-900 dark:text-white tracking-widest">{v.co_nemonico}</div>
                                 <div className="flex flex-wrap gap-2">
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 border border-blue-600/20">{v.ambiente}</span>
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-600/10 text-amber-600 border border-amber-600/20">{PAIS_MAP[v.co_pais] || v.co_pais}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="flex flex-col font-mono">
                                 <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200">{v.co_hora_in ? new Date(v.co_hora_in).toLocaleDateString('es-EC') : '--'}</span>
                                 <span className="text-[10px] text-neutral-500">{v.co_hora_in ? new Date(v.co_hora_in).toLocaleTimeString('es-EC') : '--'}</span>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="space-y-4">
                                 <div className="flex items-start gap-4">
                                    {v.DescripcionEstatus && (
                                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${v.DescripcionEstatus.toLowerCase().includes('rechazado') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                          {v.DescripcionEstatus}
                                       </span>
                                    )}
                                    <p className="text-[10px] font-medium text-neutral-500 leading-normal line-clamp-2 italic" title={v.co_detalle}>
                                       {v.co_detalle || 'Sin detalle técnico reportado.'}
                                    </p>
                                 </div>
                                 <div className="grid grid-cols-2 gap-6 p-3 bg-neutral-50 dark:bg-black/50 rounded-xl border border-neutral-100 dark:border-neutral-900">
                                    <div className="flex flex-col gap-0.5">
                                       <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Intenciones</span>
                                       <div className="flex items-center gap-2">
                                          <div className={`text-xs font-black ${Number(v.co_numero_reprocesos) > 0 ? 'text-[#71BF44]' : 'text-neutral-600'}`}>
                                             {v.co_numero_reprocesos ?? 0}
                                          </div>
                                          {(v.co_numero_reprocesos || 0) > 3 && <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />}
                                       </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                       <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Última Gestión</span>
                                       <span className="text-[10px] font-mono font-bold text-neutral-400">
                                          {v.co_hora_reproceso ? new Date(v.co_hora_reproceso).toLocaleString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                       </span>
                                    </div>
                                 </div>
                              </div>
                           </td>
                        </tr>
                      );
                    })
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
