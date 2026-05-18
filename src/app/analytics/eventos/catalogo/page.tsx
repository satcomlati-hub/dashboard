'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Edit2, Save, X, AlertCircle } from 'lucide-react';

interface CatalogoEvento {
  id: string;
  evento: string;
  programar_evento: boolean;
  afecta_uptime: boolean;
  severidad: 'Baja' | 'Media' | 'Alta';
  activo: boolean;
}

export default function CatalogoEventosPage() {
  const [eventos, setEventos] = useState<CatalogoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogoEvento>>({});

  const fetchCatalogo = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/db/catalogo');
      if (!res.ok) throw new Error('Error al cargar catálogo');
      const data = await res.json();
      setEventos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, []);

  const handleEdit = (ev: CatalogoEvento) => {
    setEditingId(ev.id);
    setEditForm({ ...ev });
  };

  const handleSave = async () => {
    try {
      const isNew = editingId === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch('/api/db/catalogo', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Error al guardar el evento');
      await fetchCatalogo();
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addNew = () => {
    setEditingId('new');
    setEditForm({
      evento: '',
      programar_evento: false,
      afecta_uptime: false,
      severidad: 'Baja',
      activo: true
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-6">
        <div>
          <Link href="/analytics/eventos" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group mb-4">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Historial
          </Link>
          <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white">Catálogo de Eventos Manuales</h2>
          <p className="text-sm text-neutral-500 mt-1">Administración de tipos de eventos y sus parámetros por defecto.</p>
        </div>
        <button 
          onClick={addNew}
          disabled={editingId !== null}
          className="bg-[#71BF44] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#5da035] transition-all disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nuevo Evento
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
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px]">Evento</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-center">Programar</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-center">Afecta Uptime</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px]">Severidad</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-center">Activo</th>
              <th className="px-6 py-4 font-black text-neutral-400 uppercase tracking-widest text-[10px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
            {editingId === 'new' && (
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <td className="px-6 py-3"><input type="text" className="w-full p-2 border rounded dark:bg-black text-xs font-bold uppercase" value={editForm.evento} onChange={e => setEditForm({...editForm, evento: e.target.value})} placeholder="Ej. V5-Nuevo" /></td>
                <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.programar_evento} onChange={e => setEditForm({...editForm, programar_evento: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.afecta_uptime} onChange={e => setEditForm({...editForm, afecta_uptime: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                <td className="px-6 py-3">
                  <select value={editForm.severidad} onChange={e => setEditForm({...editForm, severidad: e.target.value as any})} className="p-2 border rounded dark:bg-black text-xs font-bold w-full">
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </td>
                <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({...editForm, activo: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                  <button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Save className="w-4 h-4"/></button>
                  <button onClick={() => setEditingId(null)} className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded hover:bg-red-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
                </td>
              </tr>
            )}
            
            {eventos.map(ev => (
              editingId === ev.id ? (
                <tr key={ev.id} className="bg-neutral-50 dark:bg-neutral-900/50">
                  <td className="px-6 py-3"><input type="text" className="w-full p-2 border rounded dark:bg-black text-xs font-bold uppercase" value={editForm.evento} onChange={e => setEditForm({...editForm, evento: e.target.value})} /></td>
                  <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.programar_evento} onChange={e => setEditForm({...editForm, programar_evento: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                  <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.afecta_uptime} onChange={e => setEditForm({...editForm, afecta_uptime: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                  <td className="px-6 py-3">
                    <select value={editForm.severidad} onChange={e => setEditForm({...editForm, severidad: e.target.value as any})} className="p-2 border rounded dark:bg-black text-xs font-bold w-full">
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-center"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({...editForm, activo: e.target.checked})} className="w-4 h-4 accent-[#71BF44]" /></td>
                  <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                    <button onClick={handleSave} className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Save className="w-4 h-4"/></button>
                    <button onClick={() => setEditingId(null)} className="p-2 bg-neutral-200 dark:bg-neutral-800 rounded hover:bg-red-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
                  </td>
                </tr>
              ) : (
                <tr key={ev.id} className={`group hover:bg-[#71BF44]/[0.02] ${!ev.activo ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 font-black uppercase text-xs">{ev.evento}</td>
                  <td className="px-6 py-4 text-center">{ev.programar_evento ? 'Sí' : '-'}</td>
                  <td className="px-6 py-4 text-center">{ev.afecta_uptime ? <span className="text-red-500 font-bold">Sí</span> : '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      ev.severidad === 'Alta' ? 'bg-red-500/10 text-red-500' : 
                      ev.severidad === 'Media' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#71BF44]/10 text-[#71BF44]'
                    }`}>
                      {ev.severidad}
                    </span>
                  </td>
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
        {loading && <div className="p-8 text-center text-sm font-bold text-neutral-400 animate-pulse">Cargando catálogo...</div>}
      </div>
    </div>
  );
}
