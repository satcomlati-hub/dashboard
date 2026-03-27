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
  BarChart3,
  TrendingUp,
  Table as TableIcon,
  Copy,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Check
} from 'lucide-react';

interface Voucher {
  ambiente: string;
  co_motivo: string;
  co_pais: number;
  co_nemonico: string;
  co_id_comprobante: number;
  co_hora_in: string;
  co_fecha_emision: string;
  co_num_comprobante: string;
  co_codigo_tipo_documento: string;
  co_establecimiento: string;
  co_punto_emision: string;
  Reprocesable: boolean;
  co_info_detalles: boolean;
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

export default function UnauthorizedVouchersPage() {
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(1800);
  const [copied, setCopied] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200;

  // Grouping
  const [groupBy, setGroupBy] = useState<'none' | 'ambiente' | 'co_pais' | 'co_nemonico'>('none');

  // Filters state
  const [filters, setFilters] = useState({
    ambiente: '',
    co_pais: '',
    co_nemonico: '',
    co_codigo_tipo_documento: '',
    co_establecimiento: '',
    co_punto_emision: '',
    search: '',
    dateRange: 'todo', // hoy, ayer, semana, mes, todo
  });

  const hasActiveFilters = useMemo(() => {
    return filters.ambiente !== '' || filters.co_pais !== '' || filters.co_nemonico !== '' || filters.co_codigo_tipo_documento !== '' || filters.co_establecimiento !== '' || filters.co_punto_emision !== '' || filters.search !== '' || filters.dateRange !== 'todo';
  }, [filters]);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch('https://sara.mysatcomla.com/webhook/MonitoreoNoAutorizados');
      if (!res.ok) throw new Error('Error al obtener datos de comprobantes');
      
      const json: any = await res.json();
      let flattenedVouchers: Voucher[] = [];
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data && typeof item.data === 'string') {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) flattenedVouchers = [...flattenedVouchers, ...parsed];
            } catch (e) {
              console.error('Error parsing voucher data string:', e);
            }
          } else if (item.ambiente) {
            flattenedVouchers.push(item);
          }
        });
      }
      
      setData(flattenedVouchers);
      setError(null);
      setCountdown(1800);
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

  const filteredData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return data.filter(item => {
      const itemDate = new Date(item.co_fecha_emision).getTime();
      
      // Date Range Filter
      let matchDate = true;
      if (filters.dateRange === 'hoy') matchDate = itemDate >= today;
      else if (filters.dateRange === 'ayer') matchDate = itemDate >= yesterday && itemDate < today;
      else if (filters.dateRange === 'semana') matchDate = itemDate >= lastWeek;
      else if (filters.dateRange === 'mes') matchDate = itemDate >= startOfMonth;

      const matchAmbiente = !filters.ambiente || item.ambiente === filters.ambiente;
      const matchPais = !filters.co_pais || item.co_pais.toString() === filters.co_pais;
      const matchNemonico = !filters.co_nemonico || item.co_nemonico.toLowerCase().includes(filters.co_nemonico.toLowerCase());
      const matchTipo = !filters.co_codigo_tipo_documento || item.co_codigo_tipo_documento === filters.co_codigo_tipo_documento;
      const matchEstablecimiento = !filters.co_establecimiento || item.co_establecimiento.includes(filters.co_establecimiento);
      const matchPunto = !filters.co_punto_emision || item.co_punto_emision.includes(filters.co_punto_emision);
      const matchSearch = !filters.search || 
        item.co_num_comprobante.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.co_motivo.toLowerCase().includes(filters.search.toLowerCase());

      return matchDate && matchAmbiente && matchPais && matchNemonico && matchTipo && matchEstablecimiento && matchPunto && matchSearch;
    });
  }, [data, filters]);

  // Grouped Data
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', vouchers: filteredData }];
    
    const groups: Record<string, Voucher[]> = {};
    filteredData.forEach(v => {
      let key = '';
      if (groupBy === 'ambiente') key = v.ambiente;
      else if (groupBy === 'co_pais') key = PAIS_MAP[v.co_pais] || v.co_pais.toString();
      else if (groupBy === 'co_nemonico') key = v.co_nemonico;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    
    return Object.entries(groups).map(([key, vouchers]) => ({ key, vouchers })).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredData, groupBy]);

  // Flatten for pagination if grouped
  const displayItems = useMemo(() => {
    const flat: (Voucher | { type: 'header'; label: string; count: number })[] = [];
    groupedData.forEach(group => {
      if (groupBy !== 'none') {
        flat.push({ type: 'header', label: group.key, count: group.vouchers.length });
      }
      flat.push(...group.vouchers);
    });
    return flat;
  }, [groupedData, groupBy]);

  const totalPages = Math.ceil(displayItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayItems.slice(start, start + pageSize);
  }, [displayItems, currentPage]);

  const copyVoucherIds = () => {
    const ids = filteredData.map(v => v.co_id_comprobante).join('\n');
    navigator.clipboard.writeText(ids);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filterOptions = useMemo(() => ({
    ambientes: Array.from(new Set(data.map(d => d.ambiente))).sort(),
    paises: Array.from(new Set(data.map(d => d.co_pais))).sort((a, b) => a - b),
    tipos: Array.from(new Set(data.map(d => d.co_codigo_tipo_documento))).sort(),
  }), [data]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = useMemo(() => {
    const byPais = data.reduce((acc, d) => {
      acc[d.co_pais] = (acc[d.co_pais] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byDate = data.reduce((acc, d) => {
      const date = formatDate(d.co_fecha_emision);
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedDates = Object.entries(byDate).sort((a, b) => {
      const dateA = a[0].split('/').reverse().join('-');
      const dateB = b[0].split('/').reverse().join('-');
      return dateA.localeCompare(dateB);
    }).slice(-15);

    return { byPais, sortedDates };
  }, [data]);

  const maxDateCount = useMemo(() => Math.max(...stats.sortedDates.map(d => d[1]), 1), [stats.sortedDates]);

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
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-inner">
              <FileWarning className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Comprobantes No Autorizados</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Monitoreo técnico de documentos fallidos.</p>
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

      {/* Country Stats Cards */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
           <Globe className="w-4 h-4 text-[#71BF44]" />
           <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Distribución por País</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Object.entries(stats.byPais).map(([code, count]) => (
            <button 
              key={code} 
              onClick={() => {
                setFilters(f => ({ ...f, co_pais: f.co_pais === code ? '' : code }));
                setCurrentPage(1);
              }}
              className={`bg-white dark:bg-[#131313] border rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-1 ${filters.co_pais === code ? 'border-[#71BF44] ring-1 ring-[#71BF44]/20 bg-[#71BF44]/5' : 'border-neutral-200 dark:border-neutral-800'}`}
            >
              <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1 truncate">{PAIS_MAP[Number(code)] || code}</span>
              <h4 className="text-xl font-black text-neutral-900 dark:text-white">{count.toLocaleString()}</h4>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline & Quick Filter Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#71BF44]" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Histórico de Emisión</h3>
            </div>
          </div>
          <div className="h-48 flex items-end gap-2 sm:gap-4 px-2">
            {stats.sortedDates.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-2 group relative">
                <div 
                  className="w-full bg-[#71BF44]/20 border border-[#71BF44]/10 rounded-t-lg transition-all group-hover:bg-[#71BF44] group-hover:scale-105 cursor-pointer"
                  style={{ height: `${(count / maxDateCount) * 100}%` }}
                />
                <div className="text-[8px] font-bold text-neutral-400 rotate-45 origin-left mt-2 whitespace-nowrap hidden sm:block">
                  {date}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#71BF44]/5 border border-[#71BF44]/20 rounded-2xl p-6 flex flex-col justify-center text-center">
            <div className="w-12 h-12 bg-[#71BF44]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileWarning className="w-6 h-6 text-[#71BF44]" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Resumen</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Total Cargados: <b>{data.length.toLocaleString()}</b><br/>
              Filtrados: <b>{filteredData.length.toLocaleString()}</b>
            </p>
            <button 
              onClick={copyVoucherIds}
              disabled={filteredData.length === 0}
              className="mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-[#71BF44] text-white rounded-xl text-xs font-extrabold hover:bg-[#5fa338] transition-all disabled:opacity-50 shadow-lg shadow-[#71BF44]/20"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '¡Copiado!' : 'Copiar IDs Filtrados'}
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 mb-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#71BF44]" />
            <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Filtros</span>
          </div>
          
          <div className="flex flex-wrap gap-2 ml-4">
            {['hoy', 'ayer', 'semana', 'mes', 'todo'].map(range => (
              <button
                key={range}
                onClick={() => { setFilters(f => ({ ...f, dateRange: range })); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${filters.dateRange === range ? 'bg-[#71BF44] text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200'}`}
              >
                {range}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button 
              onClick={() => { setFilters({ ambiente: '', co_pais: '', co_nemonico: '', co_codigo_tipo_documento: '', co_establecimiento: '', co_punto_emision: '', search: '', dateRange: 'todo' }); setCurrentPage(1); }}
              className="ml-auto text-[10px] text-red-500 hover:underline flex items-center gap-1 font-bold"
            >
              <X className="w-3 h-3" /> Limpiar Todo
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Ambiente</label>
            <select 
              value={filters.ambiente}
              onChange={(e) => { setFilters(f => ({ ...f, ambiente: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            >
              <option value="">Todos</option>
              {filterOptions.ambientes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">País</label>
            <select 
              value={filters.co_pais}
              onChange={(e) => { setFilters(f => ({ ...f, co_pais: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            >
              <option value="">Todos</option>
              {filterOptions.paises.map(p => <option key={p} value={p}>{PAIS_MAP[p] || p}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Nemónico</label>
            <input 
              type="text"
              placeholder="Ej: ABCD"
              value={filters.co_nemonico}
              onChange={(e) => { setFilters(f => ({ ...f, co_nemonico: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Tipo Doc</label>
            <select 
              value={filters.co_codigo_tipo_documento}
              onChange={(e) => { setFilters(f => ({ ...f, co_codigo_tipo_documento: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            >
              <option value="">Todos</option>
              {filterOptions.tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Estab.</label>
            <input 
              type="text"
              placeholder="001"
              value={filters.co_establecimiento}
              onChange={(e) => { setFilters(f => ({ ...f, co_establecimiento: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Pto. Emisión</label>
            <input 
              type="text"
              placeholder="001"
              value={filters.co_punto_emision}
              onChange={(e) => { setFilters(f => ({ ...f, co_punto_emision: e.target.value })); setCurrentPage(1); }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Buscador Detalle</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input 
                type="text"
                placeholder="Obs/Número..."
                value={filters.search}
                onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setCurrentPage(1); }}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grouping & Grid Actions */}
      {hasActiveFilters && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 bg-white dark:bg-[#131313] px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#71BF44]" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase">Agrupar Por:</span>
            </div>
            <div className="flex gap-1">
              {[
                { id: 'none', label: 'Ninguno' },
                { id: 'ambiente', label: 'Ambiente' },
                { id: 'co_pais', label: 'País' },
                { id: 'co_nemonico', label: 'Nemónico' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setGroupBy(opt.id as any); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${groupBy === opt.id ? 'bg-[#71BF44]/10 text-[#71BF44]' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 bg-white dark:bg-[#131313] px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                disabled={currentPage === 1}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold px-4 text-neutral-500">Página {currentPage} de {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                disabled={currentPage === totalPages}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-30"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-[#71BF44]/30 border-t-[#71BF44] rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-8 text-center text-red-500"><AlertCircle className="w-10 h-10 mx-auto mb-2" />{error}</div>
      ) : !hasActiveFilters ? (
        <div className="bg-white dark:bg-[#131313] border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-20 text-center">
           <Filter className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
           <p className="text-sm font-bold text-neutral-400">Seleccione un filtro para visualizar los {data.length.toLocaleString()} registros.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-[#0e0e0e] border-b border-neutral-200 dark:border-neutral-800">
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Comprobante</th>
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Fecha Emisión</th>
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Amb/País/Nem</th>
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Detalles</th>
                    <th className="text-center px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-400">Sin resultados.</td></tr>
                  ) : (
                    paginatedItems.map((item, i) => {
                      if ('type' in item && item.type === 'header') {
                        return (
                          <tr key={`header-${item.label}`} className="bg-neutral-50 dark:bg-neutral-900/50 border-y border-neutral-100 dark:border-neutral-800">
                            <td colSpan={5} className="px-6 py-2">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#71BF44]"></span>
                                <span className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest">{item.label}</span>
                                <span className="text-[10px] font-bold text-neutral-400 ml-2">({item.count} registros)</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      const voucher = item as Voucher;
                      return (
                        <tr key={voucher.co_id_comprobante} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-mono text-neutral-400 mb-0.5">#{voucher.co_id_comprobante}</span>
                              <span className="font-bold text-neutral-900 dark:text-white truncate max-w-[200px]">{voucher.co_num_comprobante}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{formatDate(voucher.co_fecha_emision)}</span>
                              <span className="text-[9px] text-neutral-400 uppercase">Ingreso: {new Date(voucher.co_hora_in).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-1.5">
                                 <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">{voucher.ambiente}</span>
                                 <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">{PAIS_MAP[voucher.co_pais] || voucher.co_pais}</span>
                               </div>
                               <span className="text-[10px] font-mono text-neutral-500">{voucher.co_nemonico}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[300px]">
                            <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed" title={voucher.co_motivo}>
                              {voucher.co_motivo || <span className="italic opacity-40">Sin detalles técnicos</span>}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <a 
                              href={`https://www5.mysatcomla.com/Facturacion/Comprobantes/DetalleReporte?idComprobante=${voucher.co_id_comprobante}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#71BF44]/10 text-[#71BF44] rounded-lg text-xs font-bold hover:bg-[#71BF44] hover:text-white transition-all group"
                            >
                              Reporte
                              <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}
