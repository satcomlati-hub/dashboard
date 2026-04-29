'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Activity, Plus, Search, Trash2, Edit2, Play, Pause, Save, X } from 'lucide-react';
import { useNotification } from '@/components/NotificationProvider';

interface ReglaMonitoreo {
  id: string;
  nombre: string;
  ambiente: string;
  expresion_estado: string;
  expresion_motivo: string;
  minimo_eventos: number;
  modo: string;
  frecuencia: string;
  prioridad_ticket: string;
  esta_activa: boolean;
}

export default function MonitoreoRulesTab() {
  const [rules, setRules] = useState<ReglaMonitoreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { showNotification } = useNotification();
  const [editingRule, setEditingRule] = useState<Partial<ReglaMonitoreo>>({});

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reglas_alertas')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error && error.code !== 'PGRST116') throw error;
      setRules(data || []);
    } catch (err: any) {
      console.error('Error fetching rules:', err);
      // Fallback silencioso si no existe el esquema aún
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!editingRule.nombre || !editingRule.expresion_estado || !editingRule.expresion_motivo) {
        showNotification('Complete los campos obligatorios', 'error');
        return;
      }

      const payload = {
        nombre: editingRule.nombre,
        ambiente: editingRule.ambiente || 'Todos',
        expresion_estado: editingRule.expresion_estado,
        expresion_motivo: editingRule.expresion_motivo,
        minimo_eventos: editingRule.minimo_eventos || 1,
        modo: editingRule.modo || 'POR_EMISOR',
        frecuencia: editingRule.frecuencia || 'DIARIO',
        prioridad_ticket: editingRule.prioridad_ticket || 'Media',
        esta_activa: editingRule.esta_activa !== false
      };

      if (editingRule.id) {
        const { error } = await supabase.from('reglas_alertas').update(payload).eq('id', editingRule.id);
        if (error) throw error;
        showNotification('Regla actualizada correctamente', 'success');
      } else {
        const { error } = await supabase.from('reglas_alertas').insert([payload]);
        if (error) throw error;
        showNotification('Regla creada correctamente', 'success');
      }
      
      setShowModal(false);
      fetchRules();
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('reglas_alertas').update({ esta_activa: !currentStatus }).eq('id', id);
      if (error) throw error;
      setRules(rules.map(r => r.id === id ? { ...r, esta_activa: !currentStatus } : r));
      showNotification(`Regla ${!currentStatus ? 'activada' : 'desactivada'}`, 'success');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('¿Eliminar esta regla permanentemente?')) return;
    try {
      const { error } = await supabase.from('reglas_alertas').delete().eq('id', id);
      if (error) throw error;
      setRules(rules.filter(r => r.id !== id));
      showNotification('Regla eliminada', 'success');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const openNewModal = () => {
    setEditingRule({
      ambiente: 'Todos',
      modo: 'POR_EMISOR',
      frecuencia: 'DIARIO',
      prioridad_ticket: 'Media',
      minimo_eventos: 5,
      esta_activa: true
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#71BF44]" /> Motor de Alertas
          </h3>
          <p className="text-xs text-neutral-500">Configura reglas automáticas para la generación de casos en ZohoDesk basadas en incidencias.</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-[#71BF44] hover:bg-[#5da036] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Nueva Regla
        </button>
      </div>

      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-500 dark:text-neutral-400">
            <tr>
              <th className="px-6 py-4 font-bold">Estado</th>
              <th className="px-6 py-4 font-bold">Nombre / Frecuencia</th>
              <th className="px-6 py-4 font-bold">Expresiones (Estado / Motivo)</th>
              <th className="px-6 py-4 font-bold">Límites</th>
              <th className="px-6 py-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                <td className="px-6 py-4">
                  <button 
                    onClick={() => toggleStatus(rule.id, rule.esta_activa)}
                    className={`p-2 rounded-lg transition-colors ${rule.esta_activa ? 'bg-green-500/10 text-green-500' : 'bg-neutral-500/10 text-neutral-500'}`}
                    title={rule.esta_activa ? 'Desactivar Regla' : 'Activar Regla'}
                  >
                    {rule.esta_activa ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-neutral-900 dark:text-white">{rule.nombre}</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-widest mt-1">
                    {rule.frecuencia} • {rule.ambiente}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <code className="text-[10px] bg-neutral-100 dark:bg-[#111] px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800">
                      {rule.expresion_estado}
                    </code>
                    <code className="text-[10px] bg-neutral-100 dark:bg-[#111] px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 truncate max-w-xs">
                      {rule.expresion_motivo}
                    </code>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-1 bg-[#71BF44]/10 text-[#71BF44] rounded">
                      &gt;= {rule.minimo_eventos}
                    </span>
                    <span className="text-xs text-neutral-500">{rule.modo}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => { setEditingRule(rule); setShowModal(true); }}
                      className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">No hay reglas configuradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-3xl rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingRule.id ? 'Editar Regla' : 'Nueva Regla'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Nombre de la Regla</label>
                <input 
                  type="text" 
                  value={editingRule.nombre || ''}
                  onChange={e => setEditingRule({...editingRule, nombre: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44] transition-colors"
                  placeholder="Ej: Caída masiva SRI"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Expresión de Estado</label>
                <input 
                  type="text" 
                  value={editingRule.expresion_estado || ''}
                  onChange={e => setEditingRule({...editingRule, expresion_estado: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44] transition-colors font-mono"
                  placeholder="Regex o texto (ej: PendienteValidacion)"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Expresión de Motivo</label>
                <input 
                  type="text" 
                  value={editingRule.expresion_motivo || ''}
                  onChange={e => setEditingRule({...editingRule, expresion_motivo: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44] transition-colors font-mono"
                  placeholder="Regex o texto (ej: timeout)"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Modo de Agrupación</label>
                <select 
                  value={editingRule.modo || 'POR_EMISOR'}
                  onChange={e => setEditingRule({...editingRule, modo: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44]"
                >
                  <option value="POR_EMISOR">Por Emisor Individual</option>
                  <option value="GLOBAL">Cualquier Emisor (Global)</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Eventos Mínimos</label>
                <input 
                  type="number" 
                  value={editingRule.minimo_eventos || 1}
                  onChange={e => setEditingRule({...editingRule, minimo_eventos: Number(e.target.value)})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44]"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Frecuencia Evaluación</label>
                <select 
                  value={editingRule.frecuencia || 'DIARIO'}
                  onChange={e => setEditingRule({...editingRule, frecuencia: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44]"
                >
                  <option value="TIEMPO_REAL">Tiempo Real (Webhook)</option>
                  <option value="HORARIO">Cada Hora</option>
                  <option value="DIARIO">Diario</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="MENSUAL">Mensual</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Ambiente Objetivo</label>
                <select 
                  value={editingRule.ambiente || 'Todos'}
                  onChange={e => setEditingRule({...editingRule, ambiente: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#71BF44]"
                >
                  <option value="Todos">Cualquiera (Todos)</option>
                  <option value="V5">V5</option>
                  <option value="Panama">Panamá</option>
                  <option value="Colombia">Colombia AWS</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-[#71BF44] hover:bg-[#5da036] text-white transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar Regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
