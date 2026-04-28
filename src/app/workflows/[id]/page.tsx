'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';


export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const { id } = React.use(params);
  const router = useRouter();
  const source = searchParams.get('source');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/workflows/${id}?source=${source}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, source]);

  if (loading) return <div className="p-8 animate-pulse text-white">Cargando detalles...</div>;
  if (!data || data.error) return <div className="p-8 text-red-500">Error al cargar el workflow.</div>;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/workflows" className="text-sm text-neutral-500 hover:text-[#71BF44] mb-6 flex items-center gap-2">
        ← Volver a la lista
      </Link>
      
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <h1 className="text-3xl font-bold dark:text-white">{data.name}</h1>
               <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${data.active ? 'bg-[#71BF44]/20 text-[#71BF44]' : 'bg-neutral-800 text-neutral-400'}`}>
                 {data.active ? 'ACTIVO' : 'INACTIVO'}
               </span>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">ID: {data.id} • Origen: {source}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm text-neutral-500 mb-1">Ejecuciones</h3>
            <p className="text-2xl font-bold dark:text-white">{data.executions.toLocaleString()}</p>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm text-neutral-500 mb-1">Nodos</h3>
            <p className="text-2xl font-bold dark:text-white">{data.nodesCount}</p>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm text-neutral-500 mb-1">Última Actualización</h3>
            <p className="text-lg font-bold dark:text-white">{new Date(data.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>



        <div>
          <h2 className="text-xl font-bold dark:text-white mb-4">Dependencias y Credenciales</h2>
          <div className="flex flex-wrap gap-2">
            {data.dependencies.length > 0 ? (
              data.dependencies.map((dep: string) => (
                <div key={dep} className="px-4 py-2 bg-[#71BF44]/10 border border-[#71BF44]/30 rounded-lg text-sm text-[#71BF44]">
                  {dep}
                </div>
              ))
            ) : (
              <p className="text-neutral-500 italic">No se detectaron credenciales externas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
