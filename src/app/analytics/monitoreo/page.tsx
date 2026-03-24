'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MonitoreoChart from '@/components/MonitoreoChart';
import MonitoreoWidget from '@/components/MonitoreoWidget';
import { ChevronLeft, BarChart2, FilterX, Calendar, Globe, Activity, TrendingUp } from 'lucide-react';

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
  
  // Global Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/db/monitoreo');
        if (!res.ok) throw new Error('Error al obtener datos de monitoreo');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Countries for filter
  const countries = useMemo(() => {
    const set = new Set(data.map(d => d.pais));
    return ['Todos', ...Array.from(set)].sort();
  }, [data]);

  // Global Filtered Data
  const globalFilteredData = useMemo(() => {
    return data.filter(item => {
      // Country filter
      if (selectedCountry !== 'Todos' && item.pais !== selectedCountry) return false;
      
      // Date range filter
      // Helper to parse DD-MM-YYYY to YYYY-MM-DD for comparison
      const parseDate = (dStr: string) => {
        const parts = dStr.split(' ')[0].split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      };
      
      const itemDate = parseDate(item.fecha_ecuador);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      
      return true;
    });
  }, [data, selectedCountry, startDate, endDate]);

  // Summary Metrics
  const totalEvents = useMemo(() => {
    return globalFilteredData.reduce((acc, curr) => acc + (Number(curr.num_eventos) || 0), 0);
  }, [globalFilteredData]);

  const handleChartPointClick = useCallback((date: string) => {
    setSelectedDateFilter(date);
    const tableElement = document.getElementById('bitacora-table');
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const clearGlobalFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCountry('Todos');
    setSelectedDateFilter(null);
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
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Monitoreo de Eventos</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Bitácora técnica e indicadores de rendimiento de Satcom.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

      {/* Summary Metrics & Global Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
        <div className="lg:col-span-1 bg-[#71BF44]/5 border border-[#71BF44]/20 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#71BF44] flex items-center justify-center text-white shadow-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#71BF44] uppercase tracking-wider">Total Eventos</p>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white">{totalEvents.toLocaleString()}</h4>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-wrap items-end gap-6 shadow-sm">
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Fecha Inicio
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
              onChange={(e) => setEndDate(e.target.value)}
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
          <button 
            onClick={clearGlobalFilters}
            className="h-10 px-4 bg-neutral-50 dark:bg-[#1a1a1a] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center gap-2 transition-all hover:text-red-500 hover:border-red-200"
            title="Limpiar todos los filtros"
          >
            <FilterX className="w-4 h-4" />
          </button>
        </div>
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
