'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Clock, Globe, Key, FileText, Loader2, AlertCircle, Search, X, Filter, Copy, Check } from 'lucide-react';

interface Evento {
  fecha_ecuador: string;
  key: string;
  num_eventos: number | string;
  pais: string;
  detalle_evento: string;
}

interface MonitoreoWidgetProps {
  initialData?: Evento[];
  initialLoading?: boolean;
  initialError?: string | null;
  selectedDate?: string | null; // From chart click
  onClearDateFilter?: () => void;
}

export default function MonitoreoWidget({ initialData, initialLoading = false, initialError = null, selectedDate, onClearDateFilter }: MonitoreoWidgetProps) {
  const [data, setData] = useState<Evento[]>(initialData || []);
  const [loading, setLoading] = useState(initialData ? false : initialLoading);
  const [error, setError] = useState<string | null>(initialError);

  // Column filters state
  const [filterFecha, setFilterFecha] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [filterPais, setFilterPais] = useState('');
  const [filterDetalle, setFilterDetalle] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Priority: selectedDate from chart if present (though user might want to stack filters)
    if (selectedDate) {
      result = result.filter(item => item.fecha_ecuador === selectedDate);
    }

    // Manual filters
    if (filterFecha) result = result.filter(item => item.fecha_ecuador.toLowerCase().includes(filterFecha.toLowerCase()));
    if (filterKey) result = result.filter(item => item.key.toLowerCase().includes(filterKey.toLowerCase()));
    if (filterPais) result = result.filter(item => item.pais.toLowerCase().includes(filterPais.toLowerCase()));
    if (filterDetalle) result = result.filter(item => item.detalle_evento.toLowerCase().includes(filterDetalle.toLowerCase()));

    return result;
  }, [data, selectedDate, filterFecha, filterKey, filterPais, filterDetalle]);

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px] max-h-[80vh] lg:max-h-none lg:h-[600px]">
      <div className="p-4 lg:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-white dark:bg-[#131313] z-10 transition-colors gap-4">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#71BF44]" />
            Bitácora de Eventos
          </h3>
          {selectedDate && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-xs font-semibold animate-in zoom-in duration-300 border border-blue-200 dark:border-blue-800">
              Filtro: {selectedDate}
              <button onClick={onClearDateFilter} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {(filterFecha || filterKey || filterPais || filterDetalle) && (
            <div className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filtros activos
            </div>
          )}
        </div>
        <span className="text-xs font-medium bg-[#71BF44]/10 text-[#71BF44] dark:bg-[#71BF44]/20 px-2.5 py-1 rounded-full w-fit">
          {filteredData.length} / {data.length} Eventos
        </span>
      </div>

      <div className="flex-1 overflow-auto p-0 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#71BF44]" />
            <p className="text-sm font-medium">Cargando eventos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500 gap-3 p-6 text-center">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-neutral-500 gap-3">
            <Activity className="w-8 h-8 opacity-20" />
            <p className="text-sm font-medium">No hay eventos registrados</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-[#1a1a1a] shadow-sm z-10">
              <tr>
                <th className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <Clock className="w-3.5 h-3.5"/> Fecha (EC)
                    </div>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="Filtrar..."
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        className="w-full h-8 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded px-7 py-1 text-xs focus:ring-1 focus:ring-[#71BF44] focus:border-[#71BF44] outline-none transition-all placeholder:text-neutral-400"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <Key className="w-3.5 h-3.5"/> Key
                    </div>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="Filtrar..."
                        value={filterKey}
                        onChange={(e) => setFilterKey(e.target.value)}
                        className="w-full h-8 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded px-7 py-1 text-xs focus:ring-1 focus:ring-[#71BF44] focus:border-[#71BF44] outline-none transition-all placeholder:text-neutral-400"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 text-right w-[100px]">
                  <div className="flex items-center gap-1.5 justify-end text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <Activity className="w-3.5 h-3.5"/> Eventos
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <Globe className="w-3.5 h-3.5"/> País
                    </div>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="Filtrar..."
                        value={filterPais}
                        onChange={(e) => setFilterPais(e.target.value)}
                        className="w-full h-8 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded px-7 py-1 text-xs focus:ring-1 focus:ring-[#71BF44] focus:border-[#71BF44] outline-none transition-all placeholder:text-neutral-400"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex-1 min-w-[300px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <FileText className="w-3.5 h-3.5"/> Detalle Evento
                    </div>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="Buscar en descripción..."
                        value={filterDetalle}
                        onChange={(e) => setFilterDetalle(e.target.value)}
                        className="w-full h-8 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded px-7 py-1 text-xs focus:ring-1 focus:ring-[#71BF44] focus:border-[#71BF44] outline-none transition-all placeholder:text-neutral-400"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-20 text-center text-neutral-500 dark:text-neutral-600 text-sm">
                    No se encontraron resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => (
                  <tr key={i} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/20 transition-colors ${selectedDate && row.fecha_ecuador === selectedDate ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-3.5 text-sm text-neutral-700 dark:text-neutral-300 font-mono tracking-tighter">
                      {(() => {
                        const d = new Date(row.fecha_ecuador);
                        if (!isNaN(d.getTime())) {
                          const dd = String(d.getDate()).padStart(2, '0');
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const yyyy = d.getFullYear();
                          const hh = String(d.getHours()).padStart(2, '0');
                          const min = String(d.getMinutes()).padStart(2, '0');
                          const ss = String(d.getSeconds()).padStart(2, '0');
                          return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
                        }
                        return row.fecha_ecuador;
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-neutral-900 dark:text-white">{row.key}</td>
                    <td className="px-4 py-3.5 text-sm text-[#71BF44] font-bold text-right">{row.num_eventos}</td>
                    <td className="px-4 py-3.5 text-sm">
                      <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-700 dark:text-neutral-300 text-xs font-medium">
                        {row.pais}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-neutral-600 dark:text-neutral-400 group/cell relative">
                      <div className="flex items-center justify-between gap-3 group">
                        <span className="truncate max-w-[400px]" title={row.detalle_evento}>
                          {row.detalle_evento}
                        </span>
                        <button 
                          onClick={() => handleCopy(row.detalle_evento, i)}
                          className={`flex-shrink-0 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
                            copiedId === i 
                              ? 'bg-[#71BF44]/20 text-[#71BF44] opacity-100' 
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600'
                          }`}
                          title="Copiar detalle"
                        >
                          {copiedId === i ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
