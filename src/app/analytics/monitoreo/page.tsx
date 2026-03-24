'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MonitoreoChart from '@/components/MonitoreoChart';
import MonitoreoWidget from '@/components/MonitoreoWidget';
import { ChevronLeft, BarChart2 } from 'lucide-react';

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

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-medium transition-all group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Analytics
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#71BF44]/10 flex items-center justify-center">
            <BarChart2 className="w-6 h-6 text-[#71BF44]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Monitoreo de Eventos</h2>
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Análisis detallado de la bitácora técnica de Satcom.</p>
          </div>
        </div>
      </header>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Visualización Temporal</h3>
          <MonitoreoChart data={data} />
        </div>

        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Detalles de Bitácora</h3>
          <MonitoreoWidget initialData={data} initialLoading={loading} initialError={error} />
        </div>
      </div>
    </>
  );
}
