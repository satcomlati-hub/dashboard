'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Calendar, 
  X,
  Table as TableIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  FileText,
  TrendingUp,
  Filter,
  CheckCircle2,
  XCircle,
  Hash,
  Download,
  Building2,
  Percent
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

interface IvaRecord {
  Nemonico: string;
  Emisor: string;
  DescripcionTipoDocumento: string;
  Autorizado: number | string;
  CodigoImpuesto: number | string;
  CodigoPorcentaje: number | string;
  Porcentaje: string;
  CantidadComprobantes: number | string;
  FechaReporte: string;
}

const COLORS = [
  '#71BF44', // Satcom Green (Autorizados)
  '#ef4444', // Red (No Autorizados)
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export default function TableroIvaPage() {
  const [data, setData] = useState<IvaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [filterNemonico, setFilterNemonico] = useState('Todos');
  const [filterPorcentaje, setFilterPorcentaje] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<keyof IvaRecord>('FechaReporte');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_iva_ec_2026`);

      if (!res.ok) throw new Error('Error al obtener datos del reporte');
      
      const json: any = await res.json();
      let flattened: IvaRecord[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data) {
            const parsed = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            if (Array.isArray(parsed)) flattened = [...flattened, ...parsed];
          } else if (item.Nemonico || item.FechaReporte) {
            flattened.push(item);
          }
        });
      }
      
      setData(flattened);
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

  const nemonicosList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.Nemonico))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [data]);

  const porcentajesList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.Porcentaje))).filter(Boolean).sort((a, b) => parseFloat(a) - parseFloat(b));
    return ['Todos', ...list];
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      const matchNemonico = filterNemonico === 'Todos' || item.Nemonico === filterNemonico;
      const matchPorcentaje = filterPorcentaje === 'Todos' || item.Porcentaje === filterPorcentaje;
      const matchSearch = !searchTerm || 
        item.Emisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.DescripcionTipoDocumento?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNemonico && matchPorcentaje && matchSearch;
    });

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'CantidadComprobantes') {
        valA = Number(valA);
        valB = Number(valB);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filterNemonico, filterPorcentaje, searchTerm, sortField, sortOrder]);

  const chartData = useMemo(() => {
    // Si no hay filtro de nemónico, mostramos el TOP 10 de empresas por cantidad
    if (filterNemonico === 'Todos') {
      const companySummary: Record<string, { emisor: string, autorizados: number, no_autorizados: number }> = {};
      
      data.forEach(item => {
        const key = item.Nemonico;
        if (!companySummary[key]) {
          companySummary[key] = { emisor: item.Emisor, autorizados: 0, no_autorizados: 0 };
        }
        const cant = Number(item.CantidadComprobantes) || 0;
        if (Number(item.Autorizado) === 1) {
          companySummary[key].autorizados += cant;
        } else {
          companySummary[key].no_autorizados += cant;
        }
      });

      return Object.entries(companySummary)
        .map(([nemonico, stats]) => ({
          name: nemonico,
          emisor: stats.emisor,
          autorizados: stats.autorizados,
          no_autorizados: stats.no_autorizados,
          total: stats.autorizados + stats.no_autorizados
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    } else {
      // Si hay filtro de nemónico, mostramos la tendencia por fecha para esa empresa
      const dateSummary: Record<string, { autorizados: number, no_autorizados: number }> = {};
      
      data.filter(d => d.Nemonico === filterNemonico).forEach(item => {
        const dateKey = item.FechaReporte;
        if (!dateSummary[dateKey]) {
          dateSummary[dateKey] = { autorizados: 0, no_autorizados: 0 };
        }
        const cant = Number(item.CantidadComprobantes) || 0;
        if (Number(item.Autorizado) === 1) {
          dateSummary[dateKey].autorizados += cant;
        } else {
          dateSummary[dateKey].no_autorizados += cant;
        }
      });

      return Object.entries(dateSummary)
        .map(([date, stats]) => ({
          name: date,
          autorizados: stats.autorizados,
          no_autorizados: stats.no_autorizados
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [data, filterNemonico]);

  const toggleSort = (field: keyof IvaRecord) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#0c0c0c] border border-[#71BF44]/20 rounded-3xl shadow-2xl">
            <RefreshCw className="w-12 h-12 text-[#71BF44] animate-spin" />
            <span className="text-[#71BF44] font-black uppercase tracking-widest text-xs">Cargando Reporte IVA</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Regresar a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter mb-1">
                Tablero IVA EC <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#71BF44]/10 text-[#71BF44] rounded text-[10px] font-bold tracking-widest">AMBIENTE V5</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-neutral-300" />
                <p className="text-xs text-neutral-500 font-medium tracking-tight">Análisis de comprobantes autorizados y no autorizados por empresa e impuesto.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Empresas</p>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white leading-none">{nemonicosList.length - 1}</h3>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Comprobantes Totales</p>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white leading-none">
            {data.reduce((acc, curr) => acc + (Number(curr.CantidadComprobantes) || 0), 0).toLocaleString()}
          </h3>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest mb-1">Autorizados</p>
          <h3 className="text-3xl font-black text-[#71BF44] leading-none">
            {data.filter(d => Number(d.Autorizado) === 1).reduce((acc, curr) => acc + (Number(curr.CantidadComprobantes) || 0), 0).toLocaleString()}
          </h3>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">No Autorizados</p>
          <h3 className="text-3xl font-black text-red-500 leading-none">
            {data.filter(d => Number(d.Autorizado) !== 1).reduce((acc, curr) => acc + (Number(curr.CantidadComprobantes) || 0), 0).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm mb-10">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#71BF44]" />
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
              {filterNemonico === 'Todos' ? 'Top 10 Empresas: Autorizados vs No Autorizados' : `Tendencia: ${filterNemonico}`}
            </h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#71BF44]" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Autorizados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">No Autorizados</span>
            </div>
          </div>
        </div>
        
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#999', fontSize: 10, fontWeight: 700 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#999', fontSize: 10, fontWeight: 700 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px', padding: '12px' }}
                itemStyle={{ fontWeight: 'bold' }}
                formatter={(value: any) => value.toLocaleString()}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Bar name="Autorizados" dataKey="autorizados" fill="#71BF44" radius={[4, 4, 0, 0]} />
              <Bar name="No Autorizados" dataKey="no_autorizados" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Area */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
        {/* Table Filters */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6 bg-neutral-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-6 flex-1 min-w-[500px]">
            <div className="flex flex-col gap-2 w-48">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Filtrar Empresa</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select 
                  value={filterNemonico}
                  onChange={(e) => setFilterNemonico(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all appearance-none cursor-pointer"
                >
                  {nemonicosList.map(nem => <option key={nem} value={nem}>{nem}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-32">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">IVA %</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select 
                  value={filterPorcentaje}
                  onChange={(e) => setFilterPorcentaje(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all appearance-none cursor-pointer"
                >
                  {porcentajesList.map(p => <option key={p} value={p}>{p === 'Todos' ? 'Todos' : `${p}%`}</option>)}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Buscar en Emisor / Documento</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text"
                  placeholder="Ej: MERAMEXAIR, FACTURA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              const csv = filteredData.map(d => Object.values(d).join(';')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('href', url);
              a.setAttribute('download', `ReporteIVA_Detallado_${new Date().getTime()}.csv`);
              a.click();
            }}
            className="h-12 bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleSort('Nemonico')}>
                  Empresa {sortField === 'Nemonico' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5">Tipo Documento / Impuesto</th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleSort('CantidadComprobantes')}>
                  Cantidad {sortField === 'CantidadComprobantes' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5">Estado</th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleSort('FechaReporte')}>
                  Fecha {sortField === 'FechaReporte' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredData.map((row, i) => {
                const isAutorizado = Number(row.Autorizado) === 1;
                return (
                  <tr key={i} className="group hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-all">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tighter">{row.Emisor}</span>
                        <span className="text-[10px] font-bold text-[#71BF44] uppercase tracking-widest">{row.Nemonico}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md text-[9px] font-black text-neutral-500 uppercase">
                          {row.DescripcionTipoDocumento}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-black text-blue-500">
                          <Percent className="w-3 h-3" />
                          {row.Porcentaje}%
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tighter">
                        {Number(row.CantidadComprobantes).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isAutorizado ? 'bg-[#71BF44]' : 'bg-red-500 shadow-lg shadow-red-500/20'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isAutorizado ? 'text-[#71BF44]' : 'text-red-500'}`}>
                          {isAutorizado ? 'Autorizado' : 'No Autorizado'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-neutral-400">
                      {row.FechaReporte}
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <TableIcon className="w-16 h-16" />
                      <p className="text-2xl font-black uppercase tracking-[0.4em]">Sin Datos</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 flex flex-col items-center gap-6 py-10 border-t border-neutral-100 dark:border-neutral-800">
         <div className="flex items-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default">
            <div className="w-10 h-10 rounded-xl bg-[#71BF44] flex items-center justify-center shadow-lg shadow-[#71BF44]/20">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-neutral-900 dark:text-white leading-none">Satcom Engine</span>
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">IVA Analysis Module v1.0</span>
            </div>
         </div>
      </footer>
    </div>
  );
}
