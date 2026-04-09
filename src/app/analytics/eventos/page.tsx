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
  Info
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

export default function EventHistoryPage() {
  const [data, setData] = useState<EventoRabbit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter States
  const [selectedEstado, setSelectedEstado] = useState<string>('todos');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('todos');
  const [searchQuery, setSearchQuery] = useState('');

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
    return data.filter(item => {
      // Estado filter
      if (selectedEstado !== 'todos' && item.estado !== selectedEstado) return false;
      
      // Search filter (ambiente, evento, detalle)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          item.ambiente?.toLowerCase().includes(query) || 
          item.evento?.toLowerCase().includes(query) || 
          item.detalle_evento?.toLowerCase().includes(query) ||
          item.pais?.toLowerCase().includes(query);
        if (!matches) return false;
      }

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

      return true;
    });
  }, [data, selectedEstado, selectedTimeRange, searchQuery]);

  // Unique values for filters
  const estados = useMemo(() => {
    const set = new Set(data.map(d => d.estado).filter(Boolean));
    return ['todos', ...Array.from(set)];
  }, [data]);

  // Chart Data Processing
  const { chartData, eventTypes } = useMemo(() => {
    if (filteredData.length === 0) return { chartData: [], eventTypes: [] };

    const types = Array.from(new Set(filteredData.map(d => d.evento)));
    
    // Group by Date (ignoring exact time for smoother display if many events)
    // We'll use the 'key' or a formatted date/hour depending on the range
    const timeMap: Record<string, any> = {};

    // Sort by date ascending for the chart
    const sorted = [...filteredData].sort((a, b) => 
      new Date(a.fecha_evento).getTime() - new Date(b.fecha_evento).getTime()
    );

    sorted.forEach(item => {
      // Format X-axis label based on precision needed
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

    return { 
      chartData: Object.values(timeMap), 
      eventTypes: types 
    };
  }, [filteredData, selectedTimeRange]);

  const downloadCSV = () => {
    if (filteredData.length === 0) return;

    const headers = [
      'Fecha Evento',
      'Ambiente',
      'País',
      'Evento',
      'Num Eventos',
      'Estado',
      'Causa/Detalle',
      'Reportado Por'
    ];

    const rows = filteredData.map(d => [
      formatDate(d.fecha_evento, true),
      d.ambiente,
      d.pais,
       d.evento,
      d.num_eventos,
      d.estado,
      d.detalle_evento.replace(/\n|\r/g, ' '),
      d.reporta
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Historial_Eventos_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#71BF44', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Seguimiento detallado de la actividad técnica de Satcom.</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        <div className="relative group lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 transition-colors group-focus-within:text-[#71BF44]" />
          <input 
            type="text" 
            placeholder="Buscar por ambiente, evento..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#71BF44]/20 focus:border-[#71BF44] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1 lg:col-span-1">
          <Activity className="w-4 h-4 text-neutral-400" />
          <select 
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold outline-none py-1.5 cursor-pointer capitalize"
          >
            {estados.map(est => (
              <option key={est} value={est}>{est === 'todos' ? 'Todos los Estados' : est}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1a1a1a] p-1 rounded-xl lg:col-span-2">
          {(['hoy', 'semana', 'mes', 'trimestre', 'todos'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all ${selectedTimeRange === range ? 'bg-[#71BF44] text-white shadow-md' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Eventos Filtrados', value: filteredData.length, icon: Database, color: 'text-[#71BF44]', bg: 'bg-[#71BF44]/5' },
          { label: 'Tipos de Eventos', value: eventTypes.length, icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Suma de Eventos', value: filteredData.reduce((acc, curr) => acc + (parseInt(curr.num_eventos) || 0), 0).toLocaleString(), icon: Info, color: 'text-purple-500', bg: 'bg-purple-500/5' },
          { label: 'Hoy', value: data.filter(d => new Date(d.fecha_evento).toDateString() === new Date().toDateString()).length, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/5' }
        ].map((stat, i) => (
          <div key={i} className={`flex items-center gap-4 ${stat.bg} border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm`}>
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} shadow-inner`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{stat.label}</p>
              <h4 className={`text-xl font-black ${stat.color}`}>{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-[#71BF44]/20 border-t-[#71BF44] rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-500">Analizando historial de eventos…</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-neutral-900 dark:text-white font-bold mb-2">Error al cargar datos</p>
          <p className="text-sm text-neutral-500 mb-6">{error}</p>
          <button onClick={() => fetchData()} className="text-sm font-black text-[#71BF44] uppercase tracking-widest hover:underline px-6 py-2 border border-[#71BF44]/20 rounded-xl">Intentar de nuevo</button>
        </div>
      ) : (
        <>
          {/* Timeline Chart */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-[#71BF44] rounded-full"></span>
              <h3 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Evolución del Volumen de Eventos</h3>
            </div>
            
            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm h-[450px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => val.toLocaleString()}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111', 
                        border: '1px solid #333', 
                        borderRadius: '16px',
                        fontSize: '11px',
                        color: '#fff',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ color: '#fff' }}
                      cursor={{ stroke: '#71BF44', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle" 
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '30px' }} 
                    />
                    {eventTypes.map((type, index) => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={type}
                        name={type}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        animationDuration={1500}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2 italic">
                  <Activity className="w-10 h-10 opacity-20" />
                  <p>Sin datos suficientes para graficar con los filtros actuales.</p>
                </div>
              )}
            </div>
          </section>

          {/* Details Table */}
          <section>
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-6 bg-[#3b82f6] rounded-full"></span>
                <h3 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Bitácora Detallada de Actividad</h3>
              </div>
              <span className="text-[10px] font-bold text-neutral-500 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                Mostrando {filteredData.length} registros
              </span>
            </div>

            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-100 dark:border-neutral-800">
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Fecha Ingreso</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ambiente / País</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Evento</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Detalle</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-neutral-400 uppercase tracking-widest">Volumen</th>
                      <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 italic font-medium">
                          No se encontraron eventos para los criterios de búsqueda aplicados.
                        </td>
                      </tr>
                    ) : (
                      filteredData.slice(0, 100).map((ev, i) => (
                        <tr key={ev.created_at + i} className="group hover:bg-neutral-50 dark:hover:bg-[#111] transition-all">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-200">{formatDate(ev.fecha_evento, true)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-[#71BF44] uppercase">{ev.ambiente}</span>
                              <span className="text-[10px] text-neutral-500 font-bold">{ev.pais}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                              {ev.evento}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-[10px] font-medium text-neutral-500 leading-normal line-clamp-2" title={ev.detalle_evento}>
                              {ev.detalle_evento || '-'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-black text-[#71BF44]">{ev.num_eventos ?? '--'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {ev.estado === 'Enviado' || ev.estado === 'Activo' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : ev.estado === 'Error' || ev.estado === 'Inactivo' ? (
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                              ) : (
                                <Info className="w-3.5 h-3.5 text-blue-500" />
                              )}
                              <span className={`text-[10px] font-black uppercase tracking-widest ${
                                ev.estado === 'Enviado' || ev.estado === 'Activo' ? 'text-emerald-500' : 
                                ev.estado === 'Error' || ev.estado === 'Inactivo' ? 'text-red-500' : 'text-blue-500'
                              }`}>
                                {ev.estado}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredData.length > 100 && (
                <div className="bg-neutral-50 dark:bg-[#0c0c0c] px-6 py-3 text-center border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Se muestran los 100 registros más recientes. Utilice la descarga CSV para ver el historial completo.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
