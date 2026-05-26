'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Calendar, 
  X,
  Table as TableIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  FileText,
  TrendingUp,
  Filter,
  CheckCircle2,
  XCircle,
  Hash,
  Download,
  Building2,
  Globe,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  BarChart,
  Bar,
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

// Mappings y Tipos
interface CatalogEmisor {
  IdEmisor: number;
  Nemonico: string;
  Identificacion: string;
  RazonSocial: string;
  IdPais: number;
  NombrePais?: string;
  CodigoPais?: number;
  Pais?: number;
  nemonico?: string;
  razon_social?: string;
}

interface ActivityRecord {
  IdEmisor: number;
  Establecimiento?: string;
  PuntoEmision?: string;
  EstadoReporte?: string;
  TotalAutorizados?: number;
  TotalErrores?: number;
  UltimoAutorizado?: string;
  UltimoNoAutorizado?: string;
}

interface MonitoreoRecord {
  Fecha: string;
  Hora: string;
  IdEmisor: number;
  Autorizados: number;
  NoAutorizados: number;
  TotalHora: number;
}

interface NormalizedRecord {
  fecha: string;
  hora: string;
  idEmisor: number;
  nemonico: string;
  razonSocial: string;
  idPais: number;
  paisNombre: string;
  autorizados: number;
  noAutorizados: number;
  totalHora: number;
  ultimoAutorizado: string;
}

const PAIS_MAP: Record<number, string> = {
  593: 'Ecuador',
  57: 'Colombia',
  506: 'Costa Rica',
  507: 'Panamá',
  51: 'Perú',
};

