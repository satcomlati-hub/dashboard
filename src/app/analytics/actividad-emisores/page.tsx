'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Clock,
  Download,
  AlertCircle,
  X
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
  LineChart,
  Line
} from 'recharts';

interface ActividadEmisor {
  ID_Emisor: number;
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  Pais_ID: number;
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

export default function ActividadEmisoresPage() {
  const [data, setData] = useState<ActividadEmisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterNemonico, setFilterNemonico] = useState('Todos');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_actividad_emisor_2026`);

      if (!res.ok) throw new Error('Error al obtener datos de actividad');
      
      const json: any = await res.json();
      let flattened: ActividadEmisor[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data) {
            const parsed = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            if (Array.isArray(parsed)) flattened = [...flattened, ...parsed];
          } else {
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

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = !searchTerm || 
        item.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.RazonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Identificacion?.includes(searchTerm);
      
      const matchEstado = filterEstado === 'Todos' || item.EstadoReporte === filterEstado;
      const matchNemonico = filterNemonico === 'Todos' || item.Nemonico === filterNemonico;

      return matchSearch && matchEstado && matchNemonico;
    });
  }, [data, searchTerm, filterEstado, filterNemonico]);

  const nemonicosList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.Nemonico))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [data]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    return {
      totalGlobal: data.reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0),
      ayer: data
        .filter(d => d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion).toDateString() === yesterday.toDateString())
        .reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0),
      semana: data
        .filter(d => d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion) >= startOfWeek)
        .reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0),
      activos: new Set(data.filter(d => Number(d.TotalAutorizados) > 0).map(d => d.ID_Emisor)).size
    };
  }, [data]);

  const timelineData = useMemo(() => {
    const grouped: Record<string, { date: string, ok: number, error: number }> = {};
    
    data.forEach(item => {
      if (item.UltimaFechaAutorizacion) {
        const date = item.UltimaFechaAutorizacion.split(' ')[0];
        if (!grouped[date]) grouped[date] = { date, ok: 0, error: 0 };
        grouped[date].ok += Number(item.TotalAutorizados) || 0;
      }
      if (item.UltimaFechaError) {
        const date = item.UltimaFechaError.split(' ')[0];
        if (!grouped[date]) grouped[date] = { date, ok: 0, error: 0 };
        grouped[date].error += Number(item.TotalErrores) || 0;
      }
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }, [data]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter mb-1 uppercase">
                Actividad Emisores <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#71BF44]/10 text-[#71BF44] rounded text-[10px] font-bold tracking-widest uppercase">Monitoreo Realtime</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-neutral-300" />
                <p className="text-xs text-neutral-500 font-medium tracking-tight italic">Sincronización global de comprobantes y estados por punto de emisión.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-xl shadow-black/10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar Dashboard
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Building2 className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">Emisores Activos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-neutral-900 dark:text-white leading-none">{kpis.activos}</h3>
            <span className="text-xs font-bold text-[#71BF44]">Empresas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">Autorizados Ayer</p>
          <div className="flex items-center justify-between">
            <h3 className="text-4xl font-black text-neutral-900 dark:text-white leading-none">{kpis.ayer.toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-[#71BF44] bg-[#71BF44]/10 px-2 py-1 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-tighter">DIARIO</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">Última Semana</p>
          <div className="flex items-center justify-between">
            <h3 className="text-4xl font-black text-neutral-900 dark:text-white leading-none">{kpis.semana.toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-tighter">7 DÍAS</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group border-b-4 border-b-[#71BF44]">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">Total Global</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-[#71BF44] leading-none">{kpis.totalGlobal.toLocaleString()}</h3>
            <span className="text-xs font-bold text-neutral-400">Total</span>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm mb-10">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#71BF44] rounded-full" />
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">Línea de Tiempo de Procesamiento</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#71BF44]" />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Autorizados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Errores</span>
            </div>
          </div>
        </div>
        
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
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
              />
              <Line type="monotone" name="Autorizados" dataKey="ok" stroke="#71BF44" strokeWidth={4} dot={{ fill: '#71BF44', r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Errores" dataKey="error" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#ef4444', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-2xl">
        {/* Filters Bar */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-end justify-between gap-6 bg-neutral-50/30">
          <div className="flex flex-wrap items-end gap-6 flex-1">
            <div className="flex flex-col gap-2 min-w-[300px] flex-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Búsqueda Avanzada</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text"
                  placeholder="Nemónico, Razón Social o Identificación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-48">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Filtro Empresa</label>
              <select 
                value={filterNemonico}
                onChange={(e) => setFilterNemonico(e.target.value)}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
              >
                {nemonicosList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2 w-48">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Estado Reporte</label>
              <select 
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="ACTIVO">Activos</option>
                <option value="INACTIVO">Inactivos</option>
                <option value="SIN ACTIVIDAD">Sin Actividad</option>
              </select>
            </div>
          </div>

          <button className="h-12 bg-neutral-900 dark:bg-white dark:text-black text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-black/10">
            <Download className="w-4 h-4" />
            Descargar XLS
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/30">
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Emisor / Identificación</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Punto de Emisión</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-center">Autorizados</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-center">Errores</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Último Movimiento</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredData.map((row, i) => (
                <tr key={`${row.ID_Emisor}-${row.PuntoEmision}-${i}`} className="group hover:bg-[#71BF44]/[0.02] transition-all">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-neutral-900 dark:text-white uppercase line-clamp-1">{row.RazonSocial}</span>
                        <span className="px-1.5 py-0.5 bg-[#71BF44]/10 text-[#71BF44] rounded text-[8px] font-black">{row.Nemonico}</span>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400 tracking-widest">{row.Identificacion}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                        <Building2 className="w-3 h-3 text-neutral-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-neutral-700 dark:text-neutral-300">Est: {row.Establecimiento}</span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Punto: {row.PuntoEmision}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-lg font-black text-[#71BF44] tracking-tighter">
                      {Number(row.TotalAutorizados).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`text-lg font-black tracking-tighter ${Number(row.TotalErrores) > 0 ? 'text-red-500' : 'text-neutral-300'}`}>
                      {Number(row.TotalErrores).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#71BF44]" />
                        {row.UltimaFechaAutorizacion ? row.UltimaFechaAutorizacion.split(' ')[0] : '---'}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {row.UltimaHoraIngreso ? row.UltimaHoraIngreso : '---'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                      row.EstadoReporte === 'ACTIVO' ? 'bg-[#71BF44]/10 border-[#71BF44]/30 text-[#71BF44]' :
                      row.EstadoReporte === 'INACTIVO' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                      'bg-red-500/10 border-red-500/30 text-red-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        row.EstadoReporte === 'ACTIVO' ? 'bg-[#71BF44]' :
                        row.EstadoReporte === 'INACTIVO' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`} />
                      {row.EstadoReporte}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="py-40 flex flex-col items-center justify-center gap-6 opacity-20">
              <Search className="w-20 h-20" />
              <p className="text-3xl font-black uppercase tracking-[0.5em]">Sin Registros</p>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-20 pt-10 border-t border-neutral-100 dark:border-neutral-800 text-center">
        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
          Satcom Dashboard © 2026 • Analítica de Datos en Tiempo Real
        </p>
      </footer>
    </div>
  );
}
