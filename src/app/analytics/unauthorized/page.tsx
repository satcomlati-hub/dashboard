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
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
  co_numero_reprocesos?: number;
  co_hora_reproceso?: string;
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200;

  // Sorting
  const [sortField, setSortField] = useState<SortField>('co_hora_in');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Grouping & Expansion
  const [groupBy, setGroupBy] = useState<'none' | 'ambiente' | 'co_pais' | 'co_nemonico'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filters state
  const [filters, setFilters] = useState({
    ambiente: '',
    co_pais: '',
    co_nemonico: '',
    co_codigo_tipo_documento: '',
    co_establecimiento: '',
    co_punto_emision: '',
    search: '',
    dateRange: 'todo',
    col_num_comprobante: '',
    col_motivo: '',
  });

  const hasActiveFilters = useMemo(() => {
    return filters.ambiente !== '' || filters.co_pais !== '' || filters.co_nemonico !== '' || filters.co_codigo_tipo_documento !== '' || filters.co_establecimiento !== '' || filters.co_punto_emision !== '' || filters.search !== '' || filters.dateRange !== 'todo' || filters.col_num_comprobante !== '' || filters.col_motivo !== '';
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
      // Initialize groups as expanded
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

  const filteredData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let result = data.filter(item => {
      const entryTime = new Date(item.co_hora_in).getTime();
      
      let matchDate = true;
      if (filters.dateRange === 'hoy') matchDate = entryTime >= today;
      else if (filters.dateRange === 'ayer') matchDate = entryTime >= yesterday && entryTime < today;
      else if (filters.dateRange === 'semana') matchDate = entryTime >= lastWeek;
      else if (filters.dateRange === 'mes') matchDate = entryTime >= startOfMonth;

      const matchAmbiente = !filters.ambiente || item.ambiente === filters.ambiente;
      const matchPais = !filters.co_pais || item.co_pais.toString() === filters.co_pais;
      const matchNemonico = !filters.co_nemonico || item.co_nemonico === filters.co_nemonico;
      const matchTipo = !filters.co_codigo_tipo_documento || item.co_codigo_tipo_documento === filters.co_codigo_tipo_documento;
      const matchEstablecimiento = !filters.co_establecimiento || item.co_establecimiento.includes(filters.co_establecimiento);
      const matchPunto = !filters.co_punto_emision || item.co_punto_emision.includes(filters.co_punto_emision);
      const matchColNum = !filters.col_num_comprobante || item.co_num_comprobante.toLowerCase().includes(filters.col_num_comprobante.toLowerCase());
      const matchColMotivo = !filters.col_motivo || item.co_motivo.toLowerCase().includes(filters.col_motivo.toLowerCase());
      const matchSearch = !filters.search || 
        item.co_num_comprobante.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.co_motivo.toLowerCase().includes(filters.search.toLowerCase());

      return matchDate && matchAmbiente && matchPais && matchNemonico && matchTipo && matchEstablecimiento && matchPunto && matchSearch && matchColNum && matchColMotivo;
    });

    // Sorting
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

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

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const displayItems = useMemo(() => {
    const flat: (Voucher | { type: 'header'; label: string; count: number })[] = [];
    groupedData.forEach(group => {
      if (groupBy !== 'none') {
        flat.push({ type: 'header', label: group.key, count: group.vouchers.length });
        if (!expandedGroups.has(group.key)) {
           // If NOT expanded, don't push vouchers
           return;
        }
      }
      flat.push(...group.vouchers);
    });
    return flat;
  }, [groupedData, groupBy, expandedGroups]);

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
    nemonicos: Array.from(new Set(data.map(d => d.co_nemonico))).sort(),
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

    // Use co_hora_in for timeline as requested
    const byTime = data.reduce((acc, d) => {
      const date = formatDate(d.co_hora_in);
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedDates = Object.entries(byTime).sort((a, b) => {
      const dateA = a[0].split('/').reverse().join('-');
      const dateB = b[0].split('/').reverse().join('-');
      return dateA.localeCompare(dateB);
    }).slice(-15);

    return { byPais, sortedDates };
  }, [data]);

  const maxDateCount = useMemo(() => Math.max(...stats.sortedDates.map(d => d[1]), 1), [stats.sortedDates]);

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
              <FileWarning className="w-7 h-7 text-[#71BF44]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Monitoreo No Autorizados</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Control técnico avanzado de comprobantes fallidos.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Actualización automática</span>
              <span className="text-sm font-mono font-bold text-[#71BF44]">{formatCountdown(countdown)}</span>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] text-xs font-bold text-[#71BF44] border border-[#71BF44]/30 rounded-lg shadow-sm hover:bg-[#71BF44]/5 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando' : 'Refrescar'}
            </button>
          </div>
        </div>
      </header>

      {/* Country Cards */}
      <div className="mb-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
           <Globe className="w-4 h-4 text-[#71BF44]" />
           <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Resumen Geográfico</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 overflow-x-auto pb-2">
          {Object.entries(stats.byPais).map(([code, count]) => (
            <button 
              key={code} 
              onClick={() => { setFilters(f => ({ ...f, co_pais: f.co_pais === code ? '' : code })); setCurrentPage(1); }}
              className={`min-w-[120px] bg-white dark:bg-[#131313] border rounded-2xl p-4 shadow-sm transition-all hover:scale-[1.02] ${filters.co_pais === code ? 'border-[#71BF44] bg-[#71BF44]/5 ring-1 ring-[#71BF44]/20' : 'border-neutral-200 dark:border-neutral-800'}`}
            >
              <span className="text-[9px] font-black text-neutral-400 uppercase block mb-1 truncate">{PAIS_MAP[Number(code)] || code}</span>
              <h4 className="text-xl font-black text-neutral-900 dark:text-white">{count.toLocaleString()}</h4>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#71BF44]" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Flujo de Ingreso (Entrada)</h3>
            </div>
            <span className="text-[10px] text-neutral-400 italic">Basado en co_hora_in</span>
          </div>
          <div className="h-48 flex items-end gap-2 sm:gap-4 px-2">
            {stats.sortedDates.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-2 group relative">
                <div 
                  className="w-full bg-[#71BF44] rounded-t-lg transition-all opacity-20 group-hover:opacity-100"
                  style={{ height: `${(count / maxDateCount) * 100}%` }}
                />
                <div className="text-[8px] font-bold text-neutral-400 rotate-45 origin-left mt-2 whitespace-nowrap hidden sm:block">{date}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#131313] border border-neutral-800 rounded-2xl p-6 flex flex-col justify-center border-l-4 border-l-[#71BF44]">
            <h3 className="text-base font-bold text-white mb-2">Acción Masiva</h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              Extrae todos los IDs de comprobantes que coinciden con los filtros actuales para procesamiento externo.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px] text-neutral-500 font-bold uppercase tracking-tight">
                <span>Resultados:</span>
                <span className="text-white">{filteredData.length.toLocaleString()}</span>
              </div>
              <button 
                onClick={copyVoucherIds}
                disabled={filteredData.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#71BF44] text-white rounded-xl text-xs font-black hover:bg-[#5fa338] transition-all disabled:opacity-50"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '¡COPIADO!' : 'COPIAR LISTA DE IDs'}
              </button>
            </div>
        </div>
      </div>

      {/* Main Filters */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Filter className="w-4 h-4 text-[#71BF44]" />
          <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">Panel de Control</span>
          <div className="flex gap-2 ml-4">
            {['hoy', 'ayer', 'semana', 'mes', 'todo'].map(range => (
              <button
                key={range}
                onClick={() => { setFilters(f => ({ ...f, dateRange: range })); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${filters.dateRange === range ? 'bg-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200'}`}
              >
                {range}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button 
              onClick={() => { setFilters({ ambiente: '', co_pais: '', co_nemonico: '', co_codigo_tipo_documento: '', co_establecimiento: '', co_punto_emision: '', search: '', dateRange: 'todo', col_num_comprobante: '', col_motivo: '' }); setCurrentPage(1); }}
              className="ml-auto flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Limpiar Todo
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {[
            { label: 'Ambiente', key: 'ambiente', type: 'select', opts: filterOptions.ambientes },
            { label: 'País', key: 'co_pais', type: 'select', opts: filterOptions.paises.map(p => ({ val: p, lab: PAIS_MAP[p] || p })) },
            { label: 'Nemónico', key: 'co_nemonico', type: 'select', opts: filterOptions.nemonicos },
            { label: 'Tipo Doc', key: 'co_codigo_tipo_documento', type: 'select', opts: filterOptions.tipos },
            { label: 'Establecimiento', key: 'co_establecimiento', type: 'text' },
            { label: 'Pto Emisión', key: 'co_punto_emision', type: 'text' },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{f.label}</label>
              {f.type === 'select' ? (
                <select 
                  value={(filters as any)[f.key]}
                  onChange={(e) => { setFilters(prev => ({ ...prev, [f.key]: e.target.value })); setCurrentPage(1); }}
                  className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all"
                >
                  <option value="">Todos</option>
                  {f.opts?.map((o: any) => (
                    <option key={typeof o === 'object' ? o.val : o} value={typeof o === 'object' ? o.val : o}>
                      {typeof o === 'object' ? o.lab : o}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text"
                  placeholder="..."
                  value={(filters as any)[f.key]}
                  onChange={(e) => { setFilters(prev => ({ ...prev, [f.key]: e.target.value })); setCurrentPage(1); }}
                  className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Grouping & Grid Actions */}
      {hasActiveFilters && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 bg-white dark:bg-[#131313] px-5 py-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#71BF44]" />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ver por:</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { id: 'none', label: 'Lista Plana' },
                { id: 'ambiente', label: 'Ambiente' },
                { id: 'co_pais', label: 'País' },
                { id: 'co_nemonico', label: 'Nemónico' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setGroupBy(opt.id as any); setCurrentPage(1); setExpandedGroups(new Set()); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${groupBy === opt.id ? 'bg-[#71BF44] text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-3 bg-white dark:bg-[#131313] px-4 py-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-20 transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-20 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[10px] font-black text-neutral-500 tracking-tighter w-24 text-center">PAG {currentPage} | {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-20 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-20 transition-colors"><ChevronsRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      {/* Advanced Data Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-40"><RefreshCw className="w-10 h-10 text-[#71BF44] animate-spin" /></div>
      ) : !hasActiveFilters ? (
        <div className="bg-white dark:bg-[#131313] border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[32px] p-24 text-center">
           <Filter className="w-16 h-16 text-neutral-100 dark:text-neutral-900 mx-auto mb-6" />
           <p className="text-sm font-black text-neutral-300 uppercase tracking-[0.2em]">Filtro Obligatorio para Detalle</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-[24px] overflow-hidden shadow-xl animate-in fade-in duration-500">
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-[#080808] border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-6 py-4">
                      <div className="space-y-2">
                        <button onClick={() => toggleSort('co_id_comprobante')} className="flex items-center gap-1.5 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-white transition-colors">
                          Comprobante {sortField === 'co_id_comprobante' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 opacity-30"/>}
                        </button>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
                          <input 
                            placeholder="Buscar Nro..."
                            value={filters.col_num_comprobante}
                            onChange={(e) => { setFilters(f => ({ ...f, col_num_comprobante: e.target.value })); setCurrentPage(1); }}
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-2 py-1 text-[9px] outline-none"
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-6 py-4">
                      <button onClick={() => toggleSort('co_hora_in')} className="flex items-center gap-1.5 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-white transition-colors">
                        Ingreso {sortField === 'co_hora_in' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 opacity-30"/>}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button onClick={() => toggleSort('pais_name')} className="flex items-center gap-1.5 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-white transition-colors group">
                        Origen {sortField === 'pais_name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100"/>}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <div className="space-y-2">
                         <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Información de Reproceso</span>
                         <div className="relative">
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
                           <input 
                            placeholder="Filtrar Motivo..."
                            value={filters.col_motivo}
                            onChange={(e) => { setFilters(f => ({ ...f, col_motivo: e.target.value })); setCurrentPage(1); }}
                            className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-2 py-1 text-[9px] outline-none"
                          />
                         </div>
                      </div>
                    </th>
                    <th className="text-center px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, i) => {
                    if ('type' in item && item.type === 'header') {
                      const isExpanded = expandedGroups.has(item.label);
                      return (
                        <tr key={`header-${item.label}`} className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-100 dark:border-neutral-800 sticky top-0 z-10 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                          <td colSpan={5} className="px-6 py-1.5 cursor-pointer" onClick={() => toggleGroup(item.label)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1 rounded bg-[#71BF44]/20 text-[#71BF44]">
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </div>
                                <span className="text-[11px] font-black text-neutral-900 dark:text-white tracking-[0.1em] uppercase">{item.label}</span>
                                <span className="text-[10px] font-bold text-neutral-500">({item.count} items)</span>
                              </div>
                              <div className="h-0.5 flex-1 mx-4 bg-neutral-200 dark:bg-neutral-800 opacity-20"></div>
                              <span className="text-[9px] font-black text-neutral-400 uppercase">{isExpanded ? 'CONTRAER' : 'EXPANDIR'}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    const voucher = item as Voucher;
                    return (
                      <tr key={voucher.co_id_comprobante} className="border-b border-neutral-100 dark:border-neutral-800/40 hover:bg-[#71BF44]/5 transition-all group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-[#71BF44] mb-0.5 tracking-tighter">#{voucher.co_id_comprobante}</span>
                            <span className="font-extrabold text-neutral-900 dark:text-white text-xs group-hover:text-[#71BF44] transition-colors">{voucher.co_num_comprobante}</span>
                            <div className="flex items-center gap-1.5 mt-1.5">
                               <Building2 className="w-3 h-3 text-neutral-600" />
                               <span className="text-[9px] font-bold text-neutral-500">{voucher.co_establecimiento}-{voucher.co_punto_emision}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">{formatDate(voucher.co_hora_in)}</span>
                            <span className="text-[10px] font-black text-neutral-400 flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {new Date(voucher.co_hora_in).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                             <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 border border-blue-600/20">{voucher.ambiente}</span>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-600/10 text-amber-600 border border-amber-600/20">{PAIS_MAP[voucher.co_pais] || voucher.co_pais}</span>
                             </div>
                             <div className="text-[10px] font-black text-neutral-400 pl-0.5 tracking-[0.1em]">{voucher.co_nemonico}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-3">
                             <div>
                               <p className="text-[11px] text-neutral-500 font-medium line-clamp-1 group-hover:line-clamp-none transition-all" title={voucher.co_motivo}>
                                 {voucher.co_motivo || <span className="italic opacity-30">Sin reporte de error</span>}
                               </p>
                             </div>
                             <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                                <div className="space-y-0.5">
                                   <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Nro Reprocesos</span>
                                   <span className={`text-[10px] font-black block ${Number(voucher.co_numero_reprocesos) > 0 ? 'text-[#71BF44]' : 'text-neutral-600'}`}>
                                     {voucher.co_numero_reprocesos ?? 0}
                                   </span>
                                </div>
                                <div className="space-y-0.5">
                                   <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Ult. Intento</span>
                                   <span className="text-[10px] font-black text-neutral-500 block">
                                     {voucher.co_hora_reproceso ? formatDate(voucher.co_hora_reproceso) : '--/--'}
                                   </span>
                                </div>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <a 
                            href={`https://www5.mysatcomla.com/Facturacion/Comprobantes/DetalleReporte?idComprobante=${voucher.co_id_comprobante}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-xl text-[10px] font-black hover:bg-[#71BF44] dark:hover:bg-[#71BF44] dark:hover:text-white transition-all shadow-sm"
                          >
                            REPORTE
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedItems.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-neutral-500 font-black uppercase tracking-widest opacity-20 text-2xl">Sin Coincidencias</td></tr>
                  )}
                </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}
