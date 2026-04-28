'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Tabs from '@/components/Tabs';
import SystemsTab from '@/components/workflows/SystemsTab';
import { List, Network } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  source: string;
  updatedAt: string;
  tags?: { name: string }[];
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState('list');
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
    
    // Consistent 'Pruebas' filter for all sources
    const isPruebas = w.tags?.some(tag => tag.name.trim() === 'Pruebas');
    
    return matchesSearch && matchesSource && !isPruebas;
  });

  const tabs = [
    { id: 'list', label: 'Flujos Activos', icon: <List size={18} /> },
    { id: 'systems', label: 'Sistemas', icon: <Network size={18} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Sección de Workflows</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Gestiona tus automatizaciones y visualiza la arquitectura de tus sistemas.</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'list' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-end mb-6 gap-3 animate-in fade-in duration-500">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar workflow..."
                className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#71BF44] w-64 shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none shadow-sm"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="all">Todas las instancias</option>
              <option value="SARA">SARA</option>
              <option value="Satcom (Primary)">Primario</option>
            </select>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg"></div>
               ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                    <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Origen</th>
                    <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filtered.map((w) => (
                    <tr key={w.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-[#71BF44] transition-colors">{w.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">ID: {w.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                          {w.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${w.active ? 'bg-[#71BF44] shadow-[0_0_8px_rgba(113,191,68,0.5)]' : 'bg-neutral-400'}`}></div>
                           <span className="text-xs text-neutral-600 dark:text-neutral-400">{w.active ? 'Activo' : 'Inactivo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/workflows/${w.id}?source=${w.source}`}
                          className="text-xs text-[#71BF44] hover:underline font-bold uppercase tracking-wider"
                        >
                          Detalles
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
        </>
      ) : (
        <SystemsTab />
      )}
    </div>
  );
}

