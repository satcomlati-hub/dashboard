'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Activity, 
  Network, 
  Server, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

interface MetricData {
  timestamp: number;
  cpu_percent: number;
  ram: {
    total_mb: number;
    used_mb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    percent: number;
  };
  load_average: {
    '1m': number;
    '5m': number;
    '15m': number;
  };
  network: {
    bytes_sent_sec: number;
    bytes_recv_sec: number;
  };
  services: {
    docker: boolean;
    n8n: boolean;
  };
}

interface ApiResponse {
  online: boolean;
  current: MetricData | null;
  history: MetricData[];
}

// Formatear bytes a KB/s o MB/s
const formatSpeed = (bytes: number): string => {
  if (bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Formatear timestamps para el eje X
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function SaraPerformancePage() {
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>({ online: false, current: null, history: [] });

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/sara/metrics');
      if (!res.ok) throw new Error('Error al consultar las métricas');
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo establecer la conexión con el servidor de métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  // Efecto para polling automático
  useEffect(() => {
    fetchMetrics();
    
    if (isPaused) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 3000); // Recarga cada 3 segundos

    return () => clearInterval(interval);
  }, [isPaused, fetchMetrics]);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  const current = data.current;
  const historyData = data.history.map(item => ({
    time: formatTime(item.timestamp),
    CPU: item.cpu_percent,
    RAM: item.ram.percent,
  }));

  return (
    <div className="space-y-6">
      {/* Header con Controles y Estado */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight flex items-center gap-2">
            <Server className="w-7 h-7 text-[#71BF44]" />
            Rendimiento de Servidor SARA
          </h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
            Monitoreo en tiempo real de recursos y servicios del nodo Ubuntu SARA (129.146.162.57).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {loading ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Cargando...
            </span>
          ) : data.online ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              En línea
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50">
              <AlertTriangle className="w-3.5 h-3.5" />
              Desconectado
            </span>
          )}

          {/* Botones de Control */}
          <button
            onClick={handleTogglePause}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-[#71BF44] hover:text-[#71BF44] transition-all bg-white dark:bg-[#131313]"
            title={isPaused ? 'Reanudar actualización' : 'Pausar actualización'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Reanudar' : 'Pausar'}
          </button>

          <button
            onClick={handleManualRefresh}
            className="p-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-[#71BF44] hover:text-[#71BF44] transition-all bg-white dark:bg-[#131313]"
            title="Actualizar ahora"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!data.online && !loading && (
        <div className="p-8 bg-amber-50 border border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/30 rounded-xl text-amber-800 dark:text-amber-400 flex flex-col md:flex-row items-center gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
          <div>
            <h4 className="font-bold text-base">Agente de Monitoreo Inactivo</h4>
            <p className="text-sm mt-1">
              No se han recibido métricas de SARA en los últimos 15 segundos. Asegúrate de que el servicio <code>sara-monitor.service</code> esté ejecutándose en el servidor.
            </p>
          </div>
        </div>
      )}

      {/* Grid Principal de Recursos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Tarjeta CPU */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-neutral-500 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider">Uso de CPU</span>
            <Cpu className="w-5 h-5 text-[#71BF44]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">
              {current ? current.cpu_percent : '0'}%
            </span>
          </div>
          <div className="mt-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
            <div 
              className="bg-[#71BF44] h-2 rounded-full transition-all duration-500" 
              style={{ width: `${current ? current.cpu_percent : 0}%` }}
            />
          </div>
        </div>

        {/* Tarjeta Memoria RAM */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-neutral-500 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider">Memoria RAM</span>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">
              {current ? current.ram.percent : '0'}%
            </span>
            <span className="text-xs text-neutral-500">
              ({current ? `${Math.round(current.ram.used_mb / 1024)}GB` : '0GB'} / {current ? `${Math.round(current.ram.total_mb / 1024)}GB` : '0GB'})
            </span>
          </div>
          <div className="mt-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${current ? current.ram.percent : 0}%` }}
            />
          </div>
        </div>

        {/* Tarjeta Disco */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-neutral-500 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider">Almacenamiento (/)</span>
            <HardDrive className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">
              {current ? current.disk.percent : '0'}%
            </span>
            <span className="text-xs text-neutral-500">
              ({current ? `${Math.round(current.disk.used_gb)}GB` : '0GB'} / {current ? `${Math.round(current.disk.total_gb)}GB` : '0GB'})
            </span>
          </div>
          <div className="mt-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
            <div 
              className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${current ? current.disk.percent : 0}%` }}
            />
          </div>
        </div>

        {/* Tarjeta Carga de Red */}
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-neutral-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Tráfico de Red</span>
            <Network className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 flex items-center gap-1">
                <ArrowDown className="w-3.5 h-3.5 text-emerald-500" /> Bajada:
              </span>
              <span className="font-semibold">{current ? formatSpeed(current.network.bytes_recv_sec) : '0 B/s'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 flex items-center gap-1">
                <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> Subida:
              </span>
              <span className="font-semibold">{current ? formatSpeed(current.network.bytes_sent_sec) : '0 B/s'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos de Historial en Tiempo Real */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historial CPU/RAM */}
        <div className="lg:col-span-2 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
            Historial en Tiempo Real (CPU y Memoria)
          </h3>
          <div className="h-72 w-full">
            {historyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-400 text-sm">
                Recopilando datos históricos...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#71BF44" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" className="dark:stroke-neutral-800" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#888888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(19, 19, 19, 0.9)', 
                      borderColor: '#333', 
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Area type="monotone" dataKey="CPU" stroke="#71BF44" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                  <Area type="monotone" dataKey="RAM" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Carga del Sistema y Estado de Servicios */}
        <div className="space-y-6">
          {/* Carga de Sistema */}
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
              Carga del Sistema (Load Average)
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-neutral-50 dark:bg-[#1c1c1c] p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <span className="block text-2xl font-bold tracking-tight">
                  {current ? current.load_average['1m'] : '0.00'}
                </span>
                <span className="text-[10px] uppercase font-bold text-neutral-400">1 Minuto</span>
              </div>
              <div className="bg-neutral-50 dark:bg-[#1c1c1c] p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <span className="block text-2xl font-bold tracking-tight">
                  {current ? current.load_average['5m'] : '0.00'}
                </span>
                <span className="text-[10px] uppercase font-bold text-neutral-400">5 Minutos</span>
              </div>
              <div className="bg-neutral-50 dark:bg-[#1c1c1c] p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <span className="block text-2xl font-bold tracking-tight">
                  {current ? current.load_average['15m'] : '0.00'}
                </span>
                <span className="text-[10px] uppercase font-bold text-neutral-400">15 Minutos</span>
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-4 leading-relaxed">
              El promedio de carga representa la saturación de CPU en el tiempo. Valores por debajo del número de núcleos de CPU indican un servidor saludable.
            </p>
          </div>

          {/* Servicios Críticos */}
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
              Servicios Críticos en SARA
            </h3>
            <div className="space-y-3">
              {/* Docker */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-sm font-semibold">Motor Docker</span>
                </div>
                {current && current.services.docker ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                    <CheckCircle className="w-4 h-4" /> Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500">
                    <AlertTriangle className="w-4 h-4" /> Inactivo
                  </span>
                )}
              </div>

              {/* n8n SARA */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                  <span className="text-sm font-semibold">n8n Local (SARA)</span>
                </div>
                {current && current.services.n8n ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                    <CheckCircle className="w-4 h-4" /> Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                    <AlertTriangle className="w-4 h-4" /> Caído/Offline
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
