'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  BookOpen, ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  BookMarked, FileText, Globe, Lock, Trash2, UploadCloud, X, Upload,
  Info, UserPlus, UserMinus, Power, RotateCcw, Search,
  MoreVertical, SlidersHorizontal,
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Articulo {
  articulo: string;
  source_url: string;
  created_at: string;
  created_by: string | null;
  modified_at: string | null;
  modified_by: string | null;
  is_public: boolean;
  is_active: boolean;
  can_edit: boolean;
  allowed_editors: string[];
}

interface ManualGroup {
  manual: string;
  total: number;
  articulos: Articulo[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatFecha(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// ─── Modal: Actualizar PDF ────────────────────────────────────────────────────

function PdfUpdateModal({ art, userEmail, onClose }: {
  art: Articulo; userEmail: string; onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.name.toLowerCase().endsWith('.pdf') && f.type === 'application/pdf') {
      setFile(f); setErrorMsg('');
    } else if (f) setErrorMsg('Solo se permiten archivos PDF.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus('loading'); setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('data', file, file.name);
      fd.append('user', userEmail);
      fd.append('manual', art.articulo);
      fd.append('articulo', art.articulo);
      fd.append('action', 'update');
      const res = await fetch('https://sara.mysatcomla.com/webhook/ingesta-documentos', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setStatus('success');
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold dark:text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#71BF44]" /> Actualizar artículo
            </h2>
            <p className="text-xs text-neutral-500 mt-1 truncate max-w-[320px]">{art.articulo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div onClick={() => !file && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${file ? 'border-[#71BF44]/40 bg-[#71BF44]/5' : 'border-neutral-300 dark:border-neutral-700 hover:border-[#71BF44]/50'}`}>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileChange} className="hidden" />
            {file ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-red-500" /></div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium dark:text-white truncate">{file.name}</p>
                    <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"><X className="w-3.5 h-3.5 text-neutral-500" /></button>
              </div>
            ) : (
              <div className="py-2">
                <div className="w-10 h-10 rounded-full bg-[#71BF44]/10 flex items-center justify-center mx-auto mb-2"><Upload className="w-5 h-5 text-neutral-400" /></div>
                <p className="text-sm font-medium dark:text-neutral-300">Seleccionar PDF</p>
                <p className="text-xs text-neutral-500 mt-0.5">Solo archivos .pdf</p>
              </div>
            )}
          </div>
          {errorMsg && <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{errorMsg}</p>}
          {status === 'success' && <p className="text-xs text-[#71BF44] bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-lg px-3 py-2">Actualización enviada a SARA correctamente.</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Cancelar</button>
            <button type="submit" disabled={!file || status === 'loading' || status === 'success'}
              className="flex-1 py-2.5 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {status === 'loading' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando...</> : <><UploadCloud className="w-4 h-4" /> Actualizar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Actualizar manual completo (solo admin) ───────────────────────────

function BulkUpdateModal({ group, userEmail, onClose }: {
  group: ManualGroup; userEmail: string; onClose: () => void;
}) {
  const zohoArts = group.articulos.filter(a => a.source_url.includes('zohopublic'));
  const pdfArts  = group.articulos.filter(a => !a.source_url.includes('zohopublic'));
  const totalZoho = zohoArts.length;

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentArt, setCurrentArt] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef(false);

  const handleStart = async () => {
    if (totalZoho === 0) return;
    setStatus('running');
    setProgress(0);
    setErrors([]);
    abortRef.current = false;

    const errList: string[] = [];
    for (let i = 0; i < zohoArts.length; i++) {
      if (abortRef.current) break;
      const art = zohoArts[i];
      setCurrentArt(art.articulo);
      try {
        await fetch('https://sara.mysatcomla.com/webhook/ingesta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            'Links de Zoho Learn': art.source_url,
            'Correo del responsable': userEmail,
            submittedAt: new Date().toISOString(),
            formMode: 'production',
          }]),
        });
      } catch {
        errList.push(art.articulo);
      }
      setProgress(i + 1);
    }
    setErrors(errList);
    setCurrentArt('');
    setStatus(errList.length > 0 ? 'error' : 'done');
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  const pct = totalZoho > 0 ? Math.round((progress / totalZoho) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#71BF44]" /> Actualizar manual completo
            </h2>
            <p className="text-xs text-neutral-500 mt-1 truncate max-w-[320px]">{group.manual}</p>
          </div>
          <button onClick={onClose} disabled={status === 'running'}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 disabled:opacity-30">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="space-y-4">
          {/* Resumen */}
          <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">Artículos Zoho Learn</span>
              <span className="font-bold text-[#71BF44]">{totalZoho}</span>
            </div>
            {pdfArts.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Artículos PDF (se omiten)</span>
                <span className="font-bold text-amber-400">{pdfArts.length}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">Total</span>
              <span className="font-bold dark:text-white">{group.articulos.length}</span>
            </div>
          </div>

          {pdfArts.length > 0 && (
            <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              Los artículos PDF no se actualizan masivamente — deben subirse individualmente.
            </p>
          )}

          {totalZoho === 0 && (
            <p className="text-xs text-neutral-400 text-center py-2">
              Este manual no contiene artículos de Zoho Learn para actualizar.
            </p>
          )}

          {/* Barra de progreso */}
          {status !== 'idle' && (
            <div className="space-y-2">
              <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    status === 'error' ? 'bg-amber-400' : status === 'done' ? 'bg-[#71BF44]' : 'bg-[#71BF44] animate-pulse'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-500">
                  {status === 'running' ? 'Procesando...' : status === 'done' ? '¡Completado!' : `${errors.length} error(es)`}
                </span>
                <span className="font-bold text-neutral-400">{progress}/{totalZoho} ({pct}%)</span>
              </div>
              {currentArt && (
                <p className="text-[10px] text-neutral-400 truncate">
                  → {currentArt}
                </p>
              )}
              {errors.length > 0 && (
                <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 max-h-20 overflow-y-auto">
                  {errors.map((e, i) => <p key={i}>Error: {e}</p>)}
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <p className="text-xs text-[#71BF44] bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-lg px-3 py-2 text-center">
              Se enviaron {progress} artículo(s) a SARA para re-ingesta.
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-5">
          {status === 'idle' ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleStart} disabled={totalZoho === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <RotateCcw className="w-4 h-4" /> Actualizar {totalZoho} artículos
              </button>
            </>
          ) : status === 'running' ? (
            <button onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
              Detener
            </button>
          ) : (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold transition-colors">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Detalles del artículo ─────────────────────────────────────────────

function DetailsModal({ art, isAdmin, onClose, onEditorsChange, onCreatorChange }: {
  art: Articulo; isAdmin: boolean;
  onClose: () => void;
  onEditorsChange: (source_url: string, editors: string[]) => void;
  onCreatorChange: (source_url: string, newCreator: string) => void;
}) {
  const [localEditors, setLocalEditors] = useState<string[]>(art.allowed_editors);
  const [newEmail,     setNewEmail]     = useState('');
  const [adding,       setAdding]       = useState(false);
  const [removing,     setRemoving]     = useState<string | null>(null);
  const [addError,     setAddError]     = useState('');

  const [newCreatorEmail, setNewCreatorEmail] = useState('');
  const [savingCreator,   setSavingCreator]   = useState(false);
  const [creatorMsg,      setCreatorMsg]      = useState('');

  const addEditor = async () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@')) { setAddError('Correo inválido'); return; }
    if (localEditors.includes(email)) { setAddError('Ya está en la lista'); return; }
    setAdding(true); setAddError('');
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: art.source_url, editor_email: email, editors_action: 'add' }),
      });
      if (!res.ok) throw new Error();
      const updated = [...localEditors, email];
      setLocalEditors(updated);
      onEditorsChange(art.source_url, updated);
      setNewEmail('');
    } catch { setAddError('Error al agregar editor'); }
    finally { setAdding(false); }
  };

  const saveCreator = async () => {
    const email = newCreatorEmail.trim();
    if (!email || !email.includes('@')) { setCreatorMsg('Correo inválido'); return; }
    setSavingCreator(true); setCreatorMsg('');
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: art.source_url, new_creator_email: email }),
      });
      if (!res.ok) throw new Error();
      onCreatorChange(art.source_url, email);
      setCreatorMsg('Responsable actualizado');
      setNewCreatorEmail('');
    } catch { setCreatorMsg('Error al cambiar responsable'); }
    finally { setSavingCreator(false); setTimeout(() => setCreatorMsg(''), 3000); }
  };

  const removeEditor = async (email: string) => {
    setRemoving(email);
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: art.source_url, editor_email: email, editors_action: 'remove' }),
      });
      if (!res.ok) throw new Error();
      const updated = localEditors.filter(e => e !== email);
      setLocalEditors(updated);
      onEditorsChange(art.source_url, updated);
    } catch { /* silencioso */ }
    finally { setRemoving(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold dark:text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-[#71BF44]" /> Detalles del artículo
            </h2>
            <p className="text-xs text-neutral-500 mt-1 break-all">{art.articulo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-5">
          {/* Reasignar Responsable (solo admin) */}
          {isAdmin && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                Reasignar Responsable del Artículo
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newCreatorEmail}
                  onChange={e => { setNewCreatorEmail(e.target.value); setCreatorMsg(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveCreator())}
                  placeholder="nuevo.responsable@satcomla.com"
                  className="flex-1 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all"
                />
                <button
                  onClick={saveCreator}
                  disabled={savingCreator}
                  className="px-3 py-2 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {savingCreator ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {creatorMsg && <p className={`text-xs mt-1 ${creatorMsg.includes('actualizado') ? 'text-[#71BF44]' : 'text-red-500'}`}>{creatorMsg}</p>}
            </section>
          )}

          {/* Registro */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Registro</p>
            <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-2xl p-4 space-y-2">
              <Row label="Cargado por" value={art.created_by || 'Sistema'} />
              <Row label="Fecha de carga" value={formatFecha(art.created_at)} />
              {art.modified_by && <Row label="Modificado por" value={art.modified_by} />}
              {art.modified_at && <Row label="Fecha de modificación" value={formatFecha(art.modified_at)} />}
            </div>
          </section>

          {/* Fuente */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Fuente</p>
            <a href={art.source_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#71BF44] hover:underline break-all bg-neutral-50 dark:bg-[#1A1A1A] rounded-2xl p-4">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {art.source_url}
            </a>
          </section>

          {/* Responsables */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
              Responsables de actualización
            </p>
            <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-2xl p-4 space-y-2">
              {/* Creador siempre tiene permiso */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-6 h-6 rounded-full bg-[#71BF44]/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#71BF44]">{(art.created_by || 'S')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">{art.created_by || 'Sistema'}</span>
                </div>
                <span className="text-[9px] font-bold uppercase text-[#71BF44] bg-[#71BF44]/10 px-2 py-0.5 rounded-full shrink-0">Creador</span>
              </div>

              {localEditors.map(email => (
                <div key={email} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-blue-500">{email[0].toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">{email}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeEditor(email)}
                      disabled={removing === email}
                      className="p-1 rounded-lg text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Quitar editor"
                    >
                      {removing === email
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <UserMinus className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              ))}

              {localEditors.length === 0 && (
                <p className="text-xs text-neutral-400 italic">Solo el creador puede actualizar este artículo.</p>
              )}
            </div>
          </section>

          {/* Agregar editor (solo admin) */}
          {isAdmin && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                Agregar editor
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditor())}
                  placeholder="correo@satcomla.com"
                  className="flex-1 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all"
                />
                <button
                  onClick={addEditor}
                  disabled={adding}
                  className="px-3 py-2 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                </button>
              </div>
              {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
            </section>
          )}
        </div>

        <button onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// Fila de dato dentro del modal Detalles
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-neutral-400 shrink-0">{label}</span>
      <span className="text-xs font-medium dark:text-neutral-200 text-right break-all">{value}</span>
    </div>
  );
}

// ─── Modal: Detalles del manual (editores a nivel manual, solo Zoho) ──────────

function ManualDetailsModal({ group, isAdmin, onClose, onEditorsChange, onManualCreatorChange }: {
  group: ManualGroup; isAdmin: boolean;
  onClose: () => void;
  onEditorsChange: (manual: string, editors: string[]) => void;
  onManualCreatorChange: (manual: string, newCreator: string) => void;
}) {
  const zohoArts = group.articulos.filter(a => a.source_url.includes('zohopublic'));
  const initEditors = [...new Set(zohoArts.flatMap(a => a.allowed_editors))];

  const [localEditors, setLocalEditors] = useState<string[]>(initEditors);
  const [newEmail,     setNewEmail]     = useState('');
  const [adding,       setAdding]       = useState(false);
  const [removing,     setRemoving]     = useState<string | null>(null);
  const [addError,     setAddError]     = useState('');

  const [newManualCreator, setNewManualCreator] = useState('');
  const [savingManualCreator, setSavingManualCreator] = useState(false);
  const [creatorMsg, setCreatorMsg] = useState('');

  const addEditor = async () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@')) { setAddError('Correo inválido'); return; }
    if (localEditors.includes(email))   { setAddError('Ya está en la lista'); return; }
    setAdding(true); setAddError('');
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: group.manual, editor_email: email, editors_action: 'add' }),
      });
      if (!res.ok) throw new Error();
      const updated = [...localEditors, email];
      setLocalEditors(updated);
      onEditorsChange(group.manual, updated);
      setNewEmail('');
    } catch { setAddError('Error al agregar editor'); }
    finally { setAdding(false); }
  };

  const removeEditor = async (email: string) => {
    setRemoving(email);
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: group.manual, editor_email: email, editors_action: 'remove' }),
      });
      if (!res.ok) throw new Error();
      const updated = localEditors.filter(e => e !== email);
      setLocalEditors(updated);
      onEditorsChange(group.manual, updated);
    } catch { /* silencioso */ }
    finally { setRemoving(null); }
  };

  const saveManualCreator = async () => {
    const email = newManualCreator.trim();
    if (!email || !email.includes('@')) { setCreatorMsg('Correo inválido'); return; }
    setSavingManualCreator(true); setCreatorMsg('');
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: group.manual, new_creator_email: email }),
      });
      if (!res.ok) throw new Error();
      onManualCreatorChange(group.manual, email);
      setCreatorMsg('Responsable actualizado');
      setNewManualCreator('');
    } catch { setCreatorMsg('Error al cambiar responsable'); }
    finally { setSavingManualCreator(false); setTimeout(() => setCreatorMsg(''), 3000); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold dark:text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-[#71BF44]" /> Editores del manual
            </h2>
            <p className="text-xs text-neutral-500 mt-1 break-all">{group.manual}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">Solo aplica a artículos de Zoho Learn ({zohoArts.length})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-5">
          {/* Reasignar Responsable del manual (solo admin) */}
          {isAdmin && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                Reasignar Responsable del Manual
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newManualCreator}
                  onChange={e => { setNewManualCreator(e.target.value); setCreatorMsg(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveManualCreator())}
                  placeholder="nuevo.responsable@satcomla.com"
                  className="flex-1 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all"
                />
                <button
                  onClick={saveManualCreator}
                  disabled={savingManualCreator}
                  className="px-3 py-2 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {savingManualCreator ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {creatorMsg && <p className={`text-xs mt-1 ${creatorMsg.includes('actualizado') ? 'text-[#71BF44]' : 'text-red-500'}`}>{creatorMsg}</p>}
            </section>
          )}

          {/* Responsables */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
              Editores con acceso al manual
            </p>
            <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-2xl p-4 space-y-2">
              {localEditors.map(email => (
                <div key={email} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-blue-500">{email[0].toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">{email}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeEditor(email)}
                      disabled={removing === email}
                      className="p-1 rounded-lg text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Quitar editor del manual"
                    >
                      {removing === email
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <UserMinus className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              ))}
              {localEditors.length === 0 && (
                <p className="text-xs text-neutral-400 italic">Ningún editor adicional asignado a este manual.</p>
              )}
            </div>
          </section>

          {/* Agregar editor (solo admin) */}
          {isAdmin && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                Agregar editor al manual
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditor())}
                  placeholder="correo@satcomla.com"
                  className="flex-1 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all"
                />
                <button
                  onClick={addEditor}
                  disabled={adding}
                  className="px-3 py-2 rounded-xl bg-[#71BF44] hover:bg-[#60A339] text-white text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                </button>
              </div>
              {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
            </section>
          )}
        </div>

        <button onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RAGCollectionsTable() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? '';
  const isAdmin   = (session?.user as { role?: string })?.role === 'admin';

  const [data,             setData]             = useState<ManualGroup[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [expanded,         setExpanded]         = useState<Set<string>>(new Set());
  const [lastUpdated,      setLastUpdated]      = useState<Date | null>(null);
  const [updating,         setUpdating]         = useState<Set<string>>(new Set());
  const [updatingManual,   setUpdatingManual]   = useState<Set<string>>(new Set());
  const [syncing,          setSyncing]          = useState(false);
  const [syncMsg,          setSyncMsg]          = useState<string | null>(null);
  const [deleting,         setDeleting]         = useState<Set<string>>(new Set());
  const [deletingManual,   setDeletingManual]   = useState<Set<string>>(new Set());
  const [togglingActive,   setTogglingActive]   = useState<Set<string>>(new Set());
  const [togglingManualActive, setTogglingManualActive] = useState<Set<string>>(new Set());
  const [searchTerm,       setSearchTerm]       = useState('');
  const [refreshingArt,    setRefreshingArt]    = useState<Set<string>>(new Set());
  const [pdfModal,         setPdfModal]         = useState<Articulo | null>(null);
  const [detailsModal,     setDetailsModal]     = useState<Articulo | null>(null);
  const [manualModal,      setManualModal]      = useState<ManualGroup | null>(null);
  const [bulkUpdateModal,  setBulkUpdateModal]  = useState<ManualGroup | null>(null);
  const [onlyEditable,     setOnlyEditable]     = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [activeFilter,     setActiveFilter]     = useState<'all' | 'active' | 'inactive'>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [responsibles,     setResponsibles]     = useState<string[]>([]);
  const [filtersOpen,      setFiltersOpen]      = useState(false);
  const [openManualActions, setOpenManualActions] = useState<string | null>(null);


  // ── Carga de datos ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/db/rag-collections');
      if (!res.ok) throw new Error('Error al cargar colecciones');
      const json = await res.json();
      setData(json.data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Extraer responsables únicos ────────────────────────────────────
  useEffect(() => {
    const emails = new Set<string>();
    data.forEach(group => {
      group.articulos.forEach(art => {
        if (art.created_by) emails.add(art.created_by);
        if (art.allowed_editors) art.allowed_editors.forEach(e => emails.add(e));
      });
    });
    setResponsibles(Array.from(emails).sort());
  }, [data]);


  // ── Actualizar allowed_editors en estado local (artículo) ─────────
  const handleEditorsChange = (source_url: string, editors: string[]) => {
    setData(prev => prev.map(group => ({
      ...group,
      articulos: group.articulos.map(art =>
        art.source_url === source_url ? { ...art, allowed_editors: editors } : art
      ),
    })));
    setDetailsModal(prev => prev?.source_url === source_url ? { ...prev, allowed_editors: editors } : prev);
  };

  // ── Actualizar allowed_editors en estado local (manual, solo Zoho) ─
  const handleManualEditorsChange = (manual: string, editors: string[]) => {
    setData(prev => prev.map(group => {
      if (group.manual !== manual) return group;
      return {
        ...group,
        articulos: group.articulos.map(art =>
          art.source_url.includes('zohopublic') ? { ...art, allowed_editors: editors } : art
        ),
      };
    }));
  };

  const handleCreatorChange = (source_url: string, newCreator: string) => {
    setData(prev => prev.map(group => ({
      ...group,
      articulos: group.articulos.map(art =>
        art.source_url === source_url ? { ...art, created_by: newCreator } : art
      ),
    })));
    setDetailsModal(prev => prev?.source_url === source_url ? { ...prev, created_by: newCreator } : prev);
  };

  const handleManualCreatorChange = (manual: string, newCreator: string) => {
    setData(prev => prev.map(group => {
      if (group.manual !== manual) return group;
      return {
        ...group,
        articulos: group.articulos.map(art => ({ ...art, created_by: newCreator })),
      };
    }));
  };

  // ── Acordeón ───────────────────────────────────────────────────────
  const toggleManual = (manual: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(manual)) next.delete(manual); else next.add(manual);
      return next;
    });

  // ── Visibilidad individual ─────────────────────────────────────────
  const togglePublic = async (source_url: string, current: boolean) => {
    setData(prev => prev.map(g => ({ ...g, articulos: g.articulos.map(a => a.source_url === source_url ? { ...a, is_public: !current } : a) })));
    setUpdating(prev => new Set(prev).add(source_url));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_url, is_public: !current }) });
      if (!res.ok) throw new Error();
    } catch {
      setData(prev => prev.map(g => ({ ...g, articulos: g.articulos.map(a => a.source_url === source_url ? { ...a, is_public: current } : a) })));
    } finally {
      setUpdating(prev => { const n = new Set(prev); n.delete(source_url); return n; });
    }
  };

  // ── Visibilidad de manual completo ─────────────────────────────────
  const toggleManualPublic = async (manual: string, allPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const nv = !allPublic;
    setData(prev => prev.map(g => g.manual === manual ? { ...g, articulos: g.articulos.map(a => ({ ...a, is_public: nv })) } : g));
    setUpdatingManual(prev => new Set(prev).add(manual));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual, is_public: nv }) });
      if (!res.ok) throw new Error();
    } catch {
      setData(prev => prev.map(g => g.manual === manual ? { ...g, articulos: g.articulos.map(a => ({ ...a, is_public: allPublic })) } : g));
    } finally {
      setUpdatingManual(prev => { const n = new Set(prev); n.delete(manual); return n; });
    }
  };

  // ── Activar / Desactivar artículo (RAG) ───────────────────────────
  const toggleActive = async (source_url: string, current: boolean) => {
    setData(prev => prev.map(g => ({ ...g, articulos: g.articulos.map(a => a.source_url === source_url ? { ...a, is_active: !current } : a) })));
    setTogglingActive(prev => new Set(prev).add(source_url));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_url, is_active: !current }) });
      if (!res.ok) throw new Error();
    } catch {
      setData(prev => prev.map(g => ({ ...g, articulos: g.articulos.map(a => a.source_url === source_url ? { ...a, is_active: current } : a) })));
    } finally {
      setTogglingActive(prev => { const n = new Set(prev); n.delete(source_url); return n; });
    }
  };

  // ── Activar / Desactivar manual completo (solo admin) ─────────────
  const toggleManualActive = async (manual: string, allActive: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const nv = !allActive;
    setData(prev => prev.map(g => g.manual === manual ? { ...g, articulos: g.articulos.map(a => ({ ...a, is_active: nv })) } : g));
    setTogglingManualActive(prev => new Set(prev).add(manual));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual, is_active: nv }) });
      if (!res.ok) throw new Error();
    } catch {
      setData(prev => prev.map(g => g.manual === manual ? { ...g, articulos: g.articulos.map(a => ({ ...a, is_active: allActive })) } : g));
    } finally {
      setTogglingManualActive(prev => { const n = new Set(prev); n.delete(manual); return n; });
    }
  };

  // ── Eliminar artículo ──────────────────────────────────────────────
  const deleteArticulo = async (source_url: string) => {
    if (!window.confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
    setDeleting(prev => new Set(prev).add(source_url));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_url }) });
      if (!res.ok) throw new Error();
      setData(prev => prev.map(g => ({ ...g, articulos: g.articulos.filter(a => a.source_url !== source_url) })).filter(g => g.articulos.length > 0).map(g => ({ ...g, total: g.articulos.length })));
    } catch { /* silencioso */ }
    finally { setDeleting(prev => { const n = new Set(prev); n.delete(source_url); return n; }); }
  };

  // ── Eliminar manual ────────────────────────────────────────────────
  const deleteManual = async (manual: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el manual "${manual}" completo (${total} artículos)? Esta acción no se puede deshacer.`)) return;
    setDeletingManual(prev => new Set(prev).add(manual));
    try {
      const res = await fetch('/api/db/rag-collections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual }) });
      if (!res.ok) throw new Error();
      setData(prev => prev.filter(g => g.manual !== manual));
      setExpanded(prev => { const n = new Set(prev); n.delete(manual); return n; });
    } catch { /* silencioso */ }
    finally { setDeletingManual(prev => { const n = new Set(prev); n.delete(manual); return n; }); }
  };

  // ── Actualizar artículo ────────────────────────────────────────────
  const handleActualizar = async (art: Articulo) => {
    if (art.source_url.includes('zohopublic')) {
      setRefreshingArt(prev => new Set(prev).add(art.source_url));
      try {
        await fetch('https://sara.mysatcomla.com/webhook/ingesta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ 'Links de Zoho Learn': art.source_url, 'Correo del responsable': userEmail, submittedAt: new Date().toISOString(), formMode: 'production' }]),
        });
      } finally {
        setRefreshingArt(prev => { const n = new Set(prev); n.delete(art.source_url); return n; });
      }
    } else {
      setPdfModal(art);
    }
  };

  // ── Sincronizar base pública ───────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch('/api/db/sync-public', { method: 'POST' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSyncMsg(`${json.synced} chunk${json.synced !== 1 ? 's' : ''} sincronizados`);
    } catch { setSyncMsg('Error al sincronizar'); }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(null), 4000); }
  };

