'use client';
import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, RefreshCw, BookMarked, FileText } from 'lucide-react';

interface Articulo {
  articulo: string;
  source_url: string;
  created_at: string;
  created_by: string | null;
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

  const fetchData = async () => {
    try {
      const res = await fetch('/api/db/rag-collections');
      if (!res.ok) throw new Error('Error al cargar colecciones');
      const json = await res.json();
      setData(json.data || []);
      setLastUpdated(new Date());
      setError(null);
      // Expandir todos por defecto si es la primera carga
      if (json.data?.length > 0) {
        setExpanded(prev => {
          if (prev.size === 0) {
            return new Set(json.data.map((m: ManualGroup) => m.manual));
          }
          return prev;
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleManual = (manual: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(manual)) next.delete(manual);
      else next.add(manual);
      return next;
    });
  };

  const totalArticulos = data.reduce((sum, m) => sum + m.total, 0);

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-[#131313] shadow-inner border border-neutral-200 dark:border-neutral-800 text-[#71BF44]">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-white flex items-center gap-2">
                Base de Conocimiento
                <span className="px-2 py-0.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] text-[10px] font-bold uppercase tracking-wider">
                  {data.length} manual{data.length !== 1 ? 'es' : ''}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                  {totalArticulos} artículo{totalArticulos !== 1 ? 's' : ''}
                </span>
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
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
              return (
                <div key={group.manual} className="border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  {/* Manual header (acordeón) */}
                  <button
                    onClick={() => toggleManual(group.manual)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] hover:bg-neutral-100 dark:hover:bg-[#222] transition-colors"
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
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                    }
                  </button>

                  {/* Artículos */}
                  {isOpen && (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                      {/* Cabecera de tabla */}
                      <div className="grid grid-cols-12 px-4 py-2 bg-white dark:bg-[#131313]">
                        <span className="col-span-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Artículo</span>
                        <span className="col-span-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Fecha de Ingesta</span>
                        <span className="col-span-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Fuente</span>
                      </div>
                      {group.articulos.map((art) => (
                        <div
                          key={art.articulo}
                          className="grid grid-cols-12 px-4 py-2.5 bg-white dark:bg-[#131313] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors items-center group"
                        >
                          <div className="col-span-5 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium truncate">
                              {art.articulo}
                            </span>
                          </div>
                          <div className="col-span-4 text-xs text-neutral-500 dark:text-neutral-400">
                            {formatFecha(art.created_at)}
                          </div>
                          <div className="col-span-3 flex justify-end">
                            <a
                              href={art.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 hover:text-[#71BF44] transition-colors opacity-0 group-hover:opacity-100"
                              title="Ver fuente"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver
                            </a>
                          </div>
                        </div>
                      ))}
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
