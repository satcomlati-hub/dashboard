'use client';

import { useState, useEffect } from 'react';
import { Activity, Clock, Globe, Key, FileText, Loader2, AlertCircle } from 'lucide-react';

interface Evento {
  fecha_ecuador: string;
  key: string;
  num_eventos: number | string;
  pais: string;
  detalle_evento: string;
}

interface MonitoreoWidgetProps {
  initialData?: Evento[];
  initialLoading?: boolean;
  initialError?: string | null;
}

export default function MonitoreoWidget({ initialData, initialLoading = false, initialError = null }: MonitoreoWidgetProps) {
  const [data, setData] = useState<Evento[]>(initialData || []);
  const [loading, setLoading] = useState(initialData ? false : initialLoading);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    // Only fetch if data was not provided
    if (initialData) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/db/monitoreo');
        if (!res.ok) throw new Error('Error al obtener datos');
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
  }, [initialData]);

  // If initialData is provided via props, keep it in sync
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#131313] z-10">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#71BF44]" />
          Bitácora de Eventos
        </h3>
        <span className="text-xs font-medium bg-[#71BF44]/10 text-[#71BF44] dark:bg-[#71BF44]/20 px-2.5 py-1 rounded-full">
          {data.length} {data.length === 1 ? 'Evento' : 'Eventos'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-0 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 absolute inset-0">
            <Loader2 className="w-8 h-8 animate-spin text-[#71BF44]" />
            <p className="text-sm font-medium">Cargando eventos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 gap-3 p-6 text-center absolute inset-0">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 absolute inset-0">
            <Activity className="w-8 h-8 opacity-20" />
            <p className="text-sm font-medium">No hay eventos registrados</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-[#1a1a1a] shadow-sm z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Fecha (EC)</div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5"/> Key</div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase text-right border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 justify-end"><Activity className="w-3.5 h-3.5"/> Eventos</div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5"/> País</div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase w-full border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Detalle</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                  <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{row.fecha_ecuador}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.key}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 text-right">{row.num_eventos}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{row.pais}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-sm truncate" title={row.detalle_evento}>{row.detalle_evento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
