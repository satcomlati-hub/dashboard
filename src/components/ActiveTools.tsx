'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const POLL_INTERVAL = 30_000; // 30 segundos

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  source: string;
}

export default function ActiveTools() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch('/api/workflows')
        .then(res => res.json())
        .then(data => {
          setWorkflows((data.data || []).slice(0, 8));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Workflow Activos / Recientes</h2>
        <Link href="/workflows" className="text-sm text-[#71BF44] hover:underline font-medium">
          Ver todos →
        </Link>
      </div>
      
      {loading ? (
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50 dark:text-neutral-400">
              <tr>
                <th className="px-6 py-3 font-medium">Nombre</th>
                <th className="px-6 py-3 font-medium">Instancia</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((wk) => (
                <tr key={wk.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900 dark:text-white">{wk.name}</td>
                  <td className="px-6 py-4">
                    <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
                      {wk.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-[#71BF44] font-medium text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${wk.active ? 'bg-[#71BF44]' : 'bg-neutral-400'}`}></span>
                      {wk.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/workflows/${wk.id}?source=${wk.source}`}
                      className="text-[#71BF44] hover:underline font-medium text-xs"
                    >
                      Detalles
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workflows.length === 0 && (
            <div className="py-12 text-center text-neutral-500 italic">No hay workflows para mostrar.</div>
          )}
        </div>
      )}
    </div>
  );
}
