'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  ChevronDown,
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
  X,
  Globe,
  MapPin,
  Server,
  FilterX
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

// Reusable MultiSelect Dropdown Component
function MultiSelectDropdown({ 
  label, 
  options, 
  selected, 
  onChange, 
  icon: Icon,
  colorClass = "text-[#71BF44]"
}: { 
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  icon: any;
  colorClass?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const isAllSelected = selected.length === 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-[#131313] border ${isOpen ? 'border-[#71BF44] ring-1 ring-[#71BF44]/20' : 'border-neutral-200 dark:border-neutral-800'} rounded-xl transition-all hover:border-[#71BF44]/50 min-w-[180px] group`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isOpen ? 'bg-[#71BF44]/10' : 'bg-neutral-100 dark:bg-neutral-800'}  group-hover:bg-[#71BF44]/10 transition-colors`}>
            <Icon className={`w-3.5 h-3.5 ${isOpen ? colorClass : 'text-neutral-500'}`} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Filtrar por {label}</span>
            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[120px]">
              {isAllSelected ? 'Todos' : `${selected.length} seleccionados`}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between p-2 mb-1 border-b border-neutral-100 dark:border-neutral-800/50">
            <span className="text-xs font-black uppercase text-neutral-400">Opciones</span>
            {selected.length > 0 && (
              <button 
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-[#71BF44] hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map(opt => (
              <label 
                key={opt} 
                className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors group"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  selected.includes(opt) 
                  ? 'bg-[#71BF44] border-[#71BF44]' 
                  : 'border-neutral-300 dark:border-neutral-700 group-hover:border-[#71BF44]'
                }`}>
                  {selected.includes(opt) && <X className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm ${selected.includes(opt) ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {opt}
                </span>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventHistoryPage() {
  const [data, setData] = useState<EventoRabbit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter States (Multiselect)
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedEventos, setSelectedEventos] = useState<string[]>([]);
  const [selectedAmbientes, setSelectedAmbientes] = useState<string[]>([]);
  const [selectedPaises, setSelectedPaises] = useState<string[]>([]);
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

      // Dropdown Filters (Multiselect)
      if (selectedEstados.length > 0 && !selectedEstados.includes(item.estado)) return false;
      if (selectedEventos.length > 0 && !selectedEventos.includes(item.evento)) return false;
      if (selectedAmbientes.length > 0 && !selectedAmbientes.includes(item.ambiente)) return false;
      if (selectedPaises.length > 0 && !selectedPaises.includes(item.pais)) return false;
      
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
  }, [data, selectedEstados, selectedEventos, selectedAmbientes, selectedPaises, selectedTimeRange, searchQuery, chartFilterDate, columnFilters, sortConfig]);

  // Unique values for filters (Removed 'todos' as we handle empty array as 'todos')
  const estados = useMemo(() => Array.from(new Set(data.map(d => d.estado).filter(Boolean))).sort(), [data]);
  const tiposEvento = useMemo(() => Array.from(new Set(data.map(d => d.evento).filter(Boolean))).sort(), [data]);
  const ambientes = useMemo(() => Array.from(new Set(data.map(d => d.ambiente).filter(Boolean))).sort(), [data]);
  const paises = useMemo(() => Array.from(new Set(data.map(d => d.pais).filter(Boolean))).sort(), [data]);

  // Chart Data Processing
  const { chartData, eventTypes } = useMemo(() => {
    // We use all data for the chart but respect dropdown/time filters to determine lines
    const chartBase = data.filter(item => {
        if (selectedEstados.length > 0 && !selectedEstados.includes(item.estado)) return false;
        if (selectedEventos.length > 0 && !selectedEventos.includes(item.evento)) return false;
        if (selectedAmbientes.length > 0 && !selectedAmbientes.includes(item.ambiente)) return false;
        if (selectedPaises.length > 0 && !selectedPaises.includes(item.pais)) return false;
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
  }, [data, selectedEstados, selectedEventos, selectedAmbientes, selectedPaises, selectedTimeRange]);

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

      {/* Filters Bar - Premium Redesign */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          {/* Global Search - Main focus left */}
          <div className="relative group max-w-sm w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
            <input 
              type="text" 
              placeholder="¿Qué estás buscando? (ID, Evento, País...)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#71BF44]/20 focus:border-[#71BF44] transition-all shadow-sm"
            />
          </div>

          <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 hidden lg:block" />

          {/* Core Filters - Order: Evento | Ambiente | País | Estado */}
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <MultiSelectDropdown 
              label="Evento" 
              options={tiposEvento} 
              selected={selectedEventos} 
              onChange={setSelectedEventos}
              icon={Activity}
              colorClass="text-blue-500"
            />
            <MultiSelectDropdown 
              label="Ambiente" 
              options={ambientes} 
              selected={selectedAmbientes} 
              onChange={setSelectedAmbientes}
              icon={Server}
              colorClass="text-orange-500"
            />
            <MultiSelectDropdown 
              label="País" 
              options={paises} 
              selected={selectedPaises} 
              onChange={setSelectedPaises}
              icon={Globe}
              colorClass="text-purple-500"
            />
            <MultiSelectDropdown 
              label="Estado" 
              options={estados} 
              selected={selectedEstados} 
              onChange={setSelectedEstados}
              icon={CheckCircle2}
              colorClass="text-[#71BF44]"
            />
          </div>

          {/* Time Range - Pushed to right */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1a1a1a] p-1.5 rounded-2xl shadow-inner ml-auto">
            {(['hoy', 'semana', 'mes', 'trimestre', 'todos'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => { setSelectedTimeRange(range); setChartFilterDate(null); }}
                className={`px-4 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all ${
                  selectedTimeRange === range 
                  ? 'bg-[#71BF44] text-white shadow-lg scale-105' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Active Filters Tokens / Clear All */}
        {(selectedEstados.length > 0 || selectedEventos.length > 0 || selectedAmbientes.length > 0 || selectedPaises.length > 0 || chartFilterDate || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-[#71BF44]/[0.02] dark:bg-white/[0.02] rounded-2xl border border-neutral-100 dark:border-neutral-800/50">
            <span className="text-[10px] font-black uppercase text-neutral-400 mr-2 ml-1">Filtros Activos:</span>
            
            {selectedEventos.map(ev => (
              <span key={ev} className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-blue-500/20">
                Evento: {ev} <X className="w-3 h-3 cursor-pointer hover:scale-125 transition-transform" onClick={() => setSelectedEventos(selectedEventos.filter(v => v !== ev))} />
              </span>
            ))}
            {selectedAmbientes.map(amb => (
              <span key={amb} className="bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-orange-500/20">
                Ambiente: {amb} <X className="w-3 h-3 cursor-pointer hover:scale-125 transition-transform" onClick={() => setSelectedAmbientes(selectedAmbientes.filter(v => v !== amb))} />
              </span>
            ))}
            {selectedPaises.map(p => (
              <span key={p} className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-purple-500/20">
                País: {p} <X className="w-3 h-3 cursor-pointer hover:scale-125 transition-transform" onClick={() => setSelectedPaises(selectedPaises.filter(v => v !== p))} />
              </span>
            ))}
            {selectedEstados.map(est => (
              <span key={est} className="bg-[#71BF44]/10 text-[#71BF44] px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-[#71BF44]/20">
                Estado: {est} <X className="w-3 h-3 cursor-pointer hover:scale-125 transition-transform" onClick={() => setSelectedEstados(selectedEstados.filter(v => v !== est))} />
              </span>
            ))}
            {chartFilterDate && (
              <span className="bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 shadow-sm transition-all duration-300 animate-pulse">
                🕒 Pueriodo Chart: {chartFilterDate} <X className="w-3 h-3 cursor-pointer hover:scale-125" onClick={() => setChartFilterDate(null)} />
              </span>
            )}
            
            <button 
              onClick={() => {
                setSelectedEstados([]);
                setSelectedEventos([]);
                setSelectedAmbientes([]);
                setSelectedPaises([]);
                setSearchQuery('');
                setChartFilterDate(null);
              }}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all active:scale-95"
            >
              <FilterX className="w-3.5 h-3.5" />
              Limpiar Todo
            </button>
          </div>
        )}
      </div>

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
                        if (selectedEventos.includes(type)) {
                          setSelectedEventos(selectedEventos.filter(v => v !== type));
                        } else {
                          setSelectedEventos([...selectedEventos, type]);
                        }
                    }}
                  />
                  {eventTypes.map((type, index) => (
                    <Line
                      key={type}
                      type="monotone"
                      dataKey={type}
                      name={type}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={selectedEventos.includes(type) ? 5 : 2}
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
                    <tr className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-100 dark:border-neutral-800 theme-table-row">
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
                 <button onClick={downloadCSV} className="text-[#71BF44] text-[10px] font-black uppercase hover:underline transition-all active:scale-95">Descargar {filteredData.length} registros</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