export default function MySatcomMonitoreoPage() {
  const [selectedAmbiente, setSelectedAmbiente] = useState<'V5' | 'Colombia'>('V5');
  const [rawCatalog, setRawCatalog] = useState<CatalogEmisor[]>([]);
  const [rawActivity, setRawActivity] = useState<ActivityRecord[]>([]);
  const [rawMonitoreo, setRawMonitoreo] = useState<MonitoreoRecord[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedNemonicos, setSelectedNemonicos] = useState<string[]>([]);
  const [selectedPaises, setSelectedPaises] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Con Incidencias' | 'Sin Incidencias'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<keyof NormalizedRecord>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Carga de datos
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [resCatalog, resActivity, resMonitoreo] = await Promise.all([
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${selectedAmbiente}&Proceso=consulta_tablero_emisores_2026`),
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${selectedAmbiente}&Proceso=consulta_tablero_actividad_emisor_2026`),
        fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${selectedAmbiente}&Proceso=consulta_tablero_monitreo_mysatcom_2026`)
      ]);

      if (!resCatalog.ok || !resActivity.ok || !resMonitoreo.ok) {
        throw new Error('Error al consultar datos desde los servicios SARA');
      }

      const [jsonCatalog, jsonActivity, jsonMonitoreo] = await Promise.all([
        resCatalog.json(),
        resActivity.json(),
        resMonitoreo.json()
      ]);

      // Parsear catálogo
      let catalog: CatalogEmisor[] = [];
      if (Array.isArray(jsonCatalog)) {
        jsonCatalog.forEach(item => {
          const dataNode = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(dataNode)) catalog = [...catalog, ...dataNode];
          else if (dataNode && (dataNode.IdEmisor || dataNode.ID_Emisor)) catalog.push(dataNode);
        });
      }

      // Parsear actividad
      let activity: ActivityRecord[] = [];
      if (Array.isArray(jsonActivity)) {
        jsonActivity.forEach(item => {
          const dataNode = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(dataNode)) activity = [...activity, ...dataNode];
          else if (dataNode && (dataNode.IdEmisor || dataNode.ID_Emisor)) activity.push(dataNode);
        });
      }

      // Parsear monitoreo
      let monitoreo: MonitoreoRecord[] = [];
      if (Array.isArray(jsonMonitoreo)) {
        jsonMonitoreo.forEach(item => {
          const dataNode = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(dataNode)) {
            monitoreo = [...monitoreo, ...dataNode];
          } else if (dataNode && (dataNode.Fecha || dataNode.co_fecha_in)) {
            // Mapear campos en caso de que vengan en minúsculas u otros formatos
            monitoreo.push({
              Fecha: dataNode.Fecha || dataNode.fecha || dataNode.co_fecha_in,
              Hora: dataNode.Hora || dataNode.hora,
              IdEmisor: dataNode.IdEmisor || dataNode.idEmisor || dataNode.co_id_emisor || dataNode.ID_Emisor,
              Autorizados: Number(dataNode.Autorizados || dataNode.autorizados || 0),
              NoAutorizados: Number(dataNode.NoAutorizados || dataNode.noAutorizados || dataNode.NoAutorizados || 0),
              TotalHora: Number(dataNode.TotalHora || dataNode.totalHora || dataNode.TotalDiario || 0)
            });
          }
        });
      } else if (jsonMonitoreo && typeof jsonMonitoreo === 'object') {
        const dataNode = jsonMonitoreo.data ? (typeof jsonMonitoreo.data === 'string' ? JSON.parse(jsonMonitoreo.data) : jsonMonitoreo.data) : jsonMonitoreo;
        if (Array.isArray(dataNode)) {
          monitoreo = dataNode.map((d: any) => ({
            Fecha: d.Fecha || d.fecha || d.co_fecha_in,
            Hora: d.Hora || d.hora,
            IdEmisor: d.IdEmisor || d.idEmisor || d.co_id_emisor || d.ID_Emisor,
            Autorizados: Number(d.Autorizados || 0),
            NoAutorizados: Number(d.NoAutorizados || 0),
            TotalHora: Number(d.TotalHora || d.TotalDiario || 0)
          }));
        }
      }

      setRawCatalog(catalog);
      setRawActivity(activity);
      setRawMonitoreo(monitoreo);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido al cargar información de monitoreo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAmbiente]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cruzar y normalizar los datos
  const normalizedRecords = useMemo(() => {
    return rawMonitoreo.map(m => {
      const emisorId = m.IdEmisor;
      const emisorInfo = rawCatalog.find(c => Number(c.IdEmisor || (c as any).ID_Emisor) === Number(emisorId));
      const activityInfo = rawActivity.find(a => Number(a.IdEmisor || (a as any).ID_Emisor) === Number(emisorId));

      const paisId = emisorInfo?.IdPais || emisorInfo?.CodigoPais || emisorInfo?.Pais || 593;
      const paisNombre = PAIS_MAP[paisId] || emisorInfo?.NombrePais || 'Ecuador';

      return {
        fecha: m.Fecha ? String(m.Fecha).split('T')[0] : '',
        hora: m.Hora || '00:00',
        idEmisor: Number(emisorId),
        nemonico: emisorInfo?.Nemonico || emisorInfo?.nemonico || `EM-${emisorId}`,
        razonSocial: emisorInfo?.RazonSocial || emisorInfo?.razon_social || `Emisor ${emisorId}`,
        idPais: Number(paisId),
        paisNombre: paisNombre,
        autorizados: Number(m.Autorizados || 0),
        noAutorizados: Number(m.NoAutorizados || 0),
        totalHora: Number(m.TotalHora || 0),
        ultimoAutorizado: activityInfo?.UltimoAutorizado || '---',
      } as NormalizedRecord;
    });
  }, [rawMonitoreo, rawCatalog, rawActivity]);

  // Listas de filtros únicos
  const nemonicosList = useMemo(() => {
    const list = Array.from(new Set(normalizedRecords.map(r => r.nemonico))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [normalizedRecords]);

  const paisesList = useMemo(() => {
    const list = Array.from(new Set(normalizedRecords.map(r => r.paisNombre))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [normalizedRecords]);

  // Aplicar Filtros y Ordenamiento
  const filteredRecords = useMemo(() => {
    let result = normalizedRecords.filter(item => {
      const matchNemonico = selectedNemonicos.length === 0 || selectedNemonicos.includes(item.nemonico);
      const matchPais = selectedPaises.length === 0 || selectedPaises.includes(item.paisNombre);
      
      let matchStatus = true;
      if (filterStatus === 'Con Incidencias') matchStatus = item.noAutorizados > 0;
      else if (filterStatus === 'Sin Incidencias') matchStatus = item.noAutorizados === 0;

      const matchSearch = !searchTerm || 
        item.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hora?.includes(searchTerm) ||
        item.fecha?.includes(searchTerm);
      
      return matchNemonico && matchPais && matchStatus && matchSearch;
    });

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'autorizados' || sortField === 'noAutorizados' || sortField === 'totalHora') {
        valA = Number(valA);
        valB = Number(valB);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [normalizedRecords, selectedNemonicos, selectedPaises, filterStatus, searchTerm, sortField, sortOrder]);

  // KPIs
  const kpis = useMemo(() => {
    const totalAutorizados = filteredRecords.reduce((acc, curr) => acc + curr.autorizados, 0);
    const totalNoAutorizados = filteredRecords.reduce((acc, curr) => acc + curr.noAutorizados, 0);
    const totalGeneral = totalAutorizados + totalNoAutorizados;
    const tasaEfectividad = totalGeneral > 0 ? (totalAutorizados / totalGeneral) * 100 : 100;
    
    const emisoresUnicosConErrores = new Set(
      filteredRecords.filter(r => r.noAutorizados > 0).map(r => r.idEmisor)
    ).size;

    return {
      autorizados: totalAutorizados,
      noAutorizados: totalNoAutorizados,
      tasa: tasaEfectividad,
      emisoresAfectados: emisoresUnicosConErrores
    };
  }, [filteredRecords]);

  // Gráfica 1: Tendencia Horaria Consolidada
  const hourlyChartData = useMemo(() => {
    const hoursSummary: Record<string, { hora: string, autorizados: number, noAutorizados: number }> = {};
    
    // Rellenar todas las horas por defecto para tener continuidad
    for (let i = 0; i < 24; i++) {
      const hh = String(i).padStart(2, '0') + ':00';
      hoursSummary[hh] = { hora: hh, autorizados: 0, noAutorizados: 0 };
    }

    filteredRecords.forEach(r => {
      const hh = r.hora;
      if (hoursSummary[hh]) {
        hoursSummary[hh].autorizados += r.autorizados;
        hoursSummary[hh].noAutorizados += r.noAutorizados;
      }
    });

    return Object.values(hoursSummary).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [filteredRecords]);

  // Gráfica 2: Top Emisores Afectados (con No Autorizados)
  const topEmisoresChartData = useMemo(() => {
    const emisorSummary: Record<string, { name: string, razonSocial: string, autorizados: number, no_autorizados: number }> = {};
    
    filteredRecords.forEach(r => {
      const key = r.nemonico;
      if (!emisorSummary[key]) {
        emisorSummary[key] = { name: key, razonSocial: r.razonSocial, autorizados: 0, no_autorizados: 0 };
      }
      emisorSummary[key].autorizados += r.autorizados;
      emisorSummary[key].no_autorizados += r.noAutorizados;
    });

    return Object.values(emisorSummary)
      .map(e => ({
        name: e.name,
        emisor: e.razonSocial,
        autorizados: e.autorizados,
        no_autorizados: e.no_autorizados,
        total: e.autorizados + e.no_autorizados
      }))
      .sort((a, b) => b.no_autorizados - a.no_autorizados)
      .slice(0, 10);
  }, [filteredRecords]);

  const toggleSort = (field: keyof NormalizedRecord) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleChartClick = (state: any) => {
    if (state && state.activeLabel) {
      setSelectedNemonicos([state.activeLabel]);
      document.getElementById('grid-area')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setSelectedNemonicos([]);
    setSelectedPaises([]);
    setFilterStatus('Todos');
    setSearchTerm('');
  };

  const handleExport = () => {
    if (!filteredRecords.length) return;
    const csvContent = [
      ['Fecha', 'Hora', 'Emisor', 'Nemonico', 'Pais', 'Autorizados', 'No Autorizados', 'Total', 'Ultimo Autorizado OK'],
      ...filteredRecords.map(r => [
        r.fecha,
        r.hora,
        `"${r.razonSocial.replace(/"/g, '""')}"`,
        r.nemonico,
        r.paisNombre,
        r.autorizados,
        r.noAutorizados,
        r.totalHora,
        r.ultimoAutorizado
      ])
    ].map(e => e.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Monitoreo_mySatcom_${selectedAmbiente}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#0c0c0c] border border-[#71BF44]/20 rounded-3xl shadow-2xl">
            <RefreshCw className="w-12 h-12 text-[#71BF44] animate-spin" />
            <span className="text-[#71BF44] font-black uppercase tracking-widest text-xs">Cargando Monitoreo mySatcom</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
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
                mySatcom Monitoreo <span className="text-[#71BF44] opacity-50 text-sm ml-2 font-black">2026</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex bg-neutral-100 dark:bg-neutral-850 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <button 
                    onClick={() => { setSelectedAmbiente('V5'); }}
                    className={`px-3 py-1 text-[10px] font-black rounded uppercase transition-all ${selectedAmbiente === 'V5' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'}`}
                  >
                    Ambiente V5
                  </button>
                  <button 
                    onClick={() => { setSelectedAmbiente('Colombia'); }}
                    className={`px-3 py-1 text-[10px] font-black rounded uppercase transition-all ${selectedAmbiente === 'Colombia' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'}`}
                  >
                    Colombia-AWS
                  </button>
                </div>
                <div className="w-1 h-1 rounded-full bg-neutral-300" />
                <p className="text-xs text-neutral-500 font-medium tracking-tight">Monitoreo transaccional por hora de emisores (Últimos 5 días).</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refrescar Datos
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Comprobantes Autorizados</p>
          <h3 className="text-3xl font-black text-[#71BF44] leading-none">{kpis.autorizados.toLocaleString()}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Últimos 5 días procesados con éxito.</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Comprobantes No Autorizados</p>
          <h3 className="text-3xl font-black text-red-500 leading-none">{kpis.noAutorizados.toLocaleString()}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Documentos rechazados o con fallas.</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Tasa de Autorización</p>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white leading-none">
            {kpis.tasa.toFixed(2)}%
          </h3>
          <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#71BF44] h-full" style={{ width: `${kpis.tasa}%` }} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Emisores con Incidencias</p>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white leading-none">{kpis.emisoresAfectados}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Con fallos de autorización registrados.</p>
        </div>
      </div>

      {/* Visualizaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        
        {/* Gráfico 1: Tendencia Horaria */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#71BF44]" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                Tendencia de Actividad por Hora
              </h3>
            </div>
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Acumulado General</span>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71BF44" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.1} />
                <XAxis dataKey="hora" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Area name="Autorizados" type="monotone" dataKey="autorizados" stroke="#71BF44" fillOpacity={1} fill="url(#colorOk)" strokeWidth={1.5} />
                <Area name="No Autorizados" type="monotone" dataKey="noAutorizados" stroke="#ef4444" fillOpacity={1} fill="url(#colorFail)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top Emisores */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#71BF44]" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                Top 10 Emisores con Incidencias
              </h3>
            </div>
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Filtrar al hacer clic</span>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEmisoresChartData} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar name="Autorizados" dataKey="autorizados" fill="#71BF44" stackId="stack" radius={[0, 0, 0, 0]} />
                <Bar name="No Autorizados" dataKey="no_autorizados" fill="#ef4444" stackId="stack" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div id="grid-area" className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
        
        {/* Table Filters */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-end justify-between gap-6 bg-neutral-50/50 dark:bg-white/[0.02]">
          <div className="flex flex-wrap items-end gap-6 flex-1 min-w-[500px]">
            
            {/* Filter Company */}
            <MultiSelectDropdown 
              label="Empresa (Nemónico)"
              options={nemonicosList}
              selectedValues={selectedNemonicos}
              onChange={setSelectedNemonicos}
              icon={<Building2 className="w-4 h-4 text-neutral-450 dark:text-neutral-500" />}
              placeholder="Buscar empresa..."
            />

            {/* Filter Pais */}
            <MultiSelectDropdown 
              label="País"
              options={paisesList}
              selectedValues={selectedPaises}
              onChange={setSelectedPaises}
              icon={<Globe className="w-4 h-4 text-neutral-450 dark:text-neutral-500" />}
              placeholder="Buscar país..."
            />

            {/* Filter Estado */}
            <div className="flex flex-col gap-2 w-48">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Estado</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all appearance-none cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  <option value="Con Incidencias">Con Incidencias</option>
                  <option value="Sin Incidencias">Sin Incidencias</option>
                </select>
              </div>
            </div>
            
            {/* Global Search */}
            <div className="flex flex-col gap-2 flex-1 min-w-[280px]">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Buscar en Razón Social, Hora o Fecha</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text"
                  placeholder="Ej: MERAMEXAIR, 13:00, 2026-05..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={clearFilters}
              className="h-12 px-5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-2xl transition-all flex items-center justify-center"
              title="Limpiar filtros"
             >
                <X className="w-5 h-5" />
             </button>
             <button 
              onClick={handleExport}
              className="h-12 bg-neutral-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleSort('fecha')}>
                  Fecha/Hora {sortField === 'fecha' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleSort('nemonico')}>
                  Empresa {sortField === 'nemonico' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleSort('autorizados')}>
                  Autorizados {sortField === 'autorizados' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleSort('noAutorizados')}>
                  No Autorizados {sortField === 'noAutorizados' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 text-right">Total Hora</th>
                <th className="px-8 py-5">Último OK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {filteredRecords.map((row, i) => {
                const hasErrors = row.noAutorizados > 0;
                return (
                  <tr key={i} className="group hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-all">
                    <td className="px-8 py-5 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      <div className="flex flex-col">
                        <span>{row.fecha}</span>
                        <span className="text-[10px] text-[#71BF44] font-bold">{row.hora}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tighter line-clamp-1">{row.razonSocial}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black text-[#71BF44] bg-[#71BF44]/5 px-2 py-0.5 rounded border border-[#71BF44]/10 uppercase tracking-widest">{row.nemonico}</span>
                          <span className="text-[9px] text-neutral-450 dark:text-neutral-550 flex items-center gap-1 uppercase">
                            <Globe className="w-2.5 h-2.5" />
                            {row.paisNombre}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-sm font-black text-[#71BF44] tracking-tighter">
                        {row.autorizados.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-sm font-black tracking-tighter ${hasErrors ? 'text-red-500 font-bold' : 'text-neutral-400'}`}>
                        {row.noAutorizados.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-neutral-800 dark:text-neutral-200">
                      {row.totalHora.toLocaleString()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${row.ultimoAutorizado !== '---' ? 'text-[#71BF44]' : 'text-neutral-350 dark:text-neutral-700'}`} />
                        <span className={`font-medium ${row.ultimoAutorizado !== '---' ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-350 dark:text-neutral-600 italic'}`}>
                          {row.ultimoAutorizado}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20 text-neutral-400">
                      <Search className="w-16 h-16" />
                      <p className="text-2xl font-black uppercase tracking-[0.4em]">Sin Resultados</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 flex flex-col items-center gap-6 py-10 border-t border-neutral-100 dark:border-neutral-800">
         <div className="flex items-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default">
            <div className="w-10 h-10 rounded-xl bg-[#71BF44] flex items-center justify-center shadow-lg shadow-[#71BF44]/20">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-neutral-900 dark:text-white leading-none">Satcom Engine</span>
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">mySatcom Monitoreo Module v1.0</span>
            </div>
         </div>
      </footer>
    </div>
  );
}

// Componente Dropdown de Selección Múltiple Premium
interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  icon?: React.ReactNode;
  placeholder?: string;
}

function MultiSelectDropdown({ label, options, selectedValues, onChange, icon, placeholder = 'Buscar...' }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase()) && opt !== 'Todos'
  );

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange(options.filter(o => o !== 'Todos'));
  };

  const clearAll = () => {
    onChange([]);
  };

  const displayLabel = useMemo(() => {
    if (selectedValues.length === 0) return 'Todos';
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} seleccionados`;
  }, [selectedValues]);

  return (
    <div className="flex flex-col gap-2 w-56 relative" ref={dropdownRef}>
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all cursor-pointer flex items-center justify-between select-none min-h-[42px]"
      >
        <span className="absolute left-3 text-neutral-450">{icon}</span>
        <span className="truncate flex-1 text-neutral-800 dark:text-neutral-200 pr-2">
          {displayLabel}
        </span>
        <span className="text-[10px] text-neutral-400 ml-1">▼</span>
      </div>

      {isOpen && (
        <div className="absolute top-[72px] left-0 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl w-64 p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 relative">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-neutral-450 dark:text-neutral-550" />
            <input 
              type="text" 
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg pl-8 pr-2 py-1 text-[11px] font-bold outline-none focus:border-[#71BF44] text-neutral-800 dark:text-neutral-250"
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-black uppercase text-[#71BF44] px-1 pt-1">
            <button onClick={selectAll} className="hover:underline cursor-pointer">Todos</button>
            <button onClick={clearAll} className="hover:underline text-neutral-400 cursor-pointer">Limpiar</button>
          </div>

          <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

          <div className="flex-1 max-h-40 overflow-y-auto flex flex-col gap-1 pr-1">
            {filteredOptions.length === 0 ? (
              <span className="text-[10px] italic text-neutral-400 p-2 text-center">Sin opciones</span>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedValues.includes(opt);
                return (
                  <label 
                    key={opt}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer text-xs select-none"
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleOption(opt)}
                      className="rounded border-neutral-350 dark:border-neutral-700 text-[#71BF44] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={`truncate ${isSelected ? 'font-bold text-[#71BF44]' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {opt}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
