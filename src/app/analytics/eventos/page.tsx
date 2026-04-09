'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Calendar, 
  Filter, 
  RefreshCw, 
  Download, 
  Clock, 
  Activity, 
  AlertCircle,
  Database,
  Search,
  CheckCircle2,
  XCircle,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

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
}

type TimeRange = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'todos';

interface SortConfig {
  key: keyof EventoRabbit | 'fecha_norm';
  direction: 'asc' | 'desc';
}

export default function EventHistoryPage() {
  const [data, setData] = useState<EventoRabbit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter States
  const [selectedEstado, setSelectedEstado] = useState<string>('todos');
  const [selectedEvento, setSelectedEvento] = useState<string>('todos');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartFilterDate, setChartFilterDate] = useState<string | null>(null);

  // Column Filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    ambiente: '',
    pais: '',
    evento: '',
    estado: '',
    reporta: '',
    detalle_evento: '',
    num_eventos: '',
    key: '',
    version: '',
    mensaje: '',
    justificacion: ''
  });

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'fecha_norm',
    direction: 'desc'
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch('https://sara.mysatcomla.com/webhook/DetalleEventosRabbit');
      if (!res.ok) throw new Error('Error al obtener el historial de eventos');
      
      const json = await res.json();
      const events = Array.isArray(json) ? json : (json.data || []);
      
      setData(events);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      // Global Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          (item.ambiente || '').toLowerCase().includes(query) || 
          (item.evento || '').toLowerCase().includes(query) || 
          (item.detalle_evento || '').toLowerCase().includes(query) ||
          (item.pais || '').toLowerCase().includes(query) ||
          (item.estado || '').toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Dropdown Filters
      if (selectedEstado !== 'todos' && item.estado !== selectedEstado) return false;
      if (selectedEvento !== 'todos' && item.evento !== selectedEvento) return false;
      
      // Time range filter
      if (selectedTimeRange !== 'todos' && item.fecha_evento) {
        const eventDate = new Date(item.fecha_evento);
        const now = new Date();
        const diffDays = (now.getTime() - eventDate.getTime()) / (1000 * 3600 * 24);

        if (selectedTimeRange === 'hoy' && diffDays > 1) return false;
        if (selectedTimeRange === 'semana' && diffDays > 7) return false;
        if (selectedTimeRange === 'mes' && diffDays > 30) return false;
        if (selectedTimeRange === 'trimestre' && diffDays > 90) return false;
      }

      // Chart Date Filter (Matches the chart X-axis label)
      if (chartFilterDate) {
        const date = new Date(item.fecha_evento);
        const label = selectedTimeRange === 'hoy' 
          ? date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('es-EC', { month: 'short', day: 'numeric', hour: '2-digit' });
        if (label !== chartFilterDate) return false;
      }

      // Column Filters
      const colMatch = Object.entries(columnFilters).every(([key, filterVal]) => {
        if (!filterVal) return true;
        const val = String((item as any)[key] || '').toLowerCase();
        return val.includes(filterVal.toLowerCase());
      });
      if (!colMatch) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let valA: any = sortConfig.key === 'fecha_norm' ? new Date(a.fecha_evento).getTime() : ((a as any)[sortConfig.key] || '');
      let valB: any = sortConfig.key === 'fecha_norm' ? new Date(b.fecha_evento).getTime() : ((b as any)[sortConfig.key] || '');

      // Numeric comparison for num_eventos
      if (sortConfig.key === 'num_eventos') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, selectedEstado, selectedEvento, selectedTimeRange, searchQuery, chartFilterDate, columnFilters, sortConfig]);

  // Unique values for filters
  const estados = useMemo(() => ['todos', ...Array.from(new Set(data.map(d => d.estado).filter(Boolean)))], [data]);
  const tiposEvento = useMemo(() => ['todos', ...Array.from(new Set(data.map(d => d.evento).filter(Boolean)))], [data]);

  // Chart Data Processing
  const { chartData, eventTypes } = useMemo(() => {
    // We use all data for the chart but respect dropdown/time filters to determine lines
    const chartBase = data.filter(item => {
        if (selectedEstado !== 'todos' && item.estado !== selectedEstado) return false;
        if (selectedEvento !== 'todos' && item.evento !== selectedEvento) return false;
        if (selectedTimeRange !== 'todos' && item.fecha_evento) {
            const eventDate = new Date(item.fecha_evento);
            const now = new Date();
            const diffDays = (now.getTime() - eventDate.getTime()) / (1000 * 3600 * 24);
            if (selectedTimeRange === 'hoy' && diffDays > 1) return false;
            if (selectedTimeRange === 'semana' && diffDays > 7) return false;
            if (selectedTimeRange === 'mes' && diffDays > 30) return false;
            if (selectedTimeRange === 'trimestre' && diffDays > 90) return false;
        }
        return true;
    });

    if (chartBase.length === 0) return { chartData: [], eventTypes: [] };

    const types = Array.from(new Set(chartBase.map(d => d.evento)));
    const timeMap: Record<string, any> = {};

    const sorted = [...chartBase].sort((a, b) => 
      new Date(a.fecha_evento).getTime() - new Date(b.fecha_evento).getTime()
    );

    sorted.forEach(item => {
      const date = new Date(item.fecha_evento);
      const label = selectedTimeRange === 'hoy' 
        ? date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString('es-EC', { month: 'short', day: 'numeric', hour: '2-digit' });
      
      if (!timeMap[label]) {
        timeMap[label] = { name: label };
        types.forEach(t => timeMap[label][t] = 0);
      }
      
      const val = parseInt(item.num_eventos) || 1;
      timeMap[label][item.evento] = (timeMap[label][item.evento] || 0) + val;
    });

    return { chartData: Object.values(timeMap), eventTypes: types };
  }, [data, selectedEstado, selectedEvento, selectedTimeRange]);

  const downloadCSV = () => {
    if (filteredData.length === 0) return;

    const allKeys: (keyof EventoRabbit)[] = [
      'fecha_evento', 'ambiente', 'pais', 'evento', 'num_eventos', 
      'estado', 'detalle_evento', 'reporta', 'created_at', 'version', 
      'key', 'mensaje', 'justificacion'
    ];

    const headers = allKeys.map(k => k.toUpperCase().replace('_', ' '));

    const rows = filteredData.map(d => allKeys.map(key => {
      let val = (d as any)[key];
      if (key === 'fecha_evento' || key === 'created_at') val = formatDate(val as string, true);
      if (val === null || val === undefined) val = '';
      
      // Excel text format trick: prefix with \t or wrap in ="" 
      // User asked for "string" format. \t is often cleaner as it doesn't show in the cell text but prevents numeric conversion.
      return `"\t${val.toString().replace(/"/g, '""').replace(/\n|\r/g, ' ')}"`;
    }));

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Historial_Eventos_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const COLORS = ['#71BF44', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'];

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Header */}
      <header className="mb-8 py-6 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Analytics
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#71BF44]/10 flex items-center justify-center shadow-inner">
              <Clock className="w-7 h-7 text-[#71BF44]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Historial de Eventos</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Bitácora masiva y evolución temporal de actividad técnica.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
              onClick={downloadCSV}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-xs font-bold text-white rounded-lg shadow-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Descargar Detalle
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] text-xs font-bold text-[#71BF44] border border-[#71BF44]/30 rounded-lg shadow-sm hover:bg-[#71BF44]/5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Search */}
        <div className="relative group lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Buscador global..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#71BF44] transition-all"
          />
        </div>

        {/* Estado Dropdown */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1">
          <CheckCircle2 className="w-4 h-4 text-neutral-400" />
          <select 
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold outline-none py-1.5 cursor-pointer capitalize"
          >
            {estados.map(est => (
              <option key={est} value={est}>{est === 'todos' ? 'Estado: Todos' : `Estado: ${est}`}</option>
            ))}
          </select>
        </div>

        {/* Evento Dropdown */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1">
          <Activity className="w-4 h-4 text-neutral-400" />
          <select 
            value={selectedEvento}
            onChange={(e) => setSelectedEvento(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold outline-none py-1.5 cursor-pointer capitalize"
          >
            {tiposEvento.map(ev => (
              <option key={ev} value={ev}>{ev === 'todos' ? 'Evento: Todos' : `Evento: ${ev}`}</option>
            ))}
          </select>
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1a1a1a] p-1 rounded-xl lg:col-span-2">
          {(['hoy', 'semana', 'mes', 'trimestre', 'todos'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => { setSelectedTimeRange(range); setChartFilterDate(null); }}
              className={`flex-1 text-[9px] font-black uppercase tracking-widest py-2.5 rounded-lg transition-all ${selectedTimeRange === range ? 'bg-[#71BF44] text-white shadow-md' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Visualization */}
      {(selectedEstado !== 'todos' || selectedEvento !== 'todos' || chartFilterDate) && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-2 bg-neutral-50 dark:bg-black/20 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
           {selectedEstado !== 'todos' && (
             <span className="bg-[#71BF44]/10 text-[#71BF44] px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5">
               {selectedEstado} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedEstado('todos')} />
             </span>
           )}
           {selectedEvento !== 'todos' && (
             <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5">
               {selectedEvento} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedEvento('todos')} />
             </span>
           )}
           {chartFilterDate && (
             <span className="bg-purple-500/10 text-purple-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5">
               Fecha Chart: {chartFilterDate} <X className="w-3 h-3 cursor-pointer" onClick={() => setChartFilterDate(null)} />
             </span>
           )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-[#71BF44]/20 border-t-[#71BF44] rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-500">Analizando historial masivo…</p>
        </div>
      ) : (
        <>
          {/* Timeline Chart */}
          <section className="mb-12">
            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData} 
                  onClick={(state) => {
                    if (state && state.activeLabel) setChartFilterDate(String(state.activeLabel));
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888811" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '16px', fontSize: '11px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingBottom: '30px' }}
                    onClick={(data) => {
                        const type = data.dataKey as string;
                        setSelectedEvento(selectedEvento === type ? 'todos' : type);
                    }}
                  />
                  {eventTypes.map((type, index) => (
                    <Line
                      key={type}
                      type="monotone"
                      dataKey={type}
                      name={type}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={selectedEvento === type ? 5 : 2}
                      dot={{ r: 4, fill: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                      animationDuration={1000}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 text-[9px] text-center text-neutral-400 font-bold uppercase tracking-widest">
                 💡 Haz clic en un punto para filtrar la tabla por fecha específica. Haz clic en la leyenda para filtrar por tipo de evento.
              </div>
            </div>
          </section>

          {/* Details Table */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4 text-[#71BF44]" /> Bitácora Técnica de Eventos
              </h3>
              <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-lg">
                Viendo {filteredData.length} de {data.length} registros
              </span>
            </div>

            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-100 dark:border-neutral-800">
                      {[
                        { label: 'Fecha Evento', key: 'fecha_norm', minWidth: '180px' },
                        { label: 'Ambiente', key: 'ambiente', minWidth: '120px' },
                        { label: 'País', key: 'pais', minWidth: '120px' },
                        { label: 'Evento', key: 'evento', minWidth: '180px' },
                        { label: 'Vol.', key: 'num_eventos', minWidth: '80px', align: 'center' },
                        { label: 'Estado', key: 'estado', minWidth: '120px' },
                        { label: 'Reporta', key: 'reporta', minWidth: '120px' },
                        { label: 'Detalle Técnico', key: 'detalle_evento', minWidth: '350px' },
                        { label: 'Version API', key: 'version', minWidth: '200px' },
                        { label: 'Key', key: 'key', minWidth: '200px' },
                        { label: 'Mensaje', key: 'mensaje', minWidth: '150px' },
                        { label: 'Created At', key: 'created_at', minWidth: '180px' }
                      ].map((col) => (
                        <th key={col.key} className="px-6 py-4" style={{ minWidth: col.minWidth }}>
                          <div className="flex flex-col gap-3">
                            <button 
                              onClick={() => handleSort(col.key as any)}
                              className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors"
                            >
                              {col.label}
                              {sortConfig.key === col.key ? (
                                sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              ) : <ArrowUpDown className="w-3 h-3 opacity-20" />}
                            </button>
                            {/* Individual Column Filter */}
                            <div className="relative">
                               <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
                               <input 
                                 type="text" 
                                 placeholder="..."
                                 value={columnFilters[col.key === 'fecha_norm' ? 'fecha_evento' : col.key] || ''}
                                 onChange={(e) => setColumnFilters(f => ({ ...f, [col.key === 'fecha_norm' ? 'fecha_evento' : col.key]: e.target.value }))}
                                 className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-medium transition-all focus:border-[#71BF44] outline-none"
                               />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/20">
                    {filteredData.slice(0, 200).map((ev, i) => (
                      <tr key={ev.created_at + i} className="group hover:bg-[#71BF44]/[0.02] transition-all">
                        <td className="px-6 py-5 whitespace-nowrap text-xs font-bold text-neutral-900 dark:text-neutral-200">
                          {formatDate(ev.fecha_evento, true)}
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black text-[#71BF44] uppercase">{ev.ambiente}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase">{ev.pais}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black tracking-tight text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                            {ev.evento}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center text-xs font-black text-[#71BF44]">
                          {ev.num_eventos}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            ev.estado === 'Enviado' || ev.estado === 'Activo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {ev.estado}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">{ev.reporta}</td>
                        <td className="px-6 py-5 max-w-sm">
                          <p className="text-[11px] font-medium text-neutral-500 leading-relaxed italic line-clamp-2" title={ev.detalle_evento}>
                            {ev.detalle_evento || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-medium text-neutral-400 truncate block max-w-[180px]">{ev.version}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-medium text-neutral-400 truncate block max-w-[180px]">{ev.key}</span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-[10px] font-medium text-neutral-400 line-clamp-1">{ev.mensaje || '-'}</p>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[10px] text-neutral-500 uppercase font-bold">
                          {formatDate(ev.created_at, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-neutral-50 dark:bg-[#0c0c0c] px-8 py-4 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800">
                 <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                   {filteredData.length > 200 ? 'Mostrando los últimos 200 registros. Usa los filtros o descarga para ver el resto.' : `Total de registros filtrados: ${filteredData.length}`}
                 </p>
                 <button onClick={downloadCSV} className="text-[#71BF44] text-[10px] font-black uppercase hover:underline">Descargar {filteredData.length} registros</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
