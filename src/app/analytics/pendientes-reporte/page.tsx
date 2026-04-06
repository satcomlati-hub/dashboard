'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  FileWarning, 
  ExternalLink, 
  Clock, 
  RefreshCw, 
  Filter, 
  Search, 
  Calendar, 
  Globe, 
  Hash, 
  Building2, 
  MapPin, 
  X,
  AlertCircle,
  TrendingUp,
  Table as TableIcon,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  FileText,
  AlertTriangle,
  Download,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface Pendiente {
  co_ambiente: string;
  co_id_comprobante: string;
  co_nemonico: string;
  co_pais: number;
  co_hora_in: string;
  co_fecha_emision: string;
  co_fecha_autorizacion: string;
  co_estatus: string;
}

const PAIS_MAP: Record<number, string> = {
  593: 'Ecuador',
  57: 'Colombia',
  506: 'Costa Rica',
  507: 'Panamá',
  51: 'Perú',
  54: 'Argentina',
  56: 'Chile',
  502: 'Guatemala',
  503: 'El Salvador',
  504: 'Honduras',
  505: 'Nicaragua',
  58: 'Venezuela',
  1: 'USA/PR',
};

const COLORS = [
  '#71BF44', // Satcom Green
  '#2563eb', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

type TimeField = 'co_hora_in' | 'co_fecha_emision' | 'co_fecha_autorizacion';

export default function PendientesReportePage() {
  const [data, setData] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters & State
  const [timeField, setTimeField] = useState<TimeField>('co_hora_in');
  const [filterNemonico, setFilterNemonico] = useState('');
  const [selectedPais, setSelectedPais] = useState<number | null>(null);
  const [selectedAmbiente, setSelectedAmbiente] = useState('AWS');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Advanced Table States
  const [sortField, setSortField] = useState<keyof Pendiente | 'pais_name'>('co_hora_in');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`https://sara.mysatcomla.com/webhook/MonitoreoNoAutorizados?Ambiente=${selectedAmbiente}&Proceso=consulta_tablero_pendiente_info_reportes_2026`);

      if (!res.ok) throw new Error('Error al obtener datos');
      
      const json: any = await res.json();
      let flattened: Pendiente[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data && typeof item.data === 'string') {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) flattened = [...flattened, ...parsed];
            } catch (e) {
              console.error('Error parsing nested JSON', e);
            }
          }
        });
      }
      
      setData(flattened);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAmbiente]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear states when filters change
  useEffect(() => {
    setSelectedDate(null);
  }, [timeField, filterNemonico, selectedPais, selectedAmbiente]);

  const toggleSort = (field: keyof Pendiente | 'pais_name') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      // Global filters
      const matchNemonico = !filterNemonico || item.co_nemonico.toLowerCase().includes(filterNemonico.toLowerCase());
      const matchPais = selectedPais === null || item.co_pais === selectedPais;
      
      let matchDate = true;
      if (selectedDate) {
        const dateVal = item[timeField];
        if (dateVal) {
          const itemDate = dateVal.split('T')[0];
          matchDate = itemDate === selectedDate;
        } else {
          matchDate = false;
        }
      }

      if (!matchNemonico || !matchPais || !matchDate) return false;

      // Column specific filters
      for (const [key, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue;
        
        let itemValue: string;
        if (key === 'pais_name') {
           itemValue = PAIS_MAP[item.co_pais] || String(item.co_pais);
        } else if (key === 'co_hora_in' || key === 'co_fecha_emision' || key === 'co_fecha_autorizacion') {
           itemValue = formatDate(item[key as keyof Pendiente] as any, true);
        } else {
           itemValue = String(item[key as keyof Pendiente] || '');
        }

        if (!itemValue.toLowerCase().includes(filterValue.toLowerCase())) return false;
      }

      return true;
    });

    // Apply Sorting
    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'pais_name') {
        valA = PAIS_MAP[a.co_pais] || String(a.co_pais);
        valB = PAIS_MAP[b.co_pais] || String(b.co_pais);
      } else {
        valA = a[sortField as keyof Pendiente];
        valB = b[sortField as keyof Pendiente];
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filterNemonico, selectedPais, selectedDate, timeField, sortField, sortOrder, columnFilters]);

  const stats = useMemo(() => {
    // Current date for comparison: 2026-04-06
    const now = new Date('2026-04-06T14:26:37');
    const todayStr = '2026-04-06';
    
    // Start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    
    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const counts = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byPais: {} as Record<number, number>
    };

    // Use full unfiltered data (only filtered by nemonico) for stats? 
    // Usually stats should reflect the filters too, but maybe not the selectedDate filter
    const statsSource = data.filter(item => {
      const matchNemonico = !filterNemonico || item.co_nemonico.toLowerCase().includes(filterNemonico.toLowerCase());
      const matchPais = selectedPais === null || item.co_pais === selectedPais;
      return matchNemonico && matchPais;
    });

    statsSource.forEach(item => {
      // By Country
      counts.byPais[item.co_pais] = (counts.byPais[item.co_pais] || 0) + 1;

      // Periodic based on selected timeField
      const dateVal = item[timeField];
      if (dateVal) {
        const d = new Date(dateVal);
        const dStr = dateVal.split('T')[0];
        
        if (dStr === todayStr) counts.today++;
        if (d >= startOfWeek) counts.thisWeek++;
        if (d >= startOfMonth) counts.thisMonth++;
      }
    });

    return counts;
  }, [data, filterNemonico, selectedPais, timeField]);

  const chartData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    
    // Use data filtered by nemonico and pais for chart
    const chartSource = data.filter(item => {
       const matchNemonico = !filterNemonico || item.co_nemonico.toLowerCase().includes(filterNemonico.toLowerCase());
       const matchPais = selectedPais === null || item.co_pais === selectedPais;
       return matchNemonico && matchPais;
    });

    const pises = Array.from(new Set(chartSource.map(d => d.co_pais))).sort();

    chartSource.forEach(item => {
      const dateVal = item[timeField];
      if (!dateVal) return;
      
      const dateKey = dateVal.split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
        pises.forEach(p => grouped[dateKey][PAIS_MAP[p] || p.toString()] = 0);
      }
      
      const paisName = PAIS_MAP[item.co_pais] || item.co_pais.toString();
      grouped[dateKey][paisName] = (grouped[dateKey][paisName] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15); // Show last 15 days
  }, [data, filterNemonico, selectedPais, timeField]);

  const paisList = Array.from(new Set(data.map(d => d.co_pais))).sort((a, b) => {
    const nameA = PAIS_MAP[a] || a.toString();
    const nameB = PAIS_MAP[b] || b.toString();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#0c0c0c] border border-[#71BF44]/20 rounded-3xl shadow-2xl">
            <RefreshCw className="w-12 h-12 text-[#71BF44] animate-spin" />
            <span className="text-[#71BF44] font-black uppercase tracking-widest text-xs">Cargando Pendientes</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-12 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Regresar a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter mb-2">
                Pendientes de Reporte <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">2026</span>
              </h1>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#71BF44]" />
                  <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-[0.2em]">Monitor en Vivo</span>
                </div>
                
                {/* Environment Selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <Building2 className="w-3 h-3 text-neutral-400" />
                  <div className="flex gap-1">
                    {[
                      { id: 'AWS', label: 'Colombia (AWS)' },
                      { id: 'V5', label: 'V5' },
                      { id: 'Panama', label: 'Panamá' }
                    ].map(env => (
                      <button
                        key={env.id}
                        onClick={() => setSelectedAmbiente(env.id)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${selectedAmbiente === env.id ? 'bg-[#71BF44] text-white' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                      >
                        {env.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Total Pendientes</p>
          <div className="text-4xl font-black text-neutral-900 dark:text-white leading-none">
            {data.length.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neutral-500">
             <Layers className="w-3.5 h-3.5" />
             <span>En ambiente seleccionado</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm border-l-4 border-l-[#71BF44]">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Hoy</p>
          <div className="text-4xl font-black text-[#71BF44] leading-none">
            {stats.today}
          </div>
          <p className="mt-4 text-[9px] font-black text-neutral-400 uppercase tracking-tighter">Basado en {timeField}</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Esta Semana</p>
          <div className="text-4xl font-black text-neutral-900 dark:text-white leading-none">
            {stats.thisWeek}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Este Mes</p>
          <div className="text-4xl font-black text-neutral-900 dark:text-white leading-none">
            {stats.thisMonth}
          </div>
        </div>
      </div>

      {/* Filters & Tools */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-wrap items-center gap-6">
          {/* Time Field Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Variable de Tiempo:</span>
            <div className="flex gap-2">
              {[
                { id: 'co_hora_in', label: 'Ingreso' },
                { id: 'co_fecha_emision', label: 'Emisión' },
                { id: 'co_fecha_autorizacion', label: 'Autorización' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTimeField(opt.id as TimeField)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${timeField === opt.id ? 'bg-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800 hidden lg:block" />

          {/* Nemonico Filter */}
          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Filtrar por Nemónico:</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text"
                placeholder="Ej: BRDI, MOTR..."
                value={filterNemonico}
                onChange={(e) => setFilterNemonico(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => {
            const csv = filteredData.map(d => Object.values(d).join(';')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `PendientesReporte_${new Date().getTime()}.csv`);
            a.click();
          }}
          className="bg-[#71BF44] text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#71BF44]/20 flex items-center gap-3 hover:translate-y-[-2px] transition-all active:translate-y-0"
        >
          <Download className="w-5 h-5" />
          Exportar Datos
        </button>
      </div>

      {/* Main Chart Area */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-8">
        <div className="xl:col-span-3 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#71BF44]" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">Tendencia Diaria</h3>
            </div>
            <div className="text-[10px] font-bold text-neutral-400">
               Eje X: {timeField === 'co_hora_in' ? 'Fecha de Ingreso' : timeField === 'co_fecha_emision' ? 'Fecha de Emisión' : 'Fecha de Autorización'}
            </div>
          </div>
          
          <div className="h-[400px]">
             {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedDate(String(data.activeLabel));
                        // Scroll to table nicely
                        document.getElementById('records-table')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <defs>
                      {chartData.length > 0 && Object.keys(chartData[0]).filter(k => k !== 'date').map((key, i) => (
                        <linearGradient key={key} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#999', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(val) => formatDate(val)}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#999', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px', padding: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                    {chartData.length > 0 && Object.keys(chartData[0]).filter(k => k !== 'date').map((key, i) => (
                      <Area 
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#color${i})`}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-neutral-400 font-bold text-sm italic">
                  Cargando visualización...
               </div>
             )}
          </div>
        </div>

        {/* Country List */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-col">
           <div className="flex items-center gap-3 mb-8">
              <Globe className="w-5 h-5 text-[#71BF44]" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">Por País</h3>
           </div>
           
           <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {paisList.map((paisCode, i) => {
                const count = stats.byPais[paisCode] || 0;
                const paisName = PAIS_MAP[paisCode] || paisCode.toString();
                const isActive = selectedPais === paisCode;
                
                return (
                  <button 
                    key={paisCode}
                    onClick={() => setSelectedPais(isActive ? null : paisCode)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'bg-[#71BF44] border-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'bg-neutral-50 dark:bg-neutral-800/50 border-transparent hover:border-[#71BF44]/50'}`}
                  >
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${isActive ? 'bg-white text-[#71BF44]' : 'bg-[#111] text-white'}`}>
                          {paisName.substring(0, 1)}
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-widest">{paisName}</span>
                    </div>
                    <span className={`text-sm font-black ${isActive ? 'text-white' : 'text-[#71BF44]'}`}>{count}</span>
                  </button>
                );
              })}
           </div>

           {selectedPais !== null && (
             <button 
              onClick={() => setSelectedPais(null)}
              className="mt-6 w-full py-3 rounded-xl border border-dashed border-red-500/50 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
             >
               Limpiar Filtro
             </button>
           )}
        </div>
      </div>

      {/* Data Table Preview */}
      <div id="records-table" className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
         <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                 <TableIcon className="w-5 h-5 text-[#71BF44]" />
                 <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">Vista Previa de Registros</h3>
              </div>
              {selectedDate && (
                <div className="flex items-center gap-2 text-[9px] font-black text-[#71BF44] uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                   <Calendar className="w-3 h-3" />
                   Filtrado por: {formatDate(selectedDate)}
                   <button onClick={() => setSelectedDate(null)} className="ml-2 bg-[#71BF44]/10 p-1 rounded-md hover:bg-[#71BF44]/20 transition-all text-[#71BF44]">
                      <X className="w-3 h-3" />
                   </button>
                </div>
              )}
            </div>
            <span className="text-[10px] font-black text-neutral-400 bg-neutral-200 dark:bg-neutral-800 px-3 py-1 rounded-full uppercase tracking-tighter">
               Mostrando {Math.min(filteredData.length, 50)} de {filteredData.length}
            </span>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                     {[
                        { id: 'co_id_comprobante' as keyof Pendiente, label: 'ID Comprobante' },
                        { id: 'co_nemonico' as keyof Pendiente, label: 'Nemónico' },
                        { id: 'pais_name' as any, label: 'País' },
                        { id: 'co_estatus' as keyof Pendiente, label: 'Estado' },
                        { id: 'co_hora_in' as keyof Pendiente, label: 'Ingreso' },
                        { id: 'co_fecha_emision' as keyof Pendiente, label: 'Emisión' },
                        { id: 'co_fecha_autorizacion' as keyof Pendiente, label: 'Autorización' }
                     ].map(col => (
                        <th key={col.id} className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleSort(col.id)}>
                           <div className="flex items-center gap-2">
                              {col.label}
                              {sortField === col.id ? (
                                 sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              ) : (
                                 <ArrowUpDown className="w-3 h-3 opacity-20" />
                              )}
                           </div>
                        </th>
                     ))}
                  </tr>
                  <tr className="bg-neutral-50/50 dark:bg-white/[0.01] border-b border-neutral-100 dark:border-neutral-800">
                     {[
                        'co_id_comprobante', 'co_nemonico', 'pais_name', 'co_estatus', 'co_hora_in', 'co_fecha_emision', 'co_fecha_autorizacion'
                     ].map(colId => (
                        <th key={`filter-${colId}`} className="px-8 py-3 min-w-[120px]">
                           <div className="relative group">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 group-focus-within:text-[#71BF44] transition-colors" />
                              <input 
                                 type="text"
                                 placeholder={`Filtrar...`}
                                 value={columnFilters[colId] || ''}
                                 onChange={(e) => setColumnFilters(prev => ({ ...prev, [colId]: e.target.value }))}
                                 className="w-full bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-[9px] font-bold outline-none focus:ring-1 focus:ring-[#71BF44]/30 focus:border-[#71BF44]/30 transition-all placeholder:text-neutral-500"
                              />
                           </div>
                        </th>
                     ))}
                  </tr>
                </thead>
               <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  {filteredData.slice(0, 50).map((item) => (
                    <tr key={item.co_id_comprobante} className="group hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-all">
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                             <Hash className="w-3 h-3 text-[#71BF44] opacity-50" />
                             <span className="text-xs font-bold text-neutral-900 dark:text-white">{item.co_id_comprobante}</span>
                          </div>
                       </td>
                       <td className="px-8 py-4">
                          <span className="text-[10px] font-black px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                             {item.co_nemonico}
                          </span>
                       </td>
                       <td className="px-8 py-4">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase">
                             {PAIS_MAP[item.co_pais] || item.co_pais}
                          </span>
                       </td>
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full ${item.co_estatus === 'Autorizado' ? 'bg-[#71BF44]' : 'bg-amber-500'}`} />
                             <span className="text-[10px] font-bold uppercase tracking-tighter">{item.co_estatus}</span>
                          </div>
                       </td>
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                             <Clock className="w-3 h-3 text-[#71BF44]/50" />
                             {formatDate(item.co_hora_in, true)}
                          </div>
                       </td>
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                             <Calendar className="w-3 h-3 text-[#71BF44]/50" />
                             {formatDate(item.co_fecha_emision, true)}
                          </div>
                       </td>
                       <td className="px-8 py-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                             <Check className="w-3 h-3 text-[#71BF44]/50" />
                             {formatDate(item.co_fecha_autorizacion, true)}
                          </div>
                       </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                         <div className="flex flex-col items-center gap-3 opacity-20">
                            <Search className="w-12 h-12" />
                            <p className="text-2xl font-black uppercase tracking-[0.3em]">Sin Registros</p>
                         </div>
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Footer Info */}
      <footer className="mt-12 flex flex-col items-center gap-4 py-8 border-t border-neutral-100 dark:border-neutral-800">
         <div className="flex items-center gap-4 opacity-50">
            <div className="w-8 h-8 rounded bg-[#71BF44] flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Satcom Analytics Engine v2.0</span>
         </div>
      </footer>
    </div>
  );
}
