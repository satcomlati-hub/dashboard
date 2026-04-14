'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  BookOpen, ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  BookMarked, FileText, Globe, Lock, Trash2, UploadCloud, X, Upload,
  Info, UserPlus, UserMinus, Filter,
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

// ─── Modal: Detalles del artículo ─────────────────────────────────────────────

function DetailsModal({ art, isAdmin, onClose, onEditorsChange }: {
  art: Articulo; isAdmin: boolean;
  onClose: () => void;
  onEditorsChange: (source_url: string, editors: string[]) => void;
}) {
  const [localEditors, setLocalEditors] = useState<string[]>(art.allowed_editors);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addError, setAddError] = useState('');

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
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#71BF44]/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#71BF44]">{(art.created_by || 'S')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">{art.created_by || 'Sistema'}</span>
                </div>
                <span className="text-[9px] font-bold uppercase text-[#71BF44] bg-[#71BF44]/10 px-2 py-0.5 rounded-full">Creador</span>
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
  const [searchTerm,       setSearchTerm]       = useState('');
  const [refreshingArt,    setRefreshingArt]    = useState<Set<string>>(new Set());
  const [pdfModal,         setPdfModal]         = useState<Articulo | null>(null);
  const [detailsModal,     setDetailsModal]     = useState<Articulo | null>(null);
  const [onlyEditable,     setOnlyEditable]     = useState(false);

  // ── Carga de datos ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/db/rag-collections');
      if (!res.ok) throw new Error('Error al cargar colecciones');
      const json = await res.json();
      setData(json.data || []);
      setLastUpdated(new Date());
      setError(null);
      if (json.data?.length > 0) {
        setExpanded(prev => prev.size === 0
          ? new Set(json.data.map((m: ManualGroup) => m.manual))
          : prev
        );
      }
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

  // ── Actualizar allowed_editors en estado local ─────────────────────
  const handleEditorsChange = (source_url: string, editors: string[]) => {
    setData(prev => prev.map(group => ({
      ...group,
      articulos: group.articulos.map(art =>
        art.source_url === source_url ? { ...art, allowed_editors: editors } : art
      ),
    })));
    // Actualizar también el modal de detalles si está abierto
    setDetailsModal(prev => prev?.source_url === source_url ? { ...prev, allowed_editors: editors } : prev);
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
  const totalArticulos = data.reduce((s, m) => s + m.total, 0);
  const totalPublicos  = data.reduce((s, m) => s + m.articulos.filter(a => a.is_public).length, 0);
  const totalEditables = data.reduce((s, m) => s + m.articulos.filter(a => a.can_edit).length, 0);

  // ── Filtrado ───────────────────────────────────────────────────────
  const filteredData = data
    .map(group => {
      let arts = group.articulos;
      if (onlyEditable)  arts = arts.filter(a => a.can_edit);
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
      {pdfModal     && <PdfUpdateModal art={pdfModal}    userEmail={userEmail} onClose={() => setPdfModal(null)} />}
      {detailsModal && <DetailsModal   art={detailsModal} isAdmin={isAdmin}    onClose={() => setDetailsModal(null)} onEditorsChange={handleEditorsChange} />}

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
        {/* ── Header ── */}
        <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#131313] shadow-inner border border-neutral-200 dark:border-neutral-800 text-[#71BF44]">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold dark:text-white flex items-center gap-2 flex-wrap">
                  Base de Conocimiento
                  <span className="px-2 py-0.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] text-[10px] font-bold uppercase tracking-wider">{data.length} manuales</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">{totalArticulos} artículos</span>
                  {totalPublicos > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" />{totalPublicos} públicos
                    </span>
                  )}
                  {totalEditables > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                      {totalEditables} editables
                    </span>
                  )}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Manuales y artículos procesados en Supabase
                  {lastUpdated && <span className="ml-2 text-[10px] text-neutral-400">· {lastUpdated.toLocaleTimeString()}</span>}
                </p>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Buscador */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-[#71BF44] transition-colors">
                  <BookMarked className="w-3.5 h-3.5" />
                </div>
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-44 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/30 focus:border-[#71BF44] dark:text-white transition-all shadow-sm" />
              </div>

              {/* Filtro: solo editables */}
              <button
                onClick={() => setOnlyEditable(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  onlyEditable
                    ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                title={onlyEditable ? 'Mostrar todos' : 'Solo donde puedo editar'}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wide">
                  {onlyEditable ? 'Mis permisos' : 'Todos'}
                </span>
              </button>

              {syncMsg && <span className="text-[11px] text-sky-400 font-medium px-2 py-1 rounded-lg bg-sky-400/10">{syncMsg}</span>}
              <button onClick={handleSync} disabled={syncing} title="Sincronizar base pública"
                className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-sky-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50">
                <Globe className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
              </button>
              <button onClick={fetchData} title="Recargar"
                className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
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
                const isOpen     = expanded.has(group.manual);
                const allPublic  = group.articulos.length > 0 && group.articulos.every(a => a.is_public);
                const isUpdating = updatingManual.has(group.manual);

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
                        <button onClick={e => toggleManualPublic(group.manual, allPublic, e)} disabled={isUpdating}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-60 ${allPublic ? 'bg-sky-400/15 text-sky-400 hover:bg-sky-400/25' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200'}`}
                          title={allPublic ? 'Hacer todo privado' : 'Hacer todo público'}>
                          {isUpdating ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : allPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                          {allPublic ? 'Todo público' : 'Todo privado'}
                        </button>
                        <button onClick={e => deleteManual(group.manual, group.total, e)} disabled={deletingManual.has(group.manual)}
                          className="text-neutral-400 hover:text-red-500 disabled:opacity-50 p-1" title="Eliminar manual completo">
                          {deletingManual.has(group.manual) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />}
                      </div>
                    </div>

                    {/* Artículos */}
                    {isOpen && (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                        {/* Cabecera tabla */}
                        <div className="grid grid-cols-12 px-4 py-2 bg-white dark:bg-[#131313]">
                          <span className="col-span-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Artículo</span>
                          <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Visibilidad</span>
                          <span className="col-span-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Acciones</span>
                        </div>

                        {group.articulos.map(art => {
                          const isVizUpdating  = updating.has(art.source_url);
                          const isRefreshing   = refreshingArt.has(art.source_url);
                          const isZoho         = art.source_url.includes('zohopublic');
                          const updateTooltip  = !art.can_edit
                            ? 'Sin permisos para actualizar este artículo'
                            : isZoho ? 'Volver a ingestar desde Zoho Learn' : 'Subir nuevo PDF para este artículo';

                          return (
                            <div key={art.articulo}
                              className="grid grid-cols-12 px-4 py-2.5 bg-white dark:bg-[#131313] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors items-center">
                              {/* Artículo */}
                              <div className="col-span-5 flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
                                <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium truncate">{art.articulo}</span>
                              </div>

                              {/* Visibilidad */}
                              <div className="col-span-3">
                                <button onClick={() => togglePublic(art.source_url, art.is_public)} disabled={isVizUpdating}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-60 ${art.is_public ? 'bg-sky-400/15 text-sky-400 hover:bg-sky-400/25' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200'}`}
                                  title={art.is_public ? 'Hacer privado' : 'Hacer público'}>
                                  {isVizUpdating ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : art.is_public ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                  {art.is_public ? 'Público' : 'Privado'}
                                </button>
                              </div>

                              {/* Acciones: Ver | Actualizar | Detalles | Eliminar */}
                              <div className="col-span-4 flex justify-end items-center gap-2">
                                <a href={art.source_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 hover:text-[#71BF44] transition-colors" title="Ver fuente">
                                  <ExternalLink className="w-3 h-3" /> Ver
                                </a>

                                <button onClick={() => handleActualizar(art)} disabled={!art.can_edit || isRefreshing} title={updateTooltip}
                                  className={`flex items-center gap-1 text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${art.can_edit ? 'text-neutral-400 hover:text-[#71BF44]' : 'text-neutral-300 dark:text-neutral-600'}`}>
                                  {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                                  {isRefreshing ? 'Enviando' : 'Actualizar'}
                                </button>

                                <button onClick={() => setDetailsModal(art)}
                                  className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 hover:text-blue-400 transition-colors" title="Ver detalles y responsables">
                                  <Info className="w-3 h-3" /> Detalles
                                </button>

                                <button onClick={() => deleteArticulo(art.source_url)} disabled={deleting.has(art.source_url)}
                                  className="flex items-center text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Eliminar artículo">
                                  {deleting.has(art.source_url) ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
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