  // ── Estadísticas ───────────────────────────────────────────────────
  const totalArticulos  = data.reduce((s, m) => s + m.total, 0);
  const totalPublicos   = data.reduce((s, m) => s + m.articulos.filter(a => a.is_public).length, 0);
  const totalEditables  = data.reduce((s, m) => s + m.articulos.filter(a => a.can_edit).length, 0);
  const totalInactivos  = data.reduce((s, m) => s + m.articulos.filter(a => !a.is_active).length, 0);
  const totalActivos    = totalArticulos - totalInactivos;
  const totalPrivados   = totalArticulos - totalPublicos;
  const activeFiltersCount = [visibilityFilter !== 'all', activeFilter !== 'all', responsibleFilter !== 'all', onlyEditable].filter(Boolean).length;

  // ── Filtrado ───────────────────────────────────────────────────────
  const filteredData = data
    .map(group => {
      let arts = group.articulos;
      if (onlyEditable)  arts = arts.filter(a => a.can_edit);
      
      if (visibilityFilter !== 'all') {
        const isPublic = visibilityFilter === 'public';
        arts = arts.filter(a => a.is_public === isPublic);
      }
      if (activeFilter !== 'all') {
        const isActive = activeFilter === 'active';
        arts = arts.filter(a => a.is_active === isActive);
      }
      if (responsibleFilter !== 'all') {
        arts = arts.filter(a => 
          a.created_by === responsibleFilter || 
          a.allowed_editors.includes(responsibleFilter)
        );
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const manualMatch = group.manual.toLowerCase().includes(q);
        arts = manualMatch ? arts : arts.filter(a => a.articulo.toLowerCase().includes(q));
      }
      return { ...group, articulos: arts, total: arts.length };
    })
    .filter(group => group.articulos.length > 0);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {pdfModal     && <PdfUpdateModal art={pdfModal}     userEmail={userEmail} onClose={() => setPdfModal(null)} />}
      {detailsModal && <DetailsModal   art={detailsModal} isAdmin={isAdmin}     onClose={() => setDetailsModal(null)} onEditorsChange={handleEditorsChange} onCreatorChange={handleCreatorChange} />}
      {manualModal  && <ManualDetailsModal group={manualModal} isAdmin={isAdmin} onClose={() => setManualModal(null)} onEditorsChange={handleManualEditorsChange} onManualCreatorChange={handleManualCreatorChange} />}
      {bulkUpdateModal && <BulkUpdateModal group={bulkUpdateModal} userEmail={userEmail} onClose={() => setBulkUpdateModal(null)} />}

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
        {/* ── Header ── */}
        <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-6 py-5 space-y-4">
          {/* Row 1: Título + Acciones */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-[#131313] shadow-inner border border-neutral-200 dark:border-neutral-800 text-[#71BF44]">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold dark:text-white">Base de Conocimiento</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Manuales y artículos procesados en Supabase
                  {lastUpdated && <span className="ml-1 text-neutral-400">· {lastUpdated.toLocaleTimeString()}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {syncMsg && <span className="text-[11px] text-sky-400 font-medium px-2.5 py-1 rounded-lg bg-sky-400/10">{syncMsg}</span>}
              <button onClick={handleSync} disabled={syncing} title="Sincronizar base pública"
                className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-sky-400 hover:border-sky-400/30 hover:bg-sky-400/5 transition-all disabled:opacity-50">
                <Globe className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
              </button>
              <button onClick={fetchData} title="Recargar"
                className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-[#71BF44] hover:border-[#71BF44]/30 hover:bg-[#71BF44]/5 transition-all">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Row 2: Stats compactas */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800">
              <BookOpen className="w-3.5 h-3.5 text-[#71BF44]" />
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{data.length}</span>
              <span className="text-[10px] text-neutral-400">manuales</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{totalArticulos}</span>
              <span className="text-[10px] text-neutral-400">artículos</span>
            </div>
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{totalPublicos}</span>
              <span className="text-[10px] text-neutral-400">públicos</span>
              <span className="text-[10px] text-neutral-400 mx-0.5">·</span>
              <Lock className="w-3 h-3 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{totalPrivados}</span>
              <span className="text-[10px] text-neutral-400">privados</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800">
              <Power className="w-3.5 h-3.5 text-[#71BF44]" />
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{totalActivos}</span>
              <span className="text-[10px] text-neutral-400">activos</span>
              {totalInactivos > 0 && (
                <>
                  <span className="text-[10px] text-neutral-400 mx-0.5">·</span>
                  <Power className="w-3 h-3 text-red-400" />
                  <span className="text-xs font-bold text-red-400">{totalInactivos}</span>
                  <span className="text-[10px] text-red-400">inactivos</span>
                </>
              )}
            </div>
          </div>

          {/* Row 3: Buscador + Filtros dropdown */}
          <div className="flex items-center gap-3">
            {/* Buscador mejorado */}
            <div className="relative flex-1 max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-[#71BF44] transition-colors">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Buscar manuales o artículos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all shadow-sm placeholder:text-neutral-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown de filtros */}
            <div className="relative">
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  activeFiltersCount > 0
                    ? 'bg-[#71BF44]/10 border-[#71BF44]/30 text-[#71BF44]'
                    : 'bg-white dark:bg-[#131313] border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#71BF44] text-white text-[10px] font-bold flex items-center justify-center">{activeFiltersCount}</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>

              {filtersOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-72 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Visibilidad */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Visibilidad</span>
                      <div className="flex mt-2 bg-neutral-50 dark:bg-[#131313] rounded-lg p-1 border border-neutral-200 dark:border-neutral-800">
                        {[
                          { val: 'all' as const, label: 'Todos' },
                          { val: 'public' as const, label: 'Públicos', icon: <Globe className="w-3 h-3" /> },
                          { val: 'private' as const, label: 'Privados', icon: <Lock className="w-3 h-3" /> },
                        ].map(opt => (
                          <button key={opt.val} onClick={() => setVisibilityFilter(opt.val)}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                              visibilityFilter === opt.val ? 'text-[#71BF44] bg-[#71BF44]/10 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                            }`}>
                            {opt.icon}{opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Estado RAG */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Estado RAG</span>
                      <div className="flex mt-2 bg-neutral-50 dark:bg-[#131313] rounded-lg p-1 border border-neutral-200 dark:border-neutral-800">
                        {[
                          { val: 'all' as const, label: 'Todos', cls: 'text-[#71BF44] bg-[#71BF44]/10' },
                          { val: 'active' as const, label: 'Activos', icon: <Power className="w-3 h-3" />, cls: 'text-[#71BF44] bg-[#71BF44]/10' },
                          { val: 'inactive' as const, label: 'Inactivos', icon: <Power className="w-3 h-3" />, cls: 'text-red-500 bg-red-500/10' },
                        ].map(opt => (
                          <button key={opt.val} onClick={() => setActiveFilter(opt.val)}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                              activeFilter === opt.val ? (opt.cls || 'text-[#71BF44] bg-[#71BF44]/10 shadow-sm') : 'text-neutral-400 hover:text-neutral-600'
                            }`}>
                            {opt.icon}{opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Responsable */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Responsable</span>
                      <select
                        value={responsibleFilter}
                        onChange={(e) => setResponsibleFilter(e.target.value)}
                        className="w-full mt-2 bg-neutral-50 dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#71BF44] dark:text-neutral-300"
                      >
                        <option value="all">Todos los responsables</option>
                        {responsibles.map(email => (
                          <option key={email} value={email}>{email}</option>
                        ))}
                      </select>
                    </div>

                    {/* Solo editables */}
                    <label className="flex items-center gap-3 cursor-pointer px-1">
                      <div className={`w-8 h-4.5 rounded-full relative transition-colors ${onlyEditable ? 'bg-[#71BF44]' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                        onClick={() => setOnlyEditable(v => !v)}>
                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${onlyEditable ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">Solo mis permisos de edición</span>
                    </label>

                    {/* Limpiar filtros */}
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={() => {
                          setVisibilityFilter('all');
                          setActiveFilter('all');
                          setResponsibleFilter('all');
                          setOnlyEditable(false);
                        }}
                        className="w-full py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900/30"
                      >
                        <X className="w-3 h-3" /> Limpiar filtros
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>


        {/* ── Body ── */}
        <div className="p-4 max-h-[420px] overflow-y-auto scroll-smooth">
          {loading && data.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Cargando colecciones...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-500 text-sm">⚠️ {error}</div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-neutral-500 gap-3">
              <BookOpen className="w-10 h-10 opacity-30" />
              <p className="font-medium">No se encontraron resultados.</p>
              <p className="text-xs opacity-60">
                {onlyEditable ? 'No tienes permisos de edición en ningún artículo.' : searchTerm ? 'Prueba con otro término.' : 'Inicia una ingesta para poblar la base.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map(group => {
                const isOpen           = expanded.has(group.manual);
                const allPublic        = group.articulos.length > 0 && group.articulos.every(a => a.is_public);
                const allActive        = group.articulos.length > 0 && group.articulos.every(a => a.is_active);
                const isUpdating       = updatingManual.has(group.manual);
                const isTogglingActive = togglingManualActive.has(group.manual);
                const hasZoho          = group.articulos.some(a => a.source_url.includes('zohopublic'));
                const canEditManual    = isAdmin || (group.articulos.length > 0 && group.articulos.every(a => a.can_edit));

                return (
                  <div key={group.manual} className="border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden">
                    {/* Cabecera de manual */}
                    <div onClick={() => toggleManual(group.manual)}
                      className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] hover:bg-neutral-100 dark:hover:bg-[#222] cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[#71BF44]/10"><BookOpen className="w-4 h-4 text-[#71BF44]" /></div>
                        <span className="text-sm font-semibold dark:text-white">{group.manual}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">{group.total} art.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status badges compactos */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${allPublic ? 'bg-sky-400/15 text-sky-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                          {allPublic ? 'Público' : 'Privado'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${allActive ? 'bg-[#71BF44]/15 text-[#71BF44]' : 'bg-red-500/10 text-red-400'}`}>
                          {allActive ? 'Activo' : 'Inactivo'}
                        </span>

                        {/* Dropdown de acciones */}
                        <div className="relative">
                          <button
                            onClick={e => { e.stopPropagation(); setOpenManualActions(prev => prev === group.manual ? null : group.manual); }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            title="Acciones del manual"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openManualActions === group.manual && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={e => { e.stopPropagation(); setOpenManualActions(null); }} />
                              <div className="absolute right-0 top-full mt-1 z-40 w-56 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
                                onClick={e => e.stopPropagation()}>
                                {/* Visibilidad */}
                                {canEditManual && (
                                  <button
                                    onClick={e => { toggleManualPublic(group.manual, allPublic, e); setOpenManualActions(null); }}
                                    disabled={isUpdating}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors disabled:opacity-50"
                                  >
                                    {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400" /> : allPublic ? <Lock className="w-3.5 h-3.5 text-neutral-400" /> : <Globe className="w-3.5 h-3.5 text-sky-400" />}
                                    {allPublic ? 'Hacer todo privado' : 'Hacer todo público'}
                                  </button>
                                )}
                                {/* RAG (solo admin) */}
                                {isAdmin && (
                                  <button
                                    onClick={e => { toggleManualActive(group.manual, allActive, e); setOpenManualActions(null); }}
                                    disabled={isTogglingActive}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors disabled:opacity-50"
                                  >
                                    {isTogglingActive ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400" /> : <Power className={`w-3.5 h-3.5 ${allActive ? 'text-red-400' : 'text-[#71BF44]'}`} />}
                                    {allActive ? 'Desactivar del RAG' : 'Activar en RAG'}
                                  </button>
                                )}
                                {/* Actualizar todo (solo admin) */}
                                {isAdmin && (
                                  <button
                                    onClick={() => { setBulkUpdateModal(group); setOpenManualActions(null); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                    Actualizar todo el manual
                                  </button>
                                )}
                                {/* Editores (solo admin + zoho) */}
                                {isAdmin && hasZoho && (
                                  <button
                                    onClick={() => { setManualModal(group); setOpenManualActions(null); }}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors"
                                  >
                                    <Info className="w-3.5 h-3.5 text-blue-400" />
                                    Gestionar editores
                                  </button>
                                )}
                                {/* Separador + Eliminar */}
                                {canEditManual && (
                                  <>
                                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                                    <button
                                      onClick={e => { deleteManual(group.manual, group.total, e); setOpenManualActions(null); }}
                                      disabled={deletingManual.has(group.manual)}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                    >
                                      {deletingManual.has(group.manual) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      Eliminar manual
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />}
                      </div>
                    </div>

                    {/* Artículos */}
                    {isOpen && (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                        {/* Cabecera tabla */}
                        <div className="grid grid-cols-12 px-4 py-2 bg-white dark:bg-[#131313]">
                          <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Artículo</span>
                          <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Responsable</span>
                          <span className="col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Visibilidad</span>
                          <span className="col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Estado RAG</span>
                          <span className="col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Acciones</span>
                        </div>

                        {group.articulos.map(art => {
                          const isVizUpdating     = updating.has(art.source_url);
                          const isActiveToggling  = togglingActive.has(art.source_url);
                          const isRefreshing      = refreshingArt.has(art.source_url);
                          const isZoho            = art.source_url.includes('zohopublic');
                          const updateTooltip     = !art.can_edit
                            ? 'Sin permisos para actualizar este artículo'
                            : isZoho ? 'Volver a ingestar desde Zoho Learn' : 'Subir nuevo PDF para este artículo';
                          const activeTooltip     = !art.can_edit
                            ? 'Sin permisos para cambiar el estado de este artículo'
                            : art.is_active ? 'Desactivar del RAG' : 'Activar en el RAG';

                          return (
                            <div key={art.articulo}
                              className={`grid grid-cols-12 px-4 py-2.5 transition-colors items-center ${art.is_active ? 'bg-white dark:bg-[#131313] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A]' : 'bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/5 dark:hover:bg-red-500/10'}`}>
                              {/* Artículo */}
                              <div className="col-span-3 flex items-center gap-2">
                                <FileText className={`w-3.5 h-3.5 shrink-0 ${art.is_active ? 'text-neutral-300 dark:text-neutral-600' : 'text-red-400/50'}`} />
                                <span className={`text-sm font-medium truncate ${art.is_active ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500 line-through'}`}>{art.articulo}</span>
                              </div>

                              {/* Responsable */}
                              <div className="col-span-3 flex items-center gap-1.5 truncate pr-2">
                                <div className="w-4 h-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700">
                                   <span className="text-[8px] font-bold text-neutral-500">{(art.created_by || 'S')[0].toUpperCase()}</span>
                                </div>
                                <span className="text-[11px] text-neutral-500 truncate" title={art.created_by || 'Sistema'}>
                                  {(art.created_by || 'Sistema').split('@')[0]}
                                </span>
                              </div>

                              {/* Visibilidad */}
                              <div className="col-span-2">
                                <button
                                  onClick={() => art.can_edit && togglePublic(art.source_url, art.is_public)}
                                  disabled={isVizUpdating || !art.can_edit}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                                    !art.can_edit
                                      ? 'opacity-40 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                                      : art.is_public
                                        ? 'bg-sky-400/15 text-sky-400 hover:bg-sky-400/25'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200'
                                  }`}
                                  title={!art.can_edit ? 'Sin permisos para cambiar la visibilidad' : art.is_public ? 'Hacer privado' : 'Hacer público'}>
                                  {isVizUpdating ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : art.is_public ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                  {art.is_public ? 'Público' : 'Privado'}
                                </button>
                              </div>

                              {/* Estado RAG */}
                              <div className="col-span-2">
                                <button
                                  onClick={() => art.can_edit && toggleActive(art.source_url, art.is_active)}
                                  disabled={isActiveToggling || !art.can_edit}
                                  title={activeTooltip}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed ${
                                    !art.can_edit
                                      ? 'opacity-40 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                                      : art.is_active
                                        ? 'bg-[#71BF44]/15 text-[#71BF44] hover:bg-[#71BF44]/25'
                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                  }`}>
                                  {isActiveToggling
                                    ? <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    : <Power className="w-2.5 h-2.5" />
                                  }
                                  {art.is_active ? 'Activo' : 'Inactivo'}
                                </button>
                              </div>

                              {/* Acciones: Ver | Actualizar | Detalles | Eliminar */}
                              <div className="col-span-2 flex justify-end items-center gap-2">
                                <a href={art.source_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center text-neutral-400 hover:text-[#71BF44] transition-colors" title="Ver fuente">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>

                                <button onClick={() => handleActualizar(art)} disabled={!art.can_edit || isRefreshing} title={updateTooltip}
                                  className={`flex items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${art.can_edit ? 'text-neutral-400 hover:text-[#71BF44]' : 'text-neutral-300 dark:text-neutral-600'}`}>
                                  {isRefreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                </button>

                                <button onClick={() => setDetailsModal(art)}
                                  className="flex items-center text-neutral-400 hover:text-blue-400 transition-colors" title="Ver detalles y responsables">
                                  <Info className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => art.can_edit && deleteArticulo(art.source_url)}
                                  disabled={deleting.has(art.source_url) || !art.can_edit}
                                  className={`flex items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${art.can_edit ? 'text-neutral-400 hover:text-red-500' : 'text-neutral-300 dark:text-neutral-600'}`}
                                  title={!art.can_edit ? 'Sin permisos para eliminar este artículo' : 'Eliminar artículo'}
                                >
                                  {deleting.has(art.source_url) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// ── Componentes Pequeños ──────────────────────────────────────────────────────
// (FilterButton eliminado - los filtros ahora están inline en el dropdown)
