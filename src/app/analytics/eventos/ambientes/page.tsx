'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Edit2, Save, X, AlertCircle } from 'lucide-react';

interface CatalogoAmbiente {
  id: string;
  ambiente: string;
  activo: boolean;
}

export default function CatalogoAmbientesPage() {
  const [ambientes, setAmbientes] = useState<CatalogoAmbiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogoAmbiente>>({});

  const fetchCatalogo = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/db/ambientes');
      if (!res.ok) throw new Error('Error al cargar catálogo de ambientes');
      const data = await res.json();
      setAmbientes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, []);

  const handleEdit = (ev: CatalogoAmbiente) => {
    setEditingId(ev.id);
    setEditForm({ ...ev });
  };

  const handleSave = async () => {
    try {
      const isNew = editingId === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch('/api/db/ambientes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Error al guardar el ambiente');
      await fetchCatalogo();
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({
      ambiente: '',
      activo: true
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-6">
        <div>
          <Link href="/analytics/eventos" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group mb-4">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Historial
          </Link>
          <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white">Catálogo de Ambientes</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Administración de ambientes disponibles para los registros manuales. 
            <Link href="/analytics/eventos/catalogo" className="ml-2 text-[#71BF44] hover:underline">Ir a Eventos →</Link>
          </p>
        </div>
        <button 
          onClick={addNew}
          disabled={editingId !== null}
          className="bg-[#71BF44] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#5da035] transition-all disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nuevo Ambiente
        </button>
      </header>

      {error && (
         <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
           <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
           <p className="font-bold">{error}</p>
         </div>
      )}

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-100 dark:border-neutral-800">
            <tr>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px]">Ambiente</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-center w-32">Activo</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-right w-40">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {editingId === 'new' && (
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <td className="px-6 py-3"><input type="text" className="w-full p-2 border rounded dark:bg-black text-xs font-bold" value={editForm.ambiente} onChange={e => setEditForm({...editForm, ambiente: e.target.value})} placeholder="Ej. Producción" /></td>
                <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({...editForm, activo: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                  <button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Save className="w-4 h-4"/></button>
                  <button onClick={() => setEditingId(null)} className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded hover:bg-red-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
                </td>
              </tr>
            )}
            
            {ambientes.map(ev => (
              editingId === ev.id ? (
                <tr key={ev.id} className="bg-neutral-50 dark:bg-neutral-900/50">
                  <td className="px-6 py-3"><input type="text" className="w-full p-2 border rounded dark:bg-black text-xs font-bold" value={editForm.ambiente} onChange={e => setEditForm({...editForm, ambiente: e.target.value})} /></td>
                  <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({...editForm, activo: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                  <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                    <button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Save className="w-4 h-4"/></button>
                    <button onClick={() => setEditingId(null)} className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded hover:bg-red-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
                  </td>
                </tr>
              ) : (
                <tr key={ev.id} className={`group hover:bg-[#71BF44]/[0.02] ${!ev.activo ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 font-black text-xs">{ev.ambiente}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${ev.activo ? 'bg-[#71BF44]' : 'bg-neutral-400'}`}></span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(ev)} className="p-2 text-neutral-400 hover:text-[#71BF44] hover:bg-[#71BF44]/10 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {loading && <div className="p-8 text-center text-sm font-bold text-neutral-400 animate-pulse">Cargando ambientes...</div>}
      </div>
    </div>
  );
}
