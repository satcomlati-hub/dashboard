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
  Clock,
  Globe,
  Database,
  X
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
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

interface MergedActividad extends ActivityRecord {
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  Pais_ID: number;
  NombrePais: string;
}

export default function ActividadEmisoresPage() {
  const [data, setData] = useState<MergedActividad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      // Llamadas en paralelo a Catálogo y Actividad
      const [resCatalog, resActivity] = await Promise.all([
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_emisores_2026`),
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_actividad_emisor_2026`)
      ]);

      if (!resCatalog.ok || !resActivity.ok) throw new Error('Error al obtener datos de los servicios');
      
      const [jsonCatalog, jsonActivity]: [any, any] = await Promise.all([
        resCatalog.json(),
        resActivity.json()
      ]);

      // Procesar catálogo
      let catalog: CatalogEmisor[] = [];
      if (Array.isArray(jsonCatalog)) {
        jsonCatalog.forEach(item => {
          const parsed = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(parsed)) catalog = [...catalog, ...parsed];
          else if (parsed.IdEmisor) catalog.push(parsed);
        });
      }

      // Procesar actividad
      let activity: ActivityRecord[] = [];
      if (Array.isArray(jsonActivity)) {
        jsonActivity.forEach(item => {
          const parsed = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(parsed)) activity = [...activity, ...parsed];
          else if (parsed.ID_Emisor) activity.push(parsed);
        });
      }

      // Cruce en caliente (Merge)
      const merged: MergedActividad[] = catalog.map(c => {
        const act = activity.find(a => a.ID_Emisor === c.IdEmisor);
        return {
          ID_Emisor: c.IdEmisor,
          Nemonico: c.Nemonico,
          Identificacion: c.Identificacion,
          RazonSocial: c.RazonSocial,
          Pais_ID: c.IdPais,
          NombrePais: c.NombrePais || 'Ecuador', // Fallback si no viene el nombre
          Establecimiento: act?.Establecimiento || '001',
          PuntoEmision: act?.PuntoEmision || '---',
          EstadoReporte: act?.EstadoReporte || 'SIN ACTIVIDAD',
          TotalAutorizados: Number(act?.TotalAutorizados) || 0,
          TotalErrores: Number(act?.TotalErrores) || 0,
          UltimaFechaAutorizacion: act?.UltimaFechaAutorizacion || '',
          UltimaHoraIngreso: act?.UltimaHoraIngreso || '',
          UltimaFechaError: act?.UltimaFechaError || '',
          UltimaHoraError: act?.UltimaHoraError || '',
          CodigoTipoDocumento: act?.CodigoTipoDocumento || '',
          FechaSincronizacion: act?.FechaSincronizacion || ''
        };
      });
      
      setData(merged);
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
        item.Identificacion?.includes(searchTerm) ||
        item.NombrePais?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchEstado = filterEstado === 'Todos' || item.EstadoReporte === filterEstado;

      return matchSearch && matchEstado;
    });
  }, [data, searchTerm, filterEstado]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    const calculateStats = (filterFn: (d: MergedActividad) => boolean) => {
      const filtered = data.filter(filterFn);
      return {
        ok: filtered.reduce((acc, curr) => acc + (Number(curr.TotalAutorizados) || 0), 0),
        error: filtered.reduce((acc, curr) => acc + (Number(curr.TotalErrores) || 0), 0)
      };
    };

    return {
      hoy: calculateStats(d => !!d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion).toDateString() === todayStr),
      ayer: calculateStats(d => !!d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion).toDateString() === yesterdayStr),
      semana: calculateStats(d => !!d.UltimaFechaAutorizacion && new Date(d.UltimaFechaAutorizacion) >= startOfWeek),
      global: calculateStats(() => true),
      activos: data.filter(d => d.TotalAutorizados > 0).length,
      totalEmitters: data.length
    };
  }, [data]);

  const timelineData = useMemo(() => {
    const grouped: Record<string, { date: string, ok: number, error: number }> = {};
    
    data.forEach(item => {
      if (item.UltimaFechaAutorizacion) {
        const date = item.UltimaFechaAutorizacion.split(' ')[0];
        if (date && date !== '---') {
          if (!grouped[date]) grouped[date] = { date, ok: 0, error: 0 };
          grouped[date].ok += Number(item.TotalAutorizados) || 0;
        }
      }
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }, [data]);

  const KPICard = ({ title, stats, icon: Icon, period }: { title: string, stats: { ok: number, error: number }, icon: any, period: string }) => (
    <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group hover:border-[#71BF44] transition-all overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <Icon className="w-16 h-16" />
      </div>
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <span className="w-1 h-3 bg-[#71BF44] rounded-full" />
        {title}
      </p>
      
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Autorizados</span>
            <h3 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
              {stats.ok.toLocaleString()}
            </h3>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Errores</span>
             <h4 className="text-lg font-black text-red-500 tracking-tighter leading-none">
               {stats.error.toLocaleString()}
             </h4>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[8px] font-black text-neutral-500 uppercase tracking-widest">
          {period}
        </span>
        <div className="flex items-center gap-1 text-[#71BF44]">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-[9px] font-bold tracking-tight uppercase">Activo</span>
        </div>
      </div>
    </div>
  );

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
                  <span className="px-2 py-0.5 bg-[#71BF44]/10 text-[#71BF44] rounded text-[10px] font-bold tracking-widest uppercase">V5 Hybrid Engine</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-neutral-300" />
                <p className="text-xs text-neutral-500 font-medium tracking-tight">Monitoreo sincronizado de catálogo y actividad transaccional.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="bg-[#71BF44] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-xl shadow-[#71BF44]/20"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Datos
          </button>
        </div>
      </header>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm group hover:border-[#71BF44] transition-all overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <Building2 className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-1 h-3 bg-[#71BF44] rounded-full" />
            Emisores Totales
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Con Actividad</span>
                <h3 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
                  {kpis.activos}
                </h3>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Registrados</span>
                 <h4 className="text-lg font-black text-neutral-400 tracking-tighter leading-none">
                   {kpis.totalEmitters}
                 </h4>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[8px] font-black text-neutral-500 uppercase tracking-widest">
              Cruce Catálogo + Log
            </span>
            <div className="flex items-center gap-1 text-[#71BF44]">
              <Globe className="w-3 h-3" />
              <span className="text-[9px] font-bold">MULTIPAÍS</span>
            </div>
          </div>
        </div>
        <KPICard title="Hoy" stats={kpis.hoy} icon={Clock} period="Hoy" />
        <KPICard title="Ayer" stats={kpis.ayer} icon={Calendar} period="Últimas 24h" />
        <KPICard title="Esta Semana" stats={kpis.semana} icon={Activity} period="7 Días" />
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">Historial de Procesamiento</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#71BF44]" />
                <span className="text-[9px] font-bold text-neutral-400 uppercase">Autorizados</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71BF44" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#999', fontSize: 9, fontWeight: 700 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#999', fontSize: 9, fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="ok" stroke="#71BF44" strokeWidth={3} fillOpacity={1} fill="url(#colorOk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-[#71BF44]" />
          </div>
          <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Métricas de Conectividad</h4>
          <h2 className="text-5xl font-black text-neutral-900 dark:text-white tracking-tighter mb-4">{Math.round((kpis.activos / (kpis.totalEmitters || 1)) * 100)}%</h2>
          <p className="text-xs text-neutral-500 font-medium max-w-[200px]">
            Porcentaje de emisores con actividad transaccional reportada.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text"
              placeholder="Buscar por Nemónico, Razón Social o País..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Filtrado</span>
               <span className="text-xs font-bold text-neutral-900 dark:text-white">{filteredData.length} Registros</span>
             </div>
             <button className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:text-[#71BF44] transition-colors">
               <Filter className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <th className="px-8 py-5">País / Emisor</th>
                <th className="px-8 py-5">Sucursal / Punto</th>
                <th className="px-8 py-5 text-right">Autorizados (OK)</th>
                <th className="px-8 py-5 text-right">Errores (Fail)</th>
                <th className="px-8 py-5">Última Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredData.map((row, i) => (
                <tr key={i} className="group hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                         <Globe className={`w-5 h-5 ${row.TotalAutorizados > 0 ? 'text-[#71BF44]' : 'text-neutral-400 opacity-30'}`} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-neutral-900 dark:text-white uppercase line-clamp-1">{row.RazonSocial}</span>
                          <span className="text-[10px] font-bold text-[#71BF44]">{row.Nemonico}</span>
                        </div>
                        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em]">{row.NombrePais}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-neutral-600 dark:text-neutral-400">Estab. {row.Establecimiento}</span>
                      <span className="text-[11px] font-bold text-neutral-400">Caja: {row.PuntoEmision}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-xl font-black tracking-tighter ${row.TotalAutorizados > 0 ? 'text-[#71BF44]' : 'text-neutral-300'}`}>
                        {row.TotalAutorizados.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className={`w-3 h-3 ${row.TotalAutorizados > 0 ? 'text-[#71BF44]' : 'text-neutral-300'}`} />
                        <span className={`text-[9px] font-black uppercase ${row.TotalAutorizados > 0 ? 'text-[#71BF44]' : 'text-neutral-300'}`}>OK</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-xl font-black tracking-tighter ${row.TotalErrores > 0 ? 'text-red-500' : 'text-neutral-200'}`}>
                        {row.TotalErrores.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <XCircle className={`w-3 h-3 ${row.TotalErrores > 0 ? 'text-red-500' : 'text-neutral-200'}`} />
                        <span className={`text-[9px] font-black uppercase ${row.TotalErrores > 0 ? 'text-red-500' : 'text-neutral-200'}`}>FAIL</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {row.UltimaFechaAutorizacion ? row.UltimaFechaAutorizacion.split(' ')[0] : 'Sin actividad'}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-300" />
                        {row.UltimaHoraIngreso || '--:--'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
