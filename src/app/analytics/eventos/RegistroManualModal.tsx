import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Server, Info, AlertCircle, Save } from 'lucide-react';
import Link from 'next/link';

interface CatalogoEvento {
  id: string;
  evento: string;
  programar_evento: boolean;
  afecta_uptime: boolean;
  severidad: 'Baja' | 'Media' | 'Alta';
  activo: boolean;
}

interface CatalogoAmbiente {
  id: string;
  ambiente: string;
  activo: boolean;
}

export default function RegistroManualModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [catalogo, setCatalogo] = useState<CatalogoEvento[]>([]);
  const [ambientes, setAmbientes] = useState<CatalogoAmbiente[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    eventoId: '',
    ambiente: '',
    version: '',
    detalle: '',
    fecha: '',
    hora: '',
    duracionHoras: '1',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCatalogo();
      setForm(prev => ({
        ...prev,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().substring(0, 5)
      }));
    }
  }, [isOpen]);

  const fetchCatalogo = async () => {
    try {
      setLoading(true);
      const [resEventos, resAmbientes] = await Promise.all([
        fetch('/api/db/catalogo'),
        fetch('/api/db/ambientes')
      ]);
      const dataEventos = await resEventos.json();
      const dataAmbientes = await resAmbientes.json();
      if (!resEventos.ok) throw new Error(dataEventos.error || 'Error al cargar el catálogo de eventos');
      if (!resAmbientes.ok) throw new Error(dataAmbientes.error || 'Error al cargar el catálogo de ambientes');
      setCatalogo(dataEventos.filter((e: any) => e.activo));
      setAmbientes(dataAmbientes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedEvent = catalogo.find(e => e.id === form.eventoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/db/eventos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: selectedEvent.evento,
          programado: selectedEvent.programar_evento,
          severidad: selectedEvent.severidad,
          ambiente: form.ambiente,
          version: form.version,
          detalle: form.detalle,
          fecha: form.fecha,
          hora: form.hora,
          duracionHoras: form.duracionHoras
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el evento');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#131313] w-full max-w-2xl rounded-[32px] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white">Registro Manual de Evento</h2>
            <p className="text-xs text-neutral-500 mt-1">
              ¿No encuentras el evento? <Link href="/analytics/eventos/catalogo" className="text-[#71BF44] hover:underline" onClick={onClose}>Administrar Catálogo</Link>
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
             <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
               <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
               <p className="font-bold">{error}</p>
             </div>
          )}
          
          {loading ? (
            <div className="py-20 text-center animate-pulse text-neutral-400 font-bold text-sm">Cargando catálogo...</div>
          ) : (
            <form id="registro-manual-form" onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Tipo de Evento</label>
                <select 
                  required
                  value={form.eventoId}
                  onChange={e => setForm({...form, eventoId: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#71BF44] transition-colors"
                >
                  <option value="">Selecciona un evento...</option>
                  {catalogo.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.evento} ({ev.severidad})</option>
                  ))}
                </select>
                {selectedEvent && selectedEvent.afecta_uptime && (
                  <p className="text-[10px] font-bold text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Este evento reportará afectación de uptime.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Ambiente</label>
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <select required value={form.ambiente} onChange={e => setForm({...form, ambiente: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-[#71BF44] transition-colors appearance-none">
                      <option value="">Selecciona...</option>
                      {ambientes.map(amb => (
                        <option key={amb.id} value={amb.ambiente}>{amb.ambiente}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Versión (Opcional)</label>
                  <div className="relative">
                    <Info className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input type="text" value={form.version} onChange={e => setForm({...form, version: e.target.value})} placeholder="Ej. v1.2.0" className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-[#71BF44] transition-colors" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-[#71BF44]/5 p-4 rounded-xl border border-[#71BF44]/20">
                <div className="col-span-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase text-[#71BF44] flex items-center gap-2"><Clock className="w-4 h-4"/> Fecha y Hora del Evento</p>
                  {selectedEvent?.programar_evento && (
                    <span className="text-[9px] bg-[#71BF44] text-white px-2 py-0.5 rounded uppercase font-black tracking-widest animate-pulse">Generará Notificación</span>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Fecha</label>
                  <input type="date" required value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-[#71BF44]" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Hora</label>
                  <input type="time" required value={form.hora} onChange={e => setForm({...form, hora: e.target.value})} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-[#71BF44]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Duración (Horas)</label>
                <input type="number" min="1" required value={form.duracionHoras} onChange={e => setForm({...form, duracionHoras: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#71BF44] transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Detalle del Evento</label>
                <textarea 
                  required
                  rows={4}
                  value={form.detalle}
                  onChange={e => setForm({...form, detalle: e.target.value})}
                  placeholder="Describe brevemente la acción o el evento..."
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-sm font-medium outline-none focus:border-[#71BF44] transition-colors resize-none"
                />
              </div>

            </form>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-black/20 rounded-b-[32px]">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">Cancelar</button>
          <button 
            type="submit" 
            form="registro-manual-form" 
            disabled={saving || loading || !form.eventoId}
            className="px-6 py-3 rounded-xl font-bold bg-[#71BF44] text-white hover:bg-[#5da035] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : <Save className="w-4 h-4" />}
            {saving ? 'Registrando...' : 'Registrar Evento'}
          </button>
        </div>
      </div>
    </div>
  );
}
