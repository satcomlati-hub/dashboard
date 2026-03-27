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
  BarChart3
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
  const [countdown, setCountdown] = useState(1800); // 30 minutes in seconds

  // Filters state
  const [filters, setFilters] = useState({
    ambiente: '',
    co_pais: '',
    co_nemonico: '',
    co_codigo_tipo_documento: '',
    co_establecimiento: '',
    co_punto_emision: '',
    search: '',
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch('https://sara.mysatcomla.com/webhook/MonitoreoNoAutorizados');
      if (!res.ok) throw new Error('Error al obtener datos de comprobantes');
      
      const json: any = await res.json();
      
      // Handle the nested structure: [{ data: "[...]" }, { data: "[...]" }]
      let flattenedVouchers: Voucher[] = [];
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data && typeof item.data === 'string') {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) {
                flattenedVouchers = [...flattenedVouchers, ...parsed];
              }
            } catch (e) {
              console.error('Error parsing voucher data string:', e);
            }
          } else if (item.ambiente) {
            // Already a voucher object (fallback for previous assumption)
            flattenedVouchers.push(item);
          }
        });
      }
      
      setData(flattenedVouchers);
      setError(null);
      setCountdown(1800); // Reset to 30 minutes
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

  // Auto-refresh countdown
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
    return data.filter(item => {
      const matchAmbiente = !filters.ambiente || item.ambiente === filters.ambiente;
      const matchPais = !filters.co_pais || item.co_pais.toString() === filters.co_pais;
      const matchNemonico = !filters.co_nemonico || item.co_nemonico.toLowerCase().includes(filters.co_nemonico.toLowerCase());
      const matchTipo = !filters.co_codigo_tipo_documento || item.co_codigo_tipo_documento === filters.co_codigo_tipo_documento;
      const matchEstablecimiento = !filters.co_establecimiento || item.co_establecimiento.includes(filters.co_establecimiento);
      const matchPunto = !filters.co_punto_emision || item.co_punto_emision.includes(filters.co_punto_emision);
      const matchSearch = !filters.search || 
        item.co_num_comprobante.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.co_motivo.toLowerCase().includes(filters.search.toLowerCase());

      return matchAmbiente && matchPais && matchNemonico && matchTipo && matchEstablecimiento && matchPunto && matchSearch;
    });
  }, [data, filters]);

  // Options for filters
  const filterOptions = useMemo(() => {
    return {
      ambientes: Array.from(new Set(data.map(d => d.ambiente))).sort(),
      paises: Array.from(new Set(data.map(d => d.co_pais))).sort((a, b) => a - b),
      tipos: Array.from(new Set(data.map(d => d.co_codigo_tipo_documento))).sort(),
    };
  }, [data]);

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
    const byAmbiente = data.reduce((acc, d) => {
      acc[d.ambiente] = (acc[d.ambiente] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPais = data.reduce((acc, d) => {
      acc[d.co_pais] = (acc[d.co_pais] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return { byAmbiente, byPais };
  }, [data]);

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
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Monitoreo y análisis de documentos que fallaron la autorización.</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Total</span>
          </div>
          <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{data.length.toLocaleString()}</h4>
          <p className="text-xs text-neutral-500 mt-1">Vouchers detectados</p>
        </div>

        {Object.entries(stats.byAmbiente).slice(0, 3).map(([amb, count]) => (
          <div key={amb} className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{amb}</span>
            </div>
            <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{count.toLocaleString()}</h4>
            <p className="text-xs text-neutral-500 mt-1">Ambiente {amb}</p>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <Filter className="w-4 h-4 text-[#71BF44]" />
          <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Filtros</span>
          {Object.values(filters).some(v => v !== '') && (
            <button 
              onClick={() => setFilters({ ambiente: '', co_pais: '', co_nemonico: '', co_codigo_tipo_documento: '', co_establecimiento: '', co_punto_emision: '', search: '' })}
              className="ml-auto text-[10px] text-red-500 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Ambiente</label>
            <select 
              value={filters.ambiente}
              onChange={(e) => setFilters(f => ({ ...f, ambiente: e.target.value }))}
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
              onChange={(e) => setFilters(f => ({ ...f, co_pais: e.target.value }))}
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
              onChange={(e) => setFilters(f => ({ ...f, co_nemonico: e.target.value }))}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">Tipo Doc</label>
            <select 
              value={filters.co_codigo_tipo_documento}
              onChange={(e) => setFilters(f => ({ ...f, co_codigo_tipo_documento: e.target.value }))}
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
              onChange={(e) => setFilters(f => ({ ...f, co_establecimiento: e.target.value }))}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase">PTO. EMISION</label>
            <input 
              type="text"
              placeholder="001"
              value={filters.co_punto_emision}
              onChange={(e) => setFilters(f => ({ ...f, co_punto_emision: e.target.value }))}
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
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-[#71BF44] outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-[#71BF44]/30 border-t-[#71BF44] rounded-full animate-spin" />
            <p className="text-sm text-neutral-500 font-medium">Consultando comprobantes no autorizados…</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Error al Cargar Datos</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{error}</p>
          <button onClick={() => fetchData()} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">Reintentar</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">Mostrando {filteredData.length} resultados</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-[#0e0e0e] border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider whitespace-nowrap">ID / Comprobante</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider whitespace-nowrap">Emisión</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider whitespace-nowrap">Amb/País/Nem.</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider whitespace-nowrap">E/P</th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Motivo</th>
                  <th className="text-center px-6 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium italic">
                      No se encontraron resultados con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, i) => (
                    <tr key={item.co_id_comprobante} className={`border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors ${i === filteredData.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-medium text-neutral-400 flex items-center gap-1 mb-1">
                            <Hash className="w-2.5 h-2.5" /> {item.co_id_comprobante}
                          </span>
                          <span className="font-bold text-neutral-900 dark:text-white truncate max-w-[200px]" title={item.co_num_comprobante}>
                            {item.co_num_comprobante}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {formatDate(item.co_fecha_emision)}
                          </span>
                          <span className="text-[10px] text-neutral-400 mt-0.5 ml-5">
                            Ingreso: {new Date(item.co_hora_in).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">{item.ambiente}</span>
                             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center gap-1">
                               <Globe className="w-2.5 h-2.5" /> {PAIS_MAP[item.co_pais] || item.co_pais}
                             </span>
                          </div>
                          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 pl-0.5 tracking-tight font-mono">{item.co_nemonico}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                             <Building2 className="w-3 h-3" /> {item.co_establecimiento}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                             <MapPin className="w-3 h-3" /> {item.co_punto_emision}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[400px]">
                        <p className="text-xs text-neutral-500 line-clamp-2" title={item.co_motivo}>
                          {item.co_motivo || <span className="italic opacity-50">Sin motivo reportado</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a 
                          href={`https://www5.mysatcomla.com/Facturacion/Comprobantes/DetalleReporte?idComprobante=${item.co_id_comprobante}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#71BF44]/10 text-[#71BF44] rounded-lg text-xs font-bold hover:bg-[#71BF44] hover:text-white transition-all group"
                        >
                          Detalle
                          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
