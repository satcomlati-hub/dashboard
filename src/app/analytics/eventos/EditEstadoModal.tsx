import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

interface EventoRabbit {
  created_at: string;
  ambiente: string;
  version: string;
  pais: string;
  evento: string;
  detalle_evento: string;
  reporta: string;
  fecha_evento: string;
  key: string;
  num_eventos: string;
  mensaje: string;
  estado: string;
  justificacion: string | null;
  numero_caso: string | null;
}

interface EditEstadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventoRabbit | null;
  onSuccess: () => void;
}

export default function EditEstadoModal({ isOpen, onClose, event, onSuccess }: EditEstadoModalProps) {
  const [estado, setEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setEstado(event.estado || '');
      setError(null);
    }
  }, [event, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/db/eventos/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: event.key,
          estado: estado
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar el estado del evento');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#131313] w-full max-w-md rounded-[32px] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white">Editar Estado del Evento</h2>
            <p className="text-xs text-neutral-500 mt-1 truncate max-w-[320px]">{event.evento} ({event.ambiente})</p>
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

          <form id="edit-estado-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Estado del Evento</label>
              <select
                required
                value={estado}
                onChange={e => setEstado(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#71BF44] transition-colors"
              >
                <option value="Activo">Activo</option>
                <option value="Cerrado">Cerrado</option>
                {/* Permite mantener otros estados si el evento tenía otro estado originalmente */}
                {event.estado !== 'Activo' && event.estado !== 'Cerrado' && (
                  <option value={event.estado}>{event.estado}</option>
                )}
              </select>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-black/20 rounded-b-[32px]">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">Cancelar</button>
          <button
            type="submit"
            form="edit-estado-form"
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold bg-[#71BF44] text-white hover:bg-[#5da035] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
