'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MonitoreoChart from '@/components/MonitoreoChart';
import MonitoreoWidget from '@/components/MonitoreoWidget';
import { ChevronLeft, BarChart2, FilterX } from 'lucide-react';

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

  const handleChartPointClick = useCallback((date: string) => {
    setSelectedDateFilter(date);
    // Smooth scroll to table if needed
    const tableElement = document.getElementById('bitacora-table');
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const clearFilter = () => setSelectedDateFilter(null);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <header className="mb-10 py-6 border-b border-neutral-100 dark:border-neutral-800">
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
             {selectedDateFilter && (
                <button 
                  onClick={clearFilter}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 transition-all shadow-sm"
                >
                  <FilterX className="w-4 h-4" />
                  Limpiar Filtros
                </button>
             )}
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

      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em]">Visualización Temporal</h3>
            <span className="text-xs text-neutral-500 italic">Datos en tiempo real</span>
          </div>
          <MonitoreoChart data={data} onPointClick={handleChartPointClick} />
        </section>

        <section id="bitacora-table">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-[0.2em]">Detalles de Bitácora</h3>
            <div className="h-px bg-neutral-100 dark:bg-neutral-800 flex-1 mx-6 hidden lg:block"></div>
            <span className="text-xs text-neutral-500">Filtrado inteligente disponible en cabeceras</span>
          </div>
          <MonitoreoWidget 
            initialData={data} 
            initialLoading={loading} 
            initialError={error} 
            selectedDate={selectedDateFilter}
            onClearDateFilter={clearFilter}
          />
        </section>
      </div>
    </div>
  );
}
