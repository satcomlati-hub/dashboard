'use client';

import React, { useState, useEffect } from 'react';
import { Server, Plus, Search, Trash2, Edit2, Play, Pause, Save, X } from 'lucide-react';
import { useNotification } from '@/components/NotificationProvider';

interface RabbitAlertaConfig {
  id: string;
  ambiente: string;
  nombre_cola: string;
  limite_mensajes: number;
  esta_activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export default function RabbitAlertsTab() {
  const [configs, setConfigs] = useState<RabbitAlertaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { showNotification } = useNotification();
  const [editingConfig, setEditingConfig] = useState<Partial<RabbitAlertaConfig>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/db/rabbit-alertas');
      const json = await res.json();
      if (res.ok) {
        setConfigs(json.data || []);
      } else {
        showNotification(`Error al cargar configuraciones: ${json.error}`, 'error');
      }
    } catch (err: any) {
      console.error('Error fetching rabbit configs:', err);
      showNotification('Error de red al cargar configuraciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!editingConfig.ambiente || !editingConfig.nombre_cola || editingConfig.limite_mensajes === undefined) {
        showNotification('Todos los campos son obligatorios', 'error');
        return;
      }
      if (editingConfig.limite_mensajes < 0) {
        showNotification('El límite de mensajes debe ser un número positivo', 'error');
        return;
      }

      const method = editingConfig.id ? 'PUT' : 'POST';
      const res = await fetch('/api/db/rabbit-alertas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig)
      });
      const json = await res.json();

      if (res.ok) {
        showNotification(`Límite ${editingConfig.id ? 'actualizado' : 'creado'} correctamente`, 'success');
        setShowModal(false);
        fetchConfigs();
      } else {
        showNotification(`Error al guardar: ${json.error}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este límite de mensajes?')) return;
    try {
      const res = await fetch('/api/db/rabbit-alertas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showNotification('Límite eliminado correctamente', 'success');
        fetchConfigs();
      } else {
        const json = await res.json();
        showNotification(`Error al eliminar: ${json.error}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const handleToggleStatus = async (config: RabbitAlertaConfig) => {
    try {
      const updated = { id: config.id, esta_activo: !config.esta_activo };
      const res = await fetch('/api/db/rabbit-alertas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        showNotification(`Límite ${!config.esta_activo ? 'activado' : 'desactivado'} correctamente`, 'success');
        fetchConfigs();
      } else {
        const json = await res.json();
        showNotification(`Error al cambiar estado: ${json.error}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const filteredConfigs = configs.filter(c => 
    c.ambiente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nombre_cola.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-[#71BF44]" /> Control de Alertas de Colas (RabbitMQ)
          </h3>
          <p className="text-xs text-neutral-500 mt-1">Configura el límite de mensajes permitidos antes de disparar alertas en n8n.</p>
        </div>
        <button
          onClick={() => {
            setEditingConfig({
              ambiente: 'V5-EC',
              nombre_cola: '',
              limite_mensajes: 100,
              esta_activo: true
            });
            setShowModal(true);
          }}
          className="bg-[#71BF44] hover:bg-[#5da036] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Límite
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Buscar por ambiente o cola..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#71BF44] focus:ring-1 focus:ring-[#71BF44] transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#71BF44]/30 border-t-[#71BF44] rounded-full animate-spin" />
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Server className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
          <p className="text-sm text-neutral-500 font-medium">No se encontraron límites configurados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Ambiente</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Nombre de Cola</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Límite Máximo</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredConfigs.map(config => (
                <tr key={config.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(config)}
                      title={config.esta_activo ? 'Pausar regla' : 'Activar regla'}
                      className="transition-transform active:scale-95"
                    >
                      {config.esta_activo ? (
                        <Play className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
                      ) : (
                        <Pause className="w-4 h-4 text-neutral-400 fill-neutral-400/10" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-bold text-neutral-800 dark:text-neutral-200">
                    {config.ambiente}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {config.nombre_cola}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg text-xs font-bold border border-red-500/20">
                      {config.limite_mensajes.toLocaleString()} msg
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button
                      onClick={() => {
                        setEditingConfig(config);
                        setShowModal(true);
                      }}
                      className="p-1.5 hover:bg-[#71BF44]/10 rounded-lg text-[#71BF44] transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-[#0c0c0c]/50">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                {editingConfig.id ? 'Editar Límite de Cola' : 'Nuevo Límite de Cola'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Ambiente</label>
                <select 
                  value={editingConfig.ambiente || ''} 
                  onChange={e => setEditingConfig({ ...editingConfig, ambiente: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44] transition-all"
                >
                  <option value="V5-EC">V5-EC</option>
                  <option value="V5-Panama">V5-Panama</option>
                  <option value="ColombiaAWS">ColombiaAWS</option>
                  <option value="Testing">Testing</option>
                  <option value="Bolivia">Bolivia</option>
                  <option value="KFC">KFC</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Nombre de la Cola</label>
                <input 
                  type="text" 
                  value={editingConfig.nombre_cola || ''} 
                  onChange={e => setEditingConfig({ ...editingConfig, nombre_cola: e.target.value })}
                  placeholder="Ej: ProdAWS_DtoComprobanteSender o * para un límite genérico"
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Límite Máximo de Mensajes</label>
                  <input 
                    type="number" 
                    value={editingConfig.limite_mensajes !== undefined ? editingConfig.limite_mensajes : ''} 
                    onChange={e => setEditingConfig({ ...editingConfig, limite_mensajes: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Ej: 500"
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Estado</label>
                  <select 
                    value={editingConfig.esta_activa === false ? 'false' : 'true'} 
                    onChange={e => setEditingConfig({ ...editingConfig, esta_activo: e.target.value === 'true' })}
                    className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#71BF44] transition-all"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#71BF44] hover:bg-[#5da036] text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Límite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
