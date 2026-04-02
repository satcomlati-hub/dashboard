'use client';
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, RefreshCw, BookMarked, FileText, Globe, Lock, Trash2 } from 'lucide-react';

interface Articulo {
  articulo: string;
  source_url: string;
  created_at: string;
  created_by: string | null;
  is_public: boolean;
}

interface ManualGroup {
  manual: string;
  total: number;
  articulos: Articulo[];
}

function formatFecha(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function RAGCollectionsTable() {
  const [data, setData] = useState<ManualGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [updatingManual, setUpdatingManual] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deletingManual, setDeletingManual] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/db/rag-collections');
      if (!res.ok) throw new Error('Error al cargar colecciones');
      const json = await res.json();
      setData(json.data || []);
      setLastUpdated(new Date());
      setError(null);
      if (json.data?.length > 0) {
        setExpanded(prev => {
          if (prev.size === 0) {
            return new Set(json.data.map((m: ManualGroup) => m.manual));
          }
          return prev;
        });
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

  const toggleManual = (manual: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(manual)) next.delete(manual);
      else next.add(manual);
      return next;
    });
  };

  const togglePublic = async (source_url: string, current: boolean) => {
    // Actualización optimista
    setData(prev => prev.map(group => ({
      ...group,
      articulos: group.articulos.map(art =>
        art.source_url === source_url ? { ...art, is_public: !current } : art
      ),
    })));
    setUpdating(prev => new Set(prev).add(source_url));

    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url, is_public: !current }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revertir si falla
      setData(prev => prev.map(group => ({
        ...group,
        articulos: group.articulos.map(art =>
          art.source_url === source_url ? { ...art, is_public: current } : art
        ),
      })));
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(source_url);
        return next;
      });
    }
  };

  const toggleManualPublic = async (manual: string, allPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !allPublic;
    setData(prev => prev.map(group =>
      group.manual === manual
        ? { ...group, articulos: group.articulos.map(art => ({ ...art, is_public: newValue })) }
        : group
    ));
    setUpdatingManual(prev => new Set(prev).add(manual));
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual, is_public: newValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setData(prev => prev.map(group =>
        group.manual === manual
          ? { ...group, articulos: group.articulos.map(art => ({ ...art, is_public: allPublic })) }
          : group
      ));
    } finally {
      setUpdatingManual(prev => { const next = new Set(prev); next.delete(manual); return next; });
    }
  };

  const deleteArticulo = async (source_url: string) => {
    if (!window.confirm('¿Eliminar este artículo de la base de conocimiento? Esta acción no se puede deshacer.')) return;
    setDeleting(prev => new Set(prev).add(source_url));
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url }),
      });
      if (!res.ok) throw new Error();
      setData(prev => prev
        .map(group => ({ ...group, articulos: group.articulos.filter(a => a.source_url !== source_url) }))
        .filter(group => group.articulos.length > 0)
        .map(group => ({ ...group, total: group.articulos.length }))
      );
    } catch {
      // error silencioso — el artículo no se elimina del estado
    } finally {
      setDeleting(prev => { const next = new Set(prev); next.delete(source_url); return next; });
    }
  };

  const deleteManual = async (manual: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el manual "${manual}" completo (${total} artículos) de la base de conocimiento? Esta acción no se puede deshacer.`)) return;
    setDeletingManual(prev => new Set(prev).add(manual));
    try {
      const res = await fetch('/api/db/rag-collections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual }),
      });
      if (!res.ok) throw new Error();
      setData(prev => prev.filter(g => g.manual !== manual));
      setExpanded(prev => { const next = new Set(prev); next.delete(manual); return next; });
    } catch {
      // error silencioso
    } finally {
      setDeletingManual(prev => { const next = new Set(prev); next.delete(manual); return next; });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/db/sync-public', { method: 'POST' });
      if (!res.ok) throw new Error('Error al sincronizar');
      const json = await res.json();
      setSyncMsg(`${json.synced} chunk${json.synced !== 1 ? 's' : ''} sincronizados`);
      setTimeout(() => setSyncMsg(null), 4000);
    } catch {
      setSyncMsg('Error al sincronizar');
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const totalArticulos = data.reduce((sum, m) => sum + m.total, 0);
  const totalPublicos = data.reduce((sum, m) => sum + m.articulos.filter(a => a.is_public).length, 0);

  return (
    <div className="group/table bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-[#131313] shadow-inner border border-neutral-200 dark:border-neutral-800 text-[#71BF44]">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-white flex items-center gap-2 flex-wrap">
                Base de Conocimiento
                <span className="px-2 py-0.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] text-[10px] font-bold uppercase tracking-wider">
                  {data.length} manual{data.length !== 1 ? 'es' : ''}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                  {totalArticulos} artículo{totalArticulos !== 1 ? 's' : ''}
                </span>
                {totalPublicos > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    {totalPublicos} público{totalPublicos !== 1 ? 's' : ''}
                  </span>
                )}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                Manuales y artículos procesados en Supabase
                {lastUpdated && (
                  <span className="ml-2 text-[10px] text-neutral-400">
                    · actualizado {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncMsg && (
              <span className="text-[11px] text-sky-400 font-medium px-2 py-1 rounded-lg bg-sky-400/10">
                {syncMsg}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-sky-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
              title="Sincronizar base pública"
            >
              <Globe className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            </button>
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 max-h-[420px] overflow-y-auto scroll-smooth">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-neutral-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Cargando colecciones...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-red-500 text-sm">
            ⚠️ {error}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-neutral-500 gap-3">
            <BookOpen className="w-10 h-10 opacity-30" />
            <p className="font-medium">No hay manuales procesados aún.</p>
            <p className="text-xs opacity-60">Inicia una ingesta para poblar la base de conocimiento.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((group) => {
              const isOpen = expanded.has(group.manual);
              const allPublic = group.articulos.length > 0 && group.articulos.every(a => a.is_public);
              const isManualUpdating = updatingManual.has(group.manual);
              return (
                <div key={group.manual} className="border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  {/* Manual header (acordeón) */}
                  <div
                    onClick={() => toggleManual(group.manual)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] hover:bg-neutral-100 dark:hover:bg-[#222] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-[#71BF44]/10">
                        <BookOpen className="w-4 h-4 text-[#71BF44]" />
                      </div>
                      <span className="text-sm font-semibold dark:text-white text-left">{group.manual}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                        {group.total} art.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleManualPublic(group.manual, allPublic, e)}
                        disabled={isManualUpdating}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-60 ${
                          allPublic
                            ? 'bg-sky-400/15 text-sky-400 hover:bg-sky-400/25'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                        title={allPublic ? 'Hacer todo privado' : 'Hacer todo público'}
                      >
                        {isManualUpdating
                          ? <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          : allPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />
                        }
                        {allPublic ? 'Todo público' : 'Todo privado'}
                      </button>
                      <button
                        onClick={(e) => deleteManual(group.manual, group.total, e)}
                        disabled={deletingManual.has(group.manual)}
                        className="opacity-0 group-hover/table:opacity-100 transition-opacity flex items-center text-neutral-400 hover:text-red-500 disabled:opacity-50 p-1"
                        title="Eliminar manual completo"
                      >
                        {deletingManual.has(group.manual)
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                      }
                    </div>
                  </div>

                  {/* Artículos */}
                  {isOpen && (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                      {/* Cabecera de tabla */}
                      <div className="grid grid-cols-12 px-4 py-2 bg-white dark:bg-[#131313]">
                        <span className="col-span-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Artículo</span>
                        <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Fecha de Ingesta</span>
                        <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Visibilidad</span>
                        <span className="col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Acciones</span>
                      </div>
                      {group.articulos.map((art) => {
                        const isUpdating = updating.has(art.source_url);
                        return (
                          <div
                            key={art.articulo}
                            className="grid grid-cols-12 px-4 py-2.5 bg-white dark:bg-[#131313] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors items-center"
                          >
                            <div className="col-span-4 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
                              <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium truncate">
                                {art.articulo}
                              </span>
                            </div>
                            <div className="col-span-3 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatFecha(art.created_at)}
                            </div>
                            <div className="col-span-3">
                              <button
                                onClick={() => togglePublic(art.source_url, art.is_public)}
                                disabled={isUpdating}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-60 ${
                                  art.is_public
                                    ? 'bg-sky-400/15 text-sky-400 hover:bg-sky-400/25'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                }`}
                                title={art.is_public ? 'Hacer privado' : 'Hacer público'}
                              >
                                {isUpdating ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : art.is_public ? (
                                  <Globe className="w-2.5 h-2.5" />
                                ) : (
                                  <Lock className="w-2.5 h-2.5" />
                                )}
                                {art.is_public ? 'Público' : 'Privado'}
                              </button>
                            </div>
                            <div className="col-span-2 flex justify-end items-center gap-2 opacity-0 group-hover/table:opacity-100 transition-opacity">
                              <a
                                href={art.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 hover:text-[#71BF44] transition-colors"
                                title="Ver fuente"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ver
                              </a>
                              <button
                                onClick={() => deleteArticulo(art.source_url)}
                                disabled={deleting.has(art.source_url)}
                                className="flex items-center text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Eliminar artículo"
                              >
                                {deleting.has(art.source_url)
                                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                                  : <Trash2 className="w-3 h-3" />
                                }
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
  );
}
