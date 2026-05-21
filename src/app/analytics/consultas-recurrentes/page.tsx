'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Server, 
  TrendingUp, 
  BarChart3, 
  Database,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface SPRecord {
  StoredProcedure: string;
  IdEmisor: number | null;
  Nemonico: string | null;
  PaisId: number | null;
  TotalEjecuciones: number;
  TiempoTotal_ms: number;
  TiempoPromedio_ms: number;
  TiempoMaximo_ms: number;
  TiempoMinimo_ms: number;
  TotalErrores: number;
  UltimaTrxAutorizada: string | null;
  HoraUltimaTrx: string | null;
}

export default function ConsultasRecurrentesPage() {
  const [data, setData] = useState<SPRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'mas-ejecutados' | 'mas-lentos' | 'alertas' | 'todos'>('mas-ejecutados');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_monitoreo_sps_2026`);
      if (!res.ok) throw new Error('Error al conectar con SARA');
      
      const json = await res.json();
      let records: SPRecord[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) {
            records = [...records, ...p];
          } else if (p && p.StoredProcedure !== undefined) {
            records.push(p);
          }
        });
      }
      
      // Normalización de tipos de datos
      const normalized = records.map(r => ({
        ...r,
        TotalEjecuciones: Number(r.TotalEjecuciones) || 0,
        TiempoTotal_ms: Number(r.TiempoTotal_ms) || 0,
        TiempoPromedio_ms: Number(r.TiempoPromedio_ms) || 0,
        TiempoMaximo_ms: Number(r.TiempoMaximo_ms) || 0,
        TiempoMinimo_ms: Number(r.TiempoMinimo_ms) || 0,
        TotalErrores: Number(r.TotalErrores) || 0,
        IdEmisor: r.IdEmisor !== null ? Number(r.IdEmisor) : null,
        PaisId: r.PaisId !== null ? Number(r.PaisId) : null
      }));
      
      setData(normalized);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido al obtener datos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs globales calculados
  const kpis = useMemo(() => {
    const totalConsultas = data.reduce((acc, r) => acc + r.TotalEjecuciones, 0);
    const tiempoTotalSec = data.reduce((acc, r) => acc + r.TiempoTotal_ms, 0) / 1000;
    const totalErrores = data.reduce((acc, r) => acc + r.TotalErrores, 0);
    const tasaError = totalConsultas > 0 ? (totalErrores / totalConsultas) * 100 : 0;
    
    // Alertas de emisores activos pero sin trx autorizadas en las últimas 2 semanas (14 días)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 14);
    
    const alertEmisores = data.filter(r => {
      // Debe tener emisor válido
      if (!r.IdEmisor || r.IdEmisor <= 0) return false;
      // Debe tener consultas registradas
      if (r.TotalEjecuciones === 0) return false;
      
      // Si nunca ha tenido transacciones (UltimaTrxAutorizada es NULL o vacío)
      if (!r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---') {
        return true;
      }
      
      // Si la última trx es más antigua que 14 días
      const trxDate = new Date(r.UltimaTrxAutorizada);
      return !isNaN(trxDate.getTime()) && trxDate < thresholdDate;
    });

    // Agrupar emisores únicos alertados
    const uniqueAlertEmisores = Array.from(new Set(alertEmisores.map(r => r.IdEmisor)));

    return {
      totalConsultas,
      tiempoTotalSec,
      tasaError,
      alertasCount: uniqueAlertEmisores.length,
      alertEmisoresList: alertEmisores
    };
  }, [data]);

  // Filtrado de registros para las tablas
  const filteredData = useMemo(() => {
    return data.filter(r => {
      const matchSearch = !searchTerm || 
        r.StoredProcedure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.IdEmisor && String(r.IdEmisor).includes(searchTerm));
      return matchSearch;
    });
  }, [data, searchTerm]);

  // 1. Top Más Ejecutados
  const topMasEjecutados = useMemo(() => {
    return [...filteredData].sort((a, b) => b.TotalEjecuciones - a.TotalEjecuciones).slice(0, 50);
  }, [filteredData]);

  // 2. Más Lentos (Tiempo Promedio)
  const topMasLentos = useMemo(() => {
    return [...filteredData].sort((a, b) => b.TiempoPromedio_ms - a.TiempoPromedio_ms).slice(0, 50);
  }, [filteredData]);

  // 3. Emisores con Actividad sin Trxs (Alertas)
  const emisoresConAlertas = useMemo(() => {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 14);

    return filteredData.filter(r => {
      if (!r.IdEmisor || r.IdEmisor <= 0) return false;
      if (r.TotalEjecuciones === 0) return false;
      
      if (!r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---') {
        return true;
      }
      
      const trxDate = new Date(r.UltimaTrxAutorizada);
      return !isNaN(trxDate.getTime()) && trxDate < thresholdDate;
    }).sort((a, b) => b.TotalEjecuciones - a.TotalEjecuciones);
  }, [filteredData]);

  // Top Emisores con Más Consultas (para una métrica secundaria)
  const topEmisoresConsultas = useMemo(() => {
    const map = new Map<number, { nemonico: string, count: number, error: number }>();
    data.forEach(r => {
      if (r.IdEmisor && r.IdEmisor > 0) {
        const current = map.get(r.IdEmisor) || { nemonico: r.Nemonico || `Emisor ${r.IdEmisor}`, count: 0, error: 0 };
        map.set(r.IdEmisor, {
          nemonico: r.Nemonico || current.nemonico,
          count: current.count + r.TotalEjecuciones,
          error: current.error + r.TotalErrores
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data]);

  // Datos para la gráfica: Top 7 SPs más lentos en promedio
  const chartData = useMemo(() => {
    // Agrupar por SP para consolidar en la gráfica
    const spMap = new Map<string, { sp: string, maxPromedio: number }>();
    data.forEach(r => {
      const current = spMap.get(r.StoredProcedure) || { sp: r.StoredProcedure, maxPromedio: 0 };
      if (r.TiempoPromedio_ms > current.maxPromedio) {
        spMap.set(r.StoredProcedure, {
          sp: r.StoredProcedure,
          maxPromedio: r.TiempoPromedio_ms
        });
      }
    });

    return Array.from(spMap.values())
      .sort((a, b) => b.maxPromedio - a.maxPromedio)
      .slice(0, 7)
      .map(item => ({
        name: item.sp.length > 30 ? item.sp.substring(0, 27) + '...' : item.sp,
        fullName: item.sp,
        'Promedio (ms)': item.maxPromedio
      }));
  }, [data]);

  // Helper para mapear IDs de País a Nombre
  const getPaisNombre = (paisId: number | null) => {
    if (!paisId) return 'N/A';
    const PAIS_MAP: Record<number, string> = {
      593: 'Ecuador',
      57: 'Colombia',
      506: 'Costa Rica',
      507: 'Panamá'
    };
    return PAIS_MAP[paisId] || `País ${paisId}`;
  };

  const getSubTabTitle = () => {
    switch (activeSubTab) {
      case 'mas-ejecutados': return 'Top SPs más Ejecutados';
      case 'mas-lentos': return 'Top SPs más Lentos (Tiempo Promedio)';
      case 'alertas': return 'Alertas de Desconexión Transaccional';
      default: return 'Todos los Procedimientos Registrados';
    }
  };

  const activeRecords = useMemo(() => {
    switch (activeSubTab) {
      case 'mas-ejecutados': return topMasEjecutados;
      case 'mas-lentos': return topMasLentos;
      case 'alertas': return emisoresConAlertas;
      default: return filteredData;
    }
  }, [activeSubTab, topMasEjecutados, topMasLentos, emisoresConAlertas, filteredData]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Cabecera */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl flex items-center justify-center ring-1 ring-[#71BF44]/20">
              <Clock className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase mb-1">
                Consultas Recurrentes <span className="text-[#71BF44] opacity-40 text-sm ml-1 font-black italic">BDD</span>
              </h1>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 bg-[#71BF44]/10 rounded-full border border-[#71BF44]/20">
                    <div className="w-1.5 h-1.5 bg-[#71BF44] rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Activo (Últimos 2 Días)</span>
                 </div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest opacity-60">
                   Monitoreo y rendimiento de Stored Procedures
                 </p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)} 
            disabled={refreshing || loading} 
            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Panel
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Error al cargar datos</h4>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest">Total Ejecuciones</span>
            <Activity className="w-4 h-4 text-[#71BF44]" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : kpis.totalConsultas.toLocaleString()}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">Consultas registradas</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Carga Total de BDD</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : `${kpis.tiempoTotalSec.toFixed(2)}s`}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">Tiempo CPU total consumido</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Tasa de Errores</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : `${kpis.tasaError.toFixed(2)}%`}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">Ejecuciones fallidas</p>
        </div>

        <div className={`border rounded-[32px] p-6 shadow-sm transition-all duration-300 ${kpis.alertasCount > 0 ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/50 animate-pulse' : 'bg-white dark:bg-[#111] border-neutral-100 dark:border-neutral-800'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[10px] font-black uppercase tracking-widest ${kpis.alertasCount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
              Alertas de Desconexión
            </span>
            <AlertCircle className={`w-4 h-4 ${kpis.alertasCount > 0 ? 'text-red-600' : 'text-neutral-400'}`} />
          </div>
          <h3 className={`text-4xl font-black tracking-tighter leading-none ${kpis.alertasCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-white'}`}>
            {loading ? '...' : kpis.alertasCount}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">Emisores consultando sin trx en +2 semanas</p>
        </div>
      </div>

      {/* Gráfica y Resumen Secundario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Gráfica Recharts */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#71BF44]" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Top 7 SPs más lentos (Promedio de Ejecución)</h3>
          </div>
          
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center text-neutral-400 text-xs font-black uppercase tracking-widest">
                Cargando gráfica...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-neutral-800/40" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#888888', fontSize: 10, fontWeight: 700 }} 
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#888888', fontSize: 10, fontWeight: 700 }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'milisegundos (ms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#888888', fontSize: 10, fontWeight: 700 } }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131313', borderColor: '#262626', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ color: '#71BF44', fontSize: 11 }}
                  />
                  <Bar dataKey="Promedio (ms)" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index < 3 ? '#f97316' : '#71BF44'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-neutral-400 text-xs font-bold">
                Sin datos suficientes para graficar
              </div>
            )}
          </div>
        </div>

        {/* Top Emisores por consultas */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Top 5 Emisores con más consultas</h3>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-400 text-xs font-black uppercase tracking-widest py-10">
                Cargando emisores...
              </div>
            ) : topEmisoresConsultas.length > 0 ? (
              topEmisoresConsultas.slice(0, 5).map((em, idx) => (
                <div key={em.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800/30 group hover:border-[#71BF44]/20 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-black text-neutral-500">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-neutral-800 dark:text-white uppercase leading-none mb-1">
                        {em.nemonico}
                      </h4>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                        ID Emisor: {em.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-neutral-950 dark:text-white block">
                      {em.count.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">
                      {em.error.toLocaleString()} Errores
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400 text-xs font-bold py-10">
                Sin datos de emisores
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buscador y Navegación de Tablas */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[40px] overflow-hidden shadow-xl">
        {/* Barra superior */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-neutral-50/20 dark:bg-neutral-800/10">
          {/* Sub tabs internas */}
          <div className="flex flex-wrap gap-2 border-b border-neutral-200/50 dark:border-neutral-800/50 lg:border-none pb-4 lg:pb-0">
            <button
              onClick={() => setActiveSubTab('mas-ejecutados')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'mas-ejecutados' ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300'}`}
            >
              Más Ejecutados
            </button>
            <button
              onClick={() => setActiveSubTab('mas-lentos')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'mas-lentos' ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300'}`}
            >
              Más Lentos (Promedio)
            </button>
            <button
              onClick={() => setActiveSubTab('alertas')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${activeSubTab === 'alertas' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' : 'bg-white dark:bg-neutral-800 text-red-500 border-red-100 dark:border-red-500/20 hover:border-red-300'}`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Sin Transacciones ({kpis.alertasCount})
            </button>
            <button
              onClick={() => setActiveSubTab('todos')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'todos' ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-800 text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300'}`}
            >
              Todos
            </button>
          </div>

          {/* Buscador */}
          <div className="relative min-w-[300px] lg:w-[400px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar por SP, nemónico o ID..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-12 pr-4 py-3.5 text-xs font-bold focus:ring-4 focus:ring-[#71BF44]/10 outline-none transition-all placeholder:text-neutral-300 placeholder:italic"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-20 text-neutral-400 text-xs font-black uppercase tracking-widest">
              Cargando registros...
            </div>
          ) : activeRecords.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.25em] border-b border-neutral-100 dark:border-neutral-800">
                  <th className="px-8 py-5">Procedimiento Almacenado (SP)</th>
                  <th className="px-6 py-5 text-center">Emisor / Nemónico</th>
                  <th className="px-6 py-5 text-center">País</th>
                  <th className="px-6 py-5 text-right">Ejecuciones</th>
                  <th className="px-6 py-5 text-right">Promedio (ms)</th>
                  <th className="px-6 py-5 text-right">Máximo (ms)</th>
                  <th className="px-6 py-5 text-right">Total Errores</th>
                  <th className="px-8 py-5">Última Trx Autorizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {activeRecords.map((r, idx) => {
                  const hasAlert = r.IdEmisor && r.IdEmisor > 0 && r.TotalEjecuciones > 0 && (
                    !r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---' ||
                    (new Date(r.UltimaTrxAutorizada) < new Date(new Date().setDate(new Date().getDate() - 14)))
                  );

                  return (
                    <tr 
                      key={idx} 
                      className={`group hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors ${hasAlert ? 'bg-red-500/[0.02]' : ''}`}
                    >
                      <td className="px-8 py-5 font-bold text-neutral-800 dark:text-neutral-200 text-xs break-all">
                        <span className="text-[10px] text-neutral-400 mr-2">#{idx + 1}</span>
                        {r.StoredProcedure}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {r.IdEmisor && r.IdEmisor > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-xs font-black text-neutral-800 dark:text-neutral-100 leading-none mb-1">
                              {r.Nemonico || 'S/N'}
                            </span>
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                              ID: {r.IdEmisor}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400 italic">Global / Sistema</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          {getPaisNombre(r.PaisId)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-neutral-900 dark:text-white">
                        {r.TotalEjecuciones.toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${r.TiempoPromedio_ms > 5000 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : r.TiempoPromedio_ms > 1000 ? 'bg-orange-400/10 text-orange-500 border border-orange-400/20' : 'text-neutral-700 dark:text-neutral-300'}`}>
                          {r.TiempoPromedio_ms.toLocaleString()} ms
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right text-xs font-bold text-neutral-500">
                        {r.TiempoMaximo_ms.toLocaleString()} ms
                      </td>
                      <td className="px-6 py-5 text-right font-bold">
                        <span className={r.TotalErrores > 0 ? 'text-red-500' : 'text-neutral-300 opacity-40'}>
                          {r.TotalErrores.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {hasAlert ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl max-w-fit">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter leading-none mb-0.5">
                                Activo sin Autorizaciones
                              </span>
                              <span className="text-[8px] text-red-400 font-bold leading-none">
                                Última: {r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' ? r.UltimaTrxAutorizada.split(' ')[0] : 'Ninguna'}
                              </span>
                            </div>
                          </div>
                        ) : r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-[#71BF44] shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 leading-none">
                                {r.UltimaTrxAutorizada.split(' ')[0]}
                              </span>
                              <span className="text-[9px] text-neutral-400 font-medium leading-none mt-0.5">
                                {r.UltimaTrxAutorizada.split(' ')[1] || ''}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400 italic">Sin registros trx</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-20 text-neutral-400 text-xs font-bold">
              No se encontraron procedimientos almacenados que coincidan con la búsqueda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
