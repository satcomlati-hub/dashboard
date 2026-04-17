'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Globe, 
  Filter, 
  Search, 
  Calendar, 
  RefreshCw, 
  Activity, 
  BarChart3, 
  TrendingUp,
  Download,
  Database,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  LayoutDashboard
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
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface SatcomData {
  Fecha: string;          // Formato "YYYY-MM-DD" (Mensual)
  Pais: string | number | null;
  Autorizado: number;     // 1 o 0
  Cantidad: number;
  FechaProceso: string;
  Ambiente: 'V5' | 'AWS';
}

const PAIS_MAP: Record<number | string, string> = {
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
  'NULL': 'No Definido'
};

const COLORS = [
  '#71BF44', // Satcom Green
  '#2563eb', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#10b981', // Emerald
];

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function ResumenMySatcomPage() {
  const [data, setData] = useState<SatcomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [selectedAmbiente, setSelectedAmbiente] = useState<string>('Todos'); // 'V5', 'AWS', 'Todos'
  const [selectedPais, setSelectedPais] = useState<string | number>('Todos');
  const [selectedEstado, setSelectedEstado] = useState<string>('Todos'); // '1', '0', 'Todos'
  const [splitBy, setSplitBy] = useState<'Ambiente' | 'Pais'>('Ambiente');
  const [baseYear, setBaseYear] = useState<number>(2026);
  const [compareYear, setCompareYear] = useState<number>(2025);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const urls = [
        'https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_mysatcom_2026',
        'https://sara.mysatcomla.com/webhook/GetData?Ambiente=AWS&Proceso=consulta_tablero_mysatcom_2026'
      ];

      const responses = await Promise.all(urls.map(url => fetch(url)));
      
      for (const res of responses) {
        if (!res.ok) throw new Error('Error al conectar con el servidor de datos');
      }

      const results = await Promise.all(responses.map(res => res.json()));
      
      let combined: SatcomData[] = [];
      
      results.forEach((json, index) => {
        if (!json) return;
        
        const defaultEnv = index === 0 ? 'V5' : 'AWS';
        let rawItems: any[] = [];
        
        // Helper to flatten/extract data from the common webhook structures
        const processJson = (obj: any) => {
          if (Array.isArray(obj)) {
            // Case: [ { data: "[...]" } ] or [ { Fecha: ... } ]
            obj.forEach(item => {
              if (item && item.data && typeof item.data === 'string') {
                try {
                  const parsed = JSON.parse(item.data);
                  if (Array.isArray(parsed)) rawItems = [...rawItems, ...parsed];
                } catch (e) {}
              } else if (item && item.data && Array.isArray(item.data)) {
                rawItems = [...rawItems, ...item.data];
              } else if (item && (item.Fecha || item.fecha)) {
                rawItems.push(item);
              }
            });
          } else if (obj && typeof obj === 'object') {
            // Case: { data: "[...]" } or { data: [...] }
            if (obj.data && typeof obj.data === 'string') {
              try {
                const parsed = JSON.parse(obj.data);
                if (Array.isArray(parsed)) rawItems = [...rawItems, ...parsed];
              } catch (e) {}
            } else if (obj.data && Array.isArray(obj.data)) {
              rawItems = [...rawItems, ...obj.data];
            } else if (obj.Fecha || obj.fecha) {
              rawItems.push(obj);
            }
          }
        };

        processJson(json);

        // Map and sanitize
        const sanitized = rawItems.map(item => ({
          ...item,
          Ambiente: item.Ambiente || defaultEnv,
          Cantidad: Number(item.Cantidad) || 0,
          Fecha: item.Fecha || item.fecha || ''
        })).filter(item => item.Fecha && String(item.Fecha).length >= 7);

        combined = [...combined, ...sanitized];
      });

      setData(combined);
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

  // Data Filtering
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (!item) return false;
      const matchAmbiente = selectedAmbiente === 'Todos' || item.Ambiente === selectedAmbiente;
      const matchPais = selectedPais === 'Todos' || String(item.Pais) === String(selectedPais);
      const matchEstado = selectedEstado === 'Todos' || String(item.Autorizado) === selectedEstado;
      return matchAmbiente && matchPais && matchEstado;
    });
  }, [data, selectedAmbiente, selectedPais, selectedEstado]);

  // Stats calculation
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { total: 0, authorized: 0, unauthorized: 0, authRate: 0 };
    
    const total = filteredData.reduce((acc, curr) => acc + (Number(curr?.Cantidad) || 0), 0);
    const authorized = filteredData.filter(d => d?.Autorizado === 1).reduce((acc, curr) => acc + (Number(curr?.Cantidad) || 0), 0);
    const unauthorized = Math.max(0, total - authorized);
    const authRate = total > 0 ? (authorized / total) * 100 : 0;

    return { total, authorized, unauthorized, authRate };
  }, [filteredData]);

  // Chart 1: Monthly Timeline (Grouped by Ambiente or Pais)
  const timelineChartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    const categories = new Set<string>();

    filteredData.forEach(item => {
      if (!item || !item.Fecha) return;
      const dateKey = String(item.Fecha).substring(0, 7); // YYYY-MM
      if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey };
      
      const paisValue = item.Pais === null || item.Pais === undefined || item.Pais === 'NULL' ? 'NULL' : item.Pais;
      const category = splitBy === 'Ambiente' 
        ? (item.Ambiente || 'Unknown') 
        : (PAIS_MAP[paisValue as any] || `ID: ${paisValue}`);
      
      categories.add(category);
      grouped[dateKey][category] = (grouped[dateKey][category] || 0) + (Number(item.Cantidad) || 0);
    });

    return {
      data: Object.values(grouped).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
      categories: Array.from(categories)
    };
  }, [filteredData, splitBy]);

  // Chart 2: YoY Comparison (Selected Base vs Compare Year)
  const yoyChartData = useMemo(() => {
    const months: any[] = Array.from({ length: 12 }, (_, i) => ({
      month: MONTH_NAMES[i],
      monthNum: i + 1,
      current: 0,
      previous: 0,
      growth: 0
    }));

    filteredData.forEach(item => {
      if (!item || !item.Fecha) return;
      const date = new Date(item.Fecha);
      if (isNaN(date.getTime())) return;
      
      const year = date.getUTCFullYear();
      const monthIdx = date.getUTCMonth();

      if (monthIdx >= 0 && monthIdx < 12) {
        if (year === baseYear) {
          months[monthIdx].current += (Number(item.Cantidad) || 0);
        } else if (year === compareYear) {
          months[monthIdx].previous += (Number(item.Cantidad) || 0);
        }
      }
    });

    // Calculate growth %
    months.forEach(m => {
      if (m.previous > 0) {
        m.growth = ((m.current - m.previous) / m.previous) * 100;
      } else if (m.current > 0) {
        m.growth = 100; // 100% growth if previous was 0
      } else {
        m.growth = 0;
      }
    });

    return months;
  }, [filteredData, baseYear, compareYear]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    data.forEach(item => {
      if (item.Fecha) {
        const y = new Date(item.Fecha).getUTCFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    
    // Auto-select years if they exist in the dataset but weren't set yet
    if (years.length >= 2 && baseYear === 2026 && compareYear === 2025) {
      if (!yearsSet.has(2026) || !yearsSet.has(2025)) {
        // Fallback to highest two years if default ones don't exist
        // But usually we want to keep 2026/2025 as starting point if they exist
      }
    }
    
    return years;
  }, [data]);

  const growthSummary = useMemo(() => {
    // Para una comparativa justa (Like-for-Like), solo sumamos los meses que tienen datos en el año base
    // Esto evita comparar por ejemplo 4 meses de 2026 contra 12 meses de 2025.
    const relevantMonths = yoyChartData.filter(m => m.current > 0);
    
    const baseTotal = relevantMonths.reduce((acc, curr) => acc + curr.current, 0);
    const compareTotal = relevantMonths.reduce((acc, curr) => acc + curr.previous, 0);
    
    const growth = compareTotal > 0 ? ((baseTotal - compareTotal) / compareTotal) * 100 : 0;
    const isPartial = relevantMonths.length < 12 && relevantMonths.length > 0;
    
    return { baseTotal, compareTotal, growth, isPartial, monthCount: relevantMonths.length };
  }, [yoyChartData]);

  const uniqueCountries = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.map(d => d?.Pais).filter(p => p !== undefined));
    return Array.from(set).filter(p => p !== null && p !== undefined);
  }, [data]);

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 p-10 bg-white dark:bg-[#0c0c0c] border border-[#71BF44]/20 rounded-[40px] shadow-2xl">
            <RefreshCw className="w-16 h-16 text-[#71BF44] animate-spin" />
            <div className="flex flex-col items-center">
              <span className="text-[#71BF44] font-black uppercase tracking-widest text-xs">Cargando Resumen</span>
              <span className="text-neutral-500 font-bold text-[10px] uppercase tracking-tighter mt-1">Sincronizando Multichannel Webhooks</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-12 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group transition-all">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Regresar a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter mb-1">
                Resumen MySatcom <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">Dash V3</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Multi-Source Webhook</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-800"></div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#71BF44]" />
                  <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest leading-none">Actualizado: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="group bg-neutral-900 dark:bg-white text-white dark:text-black px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Datos
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Total Transacciones</p>
          <div className="text-4xl font-black text-neutral-900 dark:text-white leading-none">
            {stats.total.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center justify-between">
             <span className="text-[9px] font-black text-neutral-500 uppercase tracking-tight">Consolidado Total</span>
             <TrendingUp className="w-4 h-4 text-[#71BF44]" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm border-l-4 border-l-[#71BF44]">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest text-[#71BF44]">Autorizados</p>
          <div className="text-4xl font-black text-[#71BF44] leading-none">
            {stats.authorized.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-neutral-500 uppercase">
             <CheckCircle2 className="w-3.5 h-3.5 text-[#71BF44]" />
             <span>Gestiones Exitosas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm border-l-4 border-l-red-500">
          <p className="text-[10px] font-black text-neutral-400 uppercase mb-2 tracking-widest text-red-500">No Autorizados</p>
          <div className="text-4xl font-black text-red-500 leading-none">
            {stats.unauthorized.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-neutral-500 uppercase">
             <XCircle className="w-3.5 h-3.5 text-red-500" />
             <span>Fallos detectados</span>
          </div>
        </div>

        <div className="bg-[#111] dark:bg-[#71BF44] border border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black text-white/60 dark:text-black/60 uppercase mb-2 tracking-widest">Tasa de Autorización</p>
          <div className="text-4xl font-black text-white dark:text-black leading-none flex items-baseline gap-1">
            {stats.authRate.toFixed(1)}<span className="text-xl">%</span>
          </div>
          <div className="w-full bg-white/10 dark:bg-black/10 h-1.5 rounded-full mt-4 overflow-hidden">
             <div className="h-full bg-white dark:bg-black" style={{ width: `${stats.authRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-wrap items-center gap-8">
          
          {/* Ambiente Filter */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[#71BF44]" />
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ambiente</span>
             </div>
             <div className="flex gap-2">
                {['Todos', 'V5', 'AWS'].map(amb => (
                   <button
                    key={amb}
                    onClick={() => setSelectedAmbiente(amb)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${selectedAmbiente === amb ? 'bg-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                   >
                     {amb}
                   </button>
                ))}
             </div>
          </div>

          <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-800 hidden lg:block" />

          {/* Estado Filter */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#71BF44]" />
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Estado</span>
             </div>
             <div className="flex gap-2">
                {[
                  { id: 'Todos', label: 'Todos' },
                  { id: '1', label: 'Autorizado' },
                  { id: '0', label: 'No Autorizado' }
                ].map(opt => (
                   <button
                    key={opt.id}
                    onClick={() => setSelectedEstado(opt.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${selectedEstado === opt.id ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shrink-0' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0'}`}
                   >
                     {opt.label}
                   </button>
                ))}
             </div>
          </div>

          <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-800 hidden lg:block" />

          {/* Pais Filter */}
          <div className="flex flex-col gap-3 flex-1 min-w-[200px]">
             <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#71BF44]" />
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Seleccionar País</span>
             </div>
             <select 
              value={selectedPais}
              onChange={(e) => setSelectedPais(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[#71BF44]/30"
             >
                <option value="Todos">TODOS LOS PAÍSES</option>
                {uniqueCountries.map(p => (
                   <option key={String(p)} value={String(p)}>{PAIS_MAP[p as any] || `ID: ${p}`}</option>
                ))}
             </select>
          </div>

          <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-800 hidden lg:block" />

          {/* Year Comparison Filters */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-[#71BF44]" />
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Comparar Años</span>
             </div>
             <div className="flex items-center gap-2">
                <select 
                  value={baseYear}
                  onChange={(e) => setBaseYear(parseInt(e.target.value))}
                  className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#71BF44]/30"
                >
                  {availableYears.map(y => (
                    <option key={`base-${y}`} value={y}>{y} (Base)</option>
                  ))}
                </select>
                <span className="text-[10px] font-bold text-neutral-400">vs</span>
                <select 
                  value={compareYear}
                  onChange={(e) => setCompareYear(parseInt(e.target.value))}
                  className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#71BF44]/30"
                >
                  {availableYears.map(y => (
                    <option key={`comp-${y}`} value={y}>{y} (Ref)</option>
                  ))}
                </select>
             </div>
          </div>
        </div>

        {/* Display Controls */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] p-8 flex items-center gap-6 shadow-2xl">
           <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Dividir Series por:</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSplitBy('Ambiente')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${splitBy === 'Ambiente' ? 'bg-[#71BF44] text-white' : 'text-neutral-500 hover:text-white'}`}
                >
                  Ambiente
                </button>
                <button 
                  onClick={() => setSplitBy('Pais')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${splitBy === 'Pais' ? 'bg-[#71BF44] text-white' : 'text-neutral-500 hover:text-white'}`}
                >
                  País
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Timeline Chart */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[40px] p-8 shadow-sm">
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-[#71BF44]/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#71BF44]" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">Evolución Mensual</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Volumen consolidado filtrado</p>
                 </div>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-black border border-neutral-100 dark:border-neutral-800 px-3 py-1.5 rounded-xl">
                 <span className="text-[9px] font-bold text-[#71BF44]">Split:</span>
                 <span className="text-[9px] font-black uppercase text-neutral-500">{splitBy}</span>
              </div>
           </div>

           <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={timelineChartData.data}>
                    <defs>
                      {timelineChartData.categories.map((cat, i) => (
                        <linearGradient key={cat} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                       dataKey="date" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                       tickFormatter={(val) => {
                          const [y, m] = val.split('-');
                          return `${MONTH_NAMES[parseInt(m)-1]} ${y}`;
                       }}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '20px', padding: '15px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#fff' }}
                      labelStyle={{ marginBottom: '10px', color: '#71BF44', fontWeight: '900' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                    {timelineChartData.categories.map((cat, i) => (
                       <Area 
                         key={cat}
                         type="monotone"
                         dataKey={cat}
                         stroke={COLORS[i % COLORS.length]}
                         strokeWidth={4}
                         fillOpacity={1}
                         fill={`url(#color${i})`}
                         animationDuration={1500}
                         dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                         activeDot={{ r: 6, strokeWidth: 0 }}
                       />
                    ))}
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* YoY Chart */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[40px] p-8 shadow-sm">
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white dark:text-black" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">Comparativa Interanual</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Año {baseYear} vs {compareYear}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className={`px-4 py-2 rounded-2xl flex flex-col items-center leading-none ${growthSummary.growth >= 0 ? 'bg-[#71BF44]/10 text-[#71BF44]' : 'bg-red-500/10 text-red-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                       {growthSummary.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                       <span className="text-sm font-black tracking-tighter">{growthSummary.growth >= 0 ? '+' : ''}{growthSummary.growth.toFixed(1)}%</span>
                    </div>
                    {growthSummary.isPartial && (
                       <span className="text-[8px] font-black uppercase opacity-60 tracking-tight">YTD (LFL)</span>
                    )}
                 </div>
              </div>
           </div>

           <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={yoyChartData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                       dataKey="month" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#71BF44', opacity: 0.05 }}
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '20px', padding: '15px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#fff' }}
                      labelStyle={{ marginBottom: '10px', color: '#71BF44', fontWeight: '900' }}
                      formatter={(value: any, name: any) => {
                         const n = String(name || '');
                         if (n.includes('Crecimiento')) return [`${Number(value).toFixed(1)}%`, 'Variación'];
                         return [Number(value).toLocaleString(), n];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                    <Bar 
                      name={`Año ${baseYear} (Base)`} 
                      dataKey="current" 
                      fill="#71BF44" 
                      radius={[6, 6, 0, 0]}
                      animationDuration={1500}
                    />
                    <Bar 
                      name={`Año ${compareYear} (Anterior)`} 
                      dataKey="previous" 
                      fill="#94a3b8" 
                      radius={[6, 6, 0, 0]}
                      animationDuration={1500}
                    />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Data Source Info */}
      <footer className="mt-20 pt-10 border-t border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-6">
         <div className="flex items-center gap-4 opacity-40">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Satcom Analytics Suite • Resumen Multi-Ambiente</span>
         </div>
         <p className="text-[9px] font-bold text-neutral-400 max-w-2xl text-center leading-relaxed">
            Este tablero consolida información técnica de los ambientes V5 y AWS de manera transparente.
            Los datos son procesados mensualmente para análisis de tendencias y crecimiento interanual.
         </p>
      </footer>
    </div>
  );
}
