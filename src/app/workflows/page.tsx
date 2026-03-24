'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  source: string;
  updatedAt: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workflows')
      .then(res => res.json())
      .then(data => {
        setWorkflows(data.data || []);
        setLoading(false);
      });
  }, []);

  const filtered = workflows.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    const matchesSource = filterSource === 'all' || w.source === filterSource;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Workflows</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Gestiona y monitorea tus automatizaciones activas.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar workflow..."
              className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#71BF44] w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="all">Todas las instancias</option>
            <option value="SARA">SARA</option>
            <option value="Satcom (Primary)">Primario</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
           {[...Array(5)].map((_, i) => (
             <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg"></div>
           ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase">Origen</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{w.name}</div>
                    <div className="text-xs text-neutral-400">ID: {w.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      {w.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${w.active ? 'bg-[#71BF44]' : 'bg-neutral-400'}`}></div>
                       <span className="text-sm text-neutral-600 dark:text-neutral-400">{w.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/workflows/${w.id}?source=${w.source}`}
                      className="text-sm text-[#71BF44] hover:underline font-medium"
                    >
                      Ver detalles
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-neutral-500">No se encontraron workflows</div>
          )}
        </div>
      )}
    </div>
  );
}
