'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import MonitoreoChart from '@/components/MonitoreoChart';
import MonitoreoWidget from '@/components/MonitoreoWidget';
import { ChevronLeft, BarChart2, FilterX, Calendar, Globe, Activity, TrendingUp, Clock, CalendarDays, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

const POLL_INTERVAL = 60_000; // 60 segundos

interface Evento {
  fecha_ecuador: string;
  key: string;
  num_eventos: number | string;
  pais: string;
  detalle_evento: string;
}

export default function MonitoreoSubpage() {
  const [data, setData] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Global Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Active counter for highlight
  const [activeCounter, setActiveCounter] = useState<'total' | 'mes' | 'mesAnterior' | 'semana' | 'hoy' | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/db/monitoreo');
      if (!res.ok) throw new Error('Error al obtener datos de monitoreo');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []);
      setLastUpdated(new Date());
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
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Countries for filter
  const countries = useMemo(() => {
    const set = new Set(data.map(d => d.pais));
    return ['Todos', ...Array.from(set)].sort();
  }, [data]);

  // Global Filtered Data
  const globalFilteredData = useMemo(() => {
    return data.filter(item => {
      if (selectedCountry !== 'Todos' && item.pais !== selectedCountry) return false;

      const parseToYYYYMMDD = (dStr: string) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
        
        // Fallback for DD-MM-YYYY format
        const parts = dStr.split(' ')[0].split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`; // YYYY-MM-DD
          return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY -> YYYY-MM-DD
        }
        return '';
      };

      const itemDate = parseToYYYYMMDD(item.fecha_ecuador);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;

      return true;
    });
  }, [data, selectedCountry, startDate, endDate]);

  // Summary Metrics — always computed from ALL raw data so counters always show global totals
  const metricas = useMemo(() => {
    const parseToDate = (dStr: string) => {
      if (!dStr) return new Date(0);
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) return d;

      // Fallback for DD-MM-YYYY HH:mm:ss format
      const parts = dStr.split(' ')[0].split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
      return new Date(0);
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayOfWeek = today.getDay() || 7;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    let total = 0, mes = 0, mesAnterior = 0, semana = 0, hoy = 0;

    data.forEach(item => {
      const val = Number(item.num_eventos) || 0;
      total += val;

      const itemDate = parseToDate(item.fecha_ecuador);
      itemDate.setHours(0, 0, 0, 0);

      const itemTime = itemDate.getTime();
      if (itemTime === today.getTime()) hoy += val;
      if (itemTime >= startOfWeek.getTime()) semana += val;
      if (itemTime >= startOfMonth.getTime()) mes += val;
      if (itemTime >= startOfPreviousMonth.getTime() && itemTime < startOfMonth.getTime()) mesAnterior += val;
    });

    return { total, mes, mesAnterior, semana, hoy };
  }, [data]);

  // Helper: format Date as YYYY-MM-DD
  const toDateString = (d: Date) => d.toISOString().split('T')[0];

  // Counter click: sets the date filter range matching the period
  const handleCounterClick = useCallback((counter: 'total' | 'mes' | 'mesAnterior' | 'semana' | 'hoy') => {
    // Toggle off if same counter clicked again
    if (activeCounter === counter) {
      setActiveCounter(null);
      setStartDate('');
      setEndDate('');
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (counter === 'total') {
      setStartDate('');
      setEndDate('');
      setActiveCounter('total');
      setSelectedDateFilter(null);
      setTimeout(() => {
        document.getElementById('bitacora-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }

    let start: Date;
    let end: Date = today;

    if (counter === 'hoy') {
      start = today;
    } else if (counter === 'semana') {
      const dayOfWeek = today.getDay() || 7;
      start = new Date(today);
      start.setDate(today.getDate() - dayOfWeek + 1);
    } else if (counter === 'mesAnterior') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      // mes
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setStartDate(toDateString(start));
    setEndDate(toDateString(end));
    setActiveCounter(counter);
    setSelectedDateFilter(null);

    setTimeout(() => {
      document.getElementById('bitacora-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [activeCounter]);

  const handleChartPointClick = useCallback((date: string) => {
    setSelectedDateFilter(date);
    document.getElementById('bitacora-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const clearGlobalFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCountry('Todos');
    setSelectedDateFilter(null);
    setActiveCounter(null);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
              <BarChart2 className="w-7 h-7 text-[#71BF44]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Intermitencias SRI-EC</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Bitácora técnica e indicadores de rendimiento de Satcom.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-neutral-400 hidden sm:block">
                Actualizado: {formatDate(lastUpdated, true)}
              </span>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Actualizar ahora"
            >
              <RefreshCw className={`w-4 h-4 text-neutral-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] text-xs font-bold text-[#71BF44] border border-[#71BF44]/30 rounded-lg shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#71BF44] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#71BF44]"></span>
              </span>
              LIVE
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          <span className="mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="font-semibold">Error al cargar los datos</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
          <button onClick={() => fetchData(true)} className="ml-auto shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Summary Metrics — clickable to filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">

        {/* Total Eventos */}
        <button
          onClick={() => handleCounterClick('total')}
          title="Ver todos los eventos"
          className={`bg-[#71BF44]/5 border rounded-2xl p-6 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer text-left w-full group ${
            activeCounter === 'total'
              ? 'border-[#71BF44] ring-2 ring-[#71BF44]/40 shadow-lg'
              : 'border-[#71BF44]/20 hover:border-[#71BF44]/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#71BF44] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#71BF44] uppercase tracking-wider">Total Eventos</p>
            {loading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{metricas.total.toLocaleString()}</h4>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">Clic para ver todos</p>
          </div>
        </button>

        {/* Este Mes */}
        <button
          onClick={() => handleCounterClick('mes')}
          title="Filtrar por este mes"
          className={`bg-blue-500/5 border rounded-2xl p-6 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer text-left w-full group ${
            activeCounter === 'mes'
              ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
              : 'border-blue-500/20 hover:border-blue-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Este Mes</p>
            {loading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{metricas.mes.toLocaleString()}</h4>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">Clic para filtrar</p>
          </div>
        </button>

        {/* Mes Anterior */}
        <button
          onClick={() => handleCounterClick('mesAnterior')}
          title="Filtrar por mes anterior"
          className={`bg-indigo-500/5 border rounded-2xl p-6 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer text-left w-full group ${
            activeCounter === 'mesAnterior'
              ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
              : 'border-indigo-500/20 hover:border-indigo-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Mes Anterior</p>
            {loading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{metricas.mesAnterior.toLocaleString()}</h4>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">Clic para filtrar</p>
          </div>
        </button>

        {/* Esta Semana */}
        <button
          onClick={() => handleCounterClick('semana')}
          title="Filtrar por esta semana"
          className={`bg-purple-500/5 border rounded-2xl p-6 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer text-left w-full group ${
            activeCounter === 'semana'
              ? 'border-purple-500 ring-2 ring-purple-500/40 shadow-lg'
              : 'border-purple-500/20 hover:border-purple-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Esta Semana</p>
            {loading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{metricas.semana.toLocaleString()}</h4>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">Clic para filtrar</p>
          </div>
        </button>

        {/* Hoy */}
        <button
          onClick={() => handleCounterClick('hoy')}
          title="Filtrar por hoy"
          className={`bg-amber-500/5 border rounded-2xl p-6 flex items-center gap-4 transition-all hover:-translate-y-1 cursor-pointer text-left w-full group ${
            activeCounter === 'hoy'
              ? 'border-amber-500 ring-2 ring-amber-500/40 shadow-lg'
              : 'border-amber-500/20 hover:border-amber-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Hoy</p>
            {loading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{metricas.hoy.toLocaleString()}</h4>
            )}
            <p className="text-[10px] text-neutral-400 mt-0.5">Clic para filtrar</p>
          </div>
        </button>

      </div>

      {/* Global Filters */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-wrap items-end gap-6 shadow-sm mb-10 w-full">
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Fecha Inicio
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setActiveCounter(null); }}
            className="w-full bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all font-medium"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Fecha Fin
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setActiveCounter(null); }}
            className="w-full bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all font-medium"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-1.5">
            <Globe className="w-3 h-3" /> País
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all font-medium appearance-none cursor-pointer"
          >
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Active counter badge */}
        {activeCounter && activeCounter !== 'total' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
            {activeCounter === 'mes' && <span>📅 Este Mes activo</span>}
            {activeCounter === 'mesAnterior' && <span>📅 Mes Anterior activo</span>}
            {activeCounter === 'semana' && <span>📆 Esta Semana activa</span>}
            {activeCounter === 'hoy' && <span>🕐 Hoy activo</span>}
          </div>
        )}

        <button
          onClick={clearGlobalFilters}
          className="h-10 px-4 bg-neutral-50 dark:bg-[#1a1a1a] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center gap-2 transition-all hover:text-red-500 hover:border-red-200"
          title="Limpiar todos los filtros"
        >
          <FilterX className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em]">Visualización Temporal</h3>
            <span className="text-xs text-neutral-500 italic">Clic en una barra para filtrar a detalle</span>
          </div>
          <MonitoreoChart
            data={globalFilteredData}
            onPointClick={handleChartPointClick}
            selectedDate={selectedDateFilter}
          />
        </section>

        <section id="bitacora-table">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em]">Detalles de Bitácora</h3>
            <div className="h-px bg-neutral-100 dark:bg-neutral-800 flex-1 mx-6 hidden lg:block"></div>
            <span className="text-xs text-neutral-500">Resultados: {globalFilteredData.length}</span>
          </div>
          <MonitoreoWidget
            initialData={globalFilteredData}
            initialLoading={loading}
            initialError={error}
            selectedDate={selectedDateFilter}
            onClearDateFilter={() => setSelectedDateFilter(null)}
          />
        </section>
      </div>
    </div>
  );
}
