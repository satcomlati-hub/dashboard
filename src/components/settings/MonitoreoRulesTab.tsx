'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Activity, Plus, Search, Trash2, Edit2, Play, Pause, Save, X, Settings, ListChecks, Database, Clock } from 'lucide-react';
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

interface MonitoreoConfig {
  id: string;
  nombre: string;
  ambientes: string[];
  proceso_sp: string;
  frecuencia: string;
  reglas_ids: string[];
  esta_activo: boolean;
  ultima_ejecucion?: string;
}

export default function MonitoreoRulesTab({ initialTab = 'rules' }: { initialTab?: 'rules' | 'config' }) {
  const [activeTab, setActiveTab] = useState<'rules' | 'config'>(initialTab);
  const [rules, setRules] = useState<ReglaMonitoreo[]>([]);
  const [configs, setConfigs] = useState<MonitoreoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const { showNotification } = useNotification();
  const [editingRule, setEditingRule] = useState<Partial<ReglaMonitoreo>>({});
  const [editingConfig, setEditingConfig] = useState<Partial<MonitoreoConfig>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchConfigs()]);
    setLoading(false);
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/db/monitoreo-rules');
      const json = await res.json();
      if (res.ok) setRules(json.data || []);
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/db/monitoreo-config');
      const json = await res.json();
      if (res.ok) setConfigs(json.data || []);
    } catch (err) {
      console.error('Error fetching configs:', err);
    }
  };

  const handleSaveRule = async () => {
    try {
      if (!editingRule.nombre || !editingRule.expresion_motivo) {
        showNotification('El Nombre y la Expresión de Motivo son obligatorios', 'error');
        return;
      }
      const method = editingRule.id ? 'PUT' : 'POST';
      const res = await fetch('/api/db/monitoreo-rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule)
      });
      if (res.ok) {
        showNotification(`Regla ${editingRule.id ? 'actualizada' : 'creada'} correctamente`, 'success');
        setShowRuleModal(false);
        fetchRules();
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (!editingConfig.nombre || !editingConfig.proceso_sp) {
        showNotification('El Nombre y el Proceso (SP) son obligatorios', 'error');
        return;
      }
      const method = editingConfig.id ? 'PUT' : 'POST';
      const res = await fetch('/api/db/monitoreo-config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig)
      });
      if (res.ok) {
        showNotification(`Configuración ${editingConfig.id ? 'actualizada' : 'creada'} correctamente`, 'success');
        setShowConfigModal(false);
        fetchConfigs();
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    const res = await fetch('/api/db/monitoreo-rules', { method: 'DELETE', body: JSON.stringify({ id }) });
    if (res.ok) { fetchRules(); showNotification('Regla eliminada', 'success'); }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('¿Eliminar esta configuración?')) return;
    const res = await fetch('/api/db/monitoreo-config', { method: 'DELETE', body: JSON.stringify({ id }) });
    if (res.ok) { fetchConfigs(); showNotification('Configuración eliminada', 'success'); }
  };

  return (
    <div className="space-y-6">

      {activeTab === 'rules' ? (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#71BF44]" /> Motor de Reglas
              </h3>
              <p className="text-xs text-neutral-500">Define los criterios de búsqueda (Regex) para detectar incidencias.</p>
            </div>
            <button onClick={() => { setEditingRule({ ambiente: 'Todos', esta_activa: true, minimo_eventos: 1 }); setShowRuleModal(true); }} className="bg-[#71BF44] hover:bg-[#5da036] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Regla</button>
          </div>

          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="px-6 py-4 font-bold">Estado</th>
                  <th className="px-6 py-4 font-bold">Nombre / Ambiente</th>
                  <th className="px-6 py-4 font-bold">Expresiones</th>
                  <th className="px-6 py-4 font-bold">Límites</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                    <td className="px-6 py-4">{rule.esta_activa ? <Play className="w-4 h-4 text-green-500" /> : <Pause className="w-4 h-4 text-neutral-400" />}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{rule.nombre}</div>
                      <div className="text-[10px] text-neutral-500 uppercase">{rule.ambiente}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate font-mono text-[10px] text-neutral-400">{rule.expresion_motivo}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-bold">{'>='} {rule.minimo_eventos}</span></td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setEditingRule(rule); setShowRuleModal(true); }} className="p-2 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteRule(rule.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-[#71BF44]" /> Ejecuciones de Monitoreo
              </h3>
              <p className="text-xs text-neutral-500">Configura qué procesos ejecutar y qué conjunto de reglas aplicar.</p>
            </div>
            <button onClick={() => { setEditingConfig({ ambientes: ['V5'], frecuencia: '1h', esta_activo: true, reglas_ids: [] }); setShowConfigModal(true); }} className="bg-[#71BF44] hover:bg-[#5da036] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Monitoreo</button>
          </div>

          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="px-6 py-4 font-bold">Estado</th>
                  <th className="px-6 py-4 font-bold">Nombre / Proceso</th>
                  <th className="px-6 py-4 font-bold">Frecuencia</th>
                  <th className="px-6 py-4 font-bold">Reglas Activas</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                    <td className="px-6 py-4">{config.esta_activo ? <Play className="w-4 h-4 text-green-500" /> : <Pause className="w-4 h-4 text-neutral-400" />}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{config.nombre}</div>
                      <div className="text-[10px] text-neutral-500 uppercase">
                        {config.ambientes?.join(', ') || 'N/A'} • {config.proceso_sp}
                      </div>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2 text-neutral-500"><Clock className="w-3 h-3" /> {config.frecuencia}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-[#71BF44]/10 text-[#71BF44] rounded text-xs font-bold">{config.reglas_ids?.length || 0} reglas</span></td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setEditingConfig(config); setShowConfigModal(true); }} className="p-2 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteConfig(config.id)} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal Reglas */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingRule.id ? 'Editar Regla' : 'Nueva Regla'}</h3>
              <button onClick={() => setShowRuleModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Nombre</label>
                <input type="text" value={editingRule.nombre || ''} onChange={e => setEditingRule({...editingRule, nombre: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#71BF44]/20 focus:border-[#71BF44] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Ambiente</label>
                  <select value={editingRule.ambiente || 'Todos'} onChange={e => setEditingRule({...editingRule, ambiente: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold">
                    <option value="Todos">Todos</option>
                    <option value="V5">V5</option>
                    <option value="Colombia">Colombia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Eventos Mínimos</label>
                  <input type="number" value={editingRule.minimo_eventos || 1} onChange={e => setEditingRule({...editingRule, minimo_eventos: Number(e.target.value)})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Expresión de Motivo (Regex)</label>
                <input type="text" value={editingRule.expresion_motivo || ''} onChange={e => setEditingRule({...editingRule, expresion_motivo: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono" placeholder="Ej: .*Establecimiento.*" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button onClick={handleSaveRule} className="px-6 py-2 rounded-xl text-sm font-bold bg-[#71BF44] hover:bg-[#5da036] text-white transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Monitoreo Config */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingConfig.id ? 'Editar Monitoreo' : 'Nuevo Monitoreo'}</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Nombre del Monitoreo</label>
                <input type="text" value={editingConfig.nombre || ''} onChange={e => setEditingConfig({...editingConfig, nombre: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#71BF44]/20 focus:border-[#71BF44] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Ambientes</label>
                  <div className="flex gap-2">
                    {['V5', 'Colombia'].map(amb => (
                      <label key={amb} className="flex items-center gap-2 bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 cursor-pointer transition-colors hover:border-[#71BF44]">
                        <input 
                          type="checkbox"
                          checked={editingConfig.ambientes?.includes(amb)}
                          onChange={e => {
                            const current = editingConfig.ambientes || [];
                            if (e.target.checked) setEditingConfig({...editingConfig, ambientes: [...current, amb]});
                            else setEditingConfig({...editingConfig, ambientes: current.filter(a => a !== amb)});
                          }}
                          className="w-4 h-4 rounded border-neutral-300 text-[#71BF44] focus:ring-[#71BF44]"
                        />
                        <span className="text-xs font-bold">{amb}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Frecuencia</label>
                  <select value={editingConfig.frecuencia || '1h'} onChange={e => setEditingConfig({...editingConfig, frecuencia: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold">
                    <option value="5min">Cada 5 minutos</option>
                    <option value="15min">Cada 15 minutos</option>
                    <option value="1h">Cada Hora</option>
                    <option value="12h">Cada 12 horas</option>
                    <option value="DIARIO">Diario</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Proceso (SP Name)</label>
                <input type="text" value={editingConfig.proceso_sp || ''} onChange={e => setEditingConfig({...editingConfig, proceso_sp: e.target.value})} className="w-full bg-neutral-50 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono" placeholder="Ej: consulta_tablero_no_autorizados_2026_EC" />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Seleccionar Reglas a Monitorear</label>
                <div className="mt-2 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                  {rules.filter(r => r.ambiente === 'Todos' || editingConfig.ambientes?.includes(r.ambiente)).map(rule => (
                    <label key={rule.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={editingConfig.reglas_ids?.includes(rule.id)} 
                        onChange={e => {
                          const current = editingConfig.reglas_ids || [];
                          if (e.target.checked) setEditingConfig({...editingConfig, reglas_ids: [...current, rule.id]});
                          else setEditingConfig({...editingConfig, reglas_ids: current.filter(id => id !== rule.id)});
                        }}
                        className="w-4 h-4 rounded border-neutral-300 text-[#71BF44] focus:ring-[#71BF44]"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{rule.nombre}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">{rule.expresion_motivo}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-[#0c0c0c]">
              <button onClick={handleSaveConfig} className="px-6 py-2 rounded-xl text-sm font-bold bg-[#71BF44] hover:bg-[#5da036] text-white transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar Configuración</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
