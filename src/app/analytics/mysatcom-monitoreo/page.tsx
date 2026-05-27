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
  AlertTriangle,
  Radio
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
  Canal: number;
  Autorizados: number;
  Duplicados: number;
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
  canalCodigo: number;
  canalNombre: string;
  autorizados: number;
  duplicados: number;
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

// Catálogo estático por defecto de Canales
const DEFAULT_CHANNELS: Record<number, string> = {
  0: 'FTP',
  1: 'WEB',
  2: 'BRIDGE',
  3: 'SYNC',
  4: 'BDD_SUMESA'
};

export default function MySatcomMonitoreoPage() {
  const [selectedAmbiente, setSelectedAmbiente] = useState<'V5' | 'Colombia'>('V5');
  const [rawCatalog, setRawCatalog] = useState<CatalogEmisor[]>([]);
  const [rawActivity, setRawActivity] = useState<ActivityRecord[]>([]);
  const [rawMonitoreo, setRawMonitoreo] = useState<MonitoreoRecord[]>([]);
  const [channelsCatalog, setChannelsCatalog] = useState<Record<number, string>>(DEFAULT_CHANNELS);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedNemonicos, setSelectedNemonicos] = useState<string[]>([]);
  const [selectedPaises, setSelectedPaises] = useState<string[]>([]);
  const [selectedCanales, setSelectedCanales] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Con Incidencias' | 'Sin Incidencias'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  // Filtros de rango de fechas globales
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Sorting de la tabla principal
  const [sortField, setSortField] = useState<keyof NormalizedRecord>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorting de la tabla de distribución por canales
  const [channelSortField, setChannelSortField] = useState<'canal' | 'autorizados' | 'duplicados' | 'noAutorizados' | 'total'>('total');
  const [channelSortOrder, setChannelSortOrder] = useState<'asc' | 'desc'>('desc');

  // Periodo global de análisis para todos los gráficos (hoy, ayer, semana, todaSemana)
  const [globalPeriod, setGlobalPeriod] = useState<'hoy' | 'ayer' | 'semana' | 'todaSemana'>('hoy');

  // Control para limitar la comparación hasta la hora actual
  const [limitToCurrentHour, setLimitToCurrentHour] = useState<boolean>(false);

  // Canales que el usuario ha decidido ocultar en el gráfico de canales
  const [hiddenChannels, setHiddenChannels] = useState<string[]>([]);

  const toggleChannelVisibility = (channelName: string) => {
    setHiddenChannels(prev => 
      prev.includes(channelName) 
        ? prev.filter(c => c !== channelName) 
        : [...prev, channelName]
    );
  };

  // Obtener la hora actual en la zona horaria local
  const currentHour = useMemo(() => {
    return new Date().getHours();
  }, []);

  // Obtener fecha local actual de forma robusta YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }, []);

  // Calcular las fechas relativas de comparación
  const datesInfo = useMemo(() => {
    const today = new Date(todayStr + 'T00:00:00');
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    return {
      todayStr,
      yesterdayStr,
      weekStartStr
    };
  }, [todayStr]);

  // Carga del catálogo de canales (se carga una sola vez por ambiente)
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${selectedAmbiente}&Proceso=consulta_tablero_canales_mysatcom_2026`);
        if (res.ok) {
          const json = await res.json();
          let parsedChannels: Record<number, string> = { ...DEFAULT_CHANNELS };
          
          let dataList: any[] = [];
          if (Array.isArray(json)) {
            json.forEach(item => {
              const dataNode = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
              if (Array.isArray(dataNode)) dataList = [...dataList, ...dataNode];
              else if (dataNode && (dataNode.CodigoCanal !== undefined || dataNode.codigoCanal !== undefined)) dataList.push(dataNode);
            });
          }
          
          dataList.forEach((ch: any) => {
            const code = Number(ch.CodigoCanal ?? ch.codigoCanal);
            const name = ch.Canal ?? ch.canal;
            if (!isNaN(code) && name) {
              parsedChannels[code] = name;
            }
          });
          
          setChannelsCatalog(parsedChannels);
        }
      } catch (err) {
        console.error("Error al cargar canales desde la API, usando valores estáticos por defecto", err);
      }
    };
    fetchChannels();
  }, [selectedAmbiente]);

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  // Reiniciar paginación cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedNemonicos, selectedPaises, selectedCanales, filterStatus, searchTerm]);

  // Carga de datos principales con mapeo robusto a mayúsculas/minúsculas y TotalHora unificado
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

      // Parsear monitoreo con los nuevos campos y fallbacks robustos para asegurar TotalHora
      let monitoreo: MonitoreoRecord[] = [];
      const processMonitoreoArray = (arr: any[]) => {
        return arr.map((d: any) => {
          const auts = Number(d.Autorizados ?? d.autorizados ?? 0);
          const dups = Number(d.Duplicados ?? d.duplicados ?? 0);
          const noAuts = Number(d.NoAutorizados ?? d.noAutorizados ?? d.no_autorizados ?? 0);
          const canalVal = Number(d.Canal ?? d.canal ?? d.co_canal ?? 0);
          return {
            Fecha: d.Fecha || d.fecha || d.co_fecha_in,
            Hora: d.Hora || d.hora,
            IdEmisor: d.IdEmisor || d.idEmisor || d.co_id_emisor || d.ID_Emisor,
            Canal: canalVal,
            Autorizados: auts,
            Duplicados: dups,
            NoAutorizados: noAuts,
            TotalHora: auts + dups + noAuts
          };
        });
      };

      if (Array.isArray(jsonMonitoreo)) {
        jsonMonitoreo.forEach(item => {
          const dataNode = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(dataNode)) {
            monitoreo = [...monitoreo, ...processMonitoreoArray(dataNode)];
          } else if (dataNode && (dataNode.Fecha || dataNode.fecha || dataNode.co_fecha_in)) {
            monitoreo = [...monitoreo, ...processMonitoreoArray([dataNode])];
          }
        });
      } else if (jsonMonitoreo && typeof jsonMonitoreo === 'object') {
        const dataNode = jsonMonitoreo.data ? (typeof jsonMonitoreo.data === 'string' ? JSON.parse(jsonMonitoreo.data) : jsonMonitoreo.data) : jsonMonitoreo;
        if (Array.isArray(dataNode)) {
          monitoreo = processMonitoreoArray(dataNode);
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

  // Cruzar y normalizar los datos con búsqueda pre-indexada O(1)
  const normalizedRecords = useMemo(() => {
    const catalogMap: Record<number, CatalogEmisor> = {};
    rawCatalog.forEach(c => {
      const id = Number(c.IdEmisor || (c as any).ID_Emisor);
      if (!isNaN(id)) catalogMap[id] = c;
    });

    const activityMap: Record<number, ActivityRecord> = {};
    rawActivity.forEach(a => {
      const id = Number(a.IdEmisor || (a as any).ID_Emisor);
      if (!isNaN(id)) activityMap[id] = a;
    });

    return rawMonitoreo.map(m => {
      const emisorId = Number(m.IdEmisor);
      const emisorInfo = catalogMap[emisorId];
      const activityInfo = activityMap[emisorId];

      const paisId = emisorInfo?.IdPais || emisorInfo?.CodigoPais || emisorInfo?.Pais || 593;
      const paisNombre = PAIS_MAP[paisId] || emisorInfo?.NombrePais || 'Ecuador';

      const canalCod = Number(m.Canal);
      const canalNombre = channelsCatalog[canalCod] || `Canal ${canalCod}`;

      return {
        fecha: m.Fecha ? String(m.Fecha).split('T')[0] : '',
        hora: m.Hora || '00:00',
        idEmisor: emisorId,
        nemonico: emisorInfo?.Nemonico || emisorInfo?.nemonico || `EM-${emisorId}`,
        razonSocial: emisorInfo?.RazonSocial || emisorInfo?.razon_social || `Emisor ${emisorId}`,
        idPais: Number(paisId),
        paisNombre: paisNombre,
        canalCodigo: canalCod,
        canalNombre: canalNombre,
        autorizados: Number(m.Autorizados || 0),
        duplicados: Number(m.Duplicados || 0),
        noAutorizados: Number(m.NoAutorizados || 0),
        totalHora: Number(m.TotalHora || 0),
        ultimoAutorizado: activityInfo?.UltimoAutorizado || '---',
      } as NormalizedRecord;
    });
  }, [rawMonitoreo, rawCatalog, rawActivity, channelsCatalog]);

  // Listas de filtros únicos
  const nemonicosList = useMemo(() => {
    const list = Array.from(new Set(normalizedRecords.map(r => r.nemonico))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [normalizedRecords]);

  const paisesList = useMemo(() => {
    const list = Array.from(new Set(normalizedRecords.map(r => r.paisNombre))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [normalizedRecords]);

  const canalesList = useMemo(() => {
    const list = Array.from(new Set(normalizedRecords.map(r => `${r.canalNombre} (${r.canalCodigo})`))).filter(Boolean).sort();
    return ['Todos', ...list];
  }, [normalizedRecords]);

  // Obtener todas las fechas únicas disponibles
  const allUniqueDates = useMemo(() => {
    const dates = Array.from(new Set(rawMonitoreo.map(r => r.Fecha ? String(r.Fecha).split('T')[0] : ''))).filter(Boolean).sort();
    return dates;
  }, [rawMonitoreo]);

  // Inicializar rango de fechas
  useEffect(() => {
    if (allUniqueDates.length > 0) {
      if (!startDate || !allUniqueDates.includes(startDate)) {
        setStartDate(allUniqueDates[0]);
      }
      if (!endDate || !allUniqueDates.includes(endDate)) {
        setEndDate(allUniqueDates[allUniqueDates.length - 1]);
      }
    }
  }, [allUniqueDates, startDate, endDate]);

  // Aplicar Filtros y Ordenamiento
  const filteredRecordsWithoutDateRange = useMemo(() => {
    let result = normalizedRecords.filter(item => {
      const matchNemonico = selectedNemonicos.length === 0 || selectedNemonicos.includes(item.nemonico);
      const matchPais = selectedPaises.length === 0 || selectedPaises.includes(item.paisNombre);
      const matchCanal = selectedCanales.length === 0 || selectedCanales.includes(`${item.canalNombre} (${item.canalCodigo})`);
      
      let matchStatus = true;
      if (filterStatus === 'Con Incidencias') matchStatus = item.noAutorizados > 0;
      else if (filterStatus === 'Sin Incidencias') matchStatus = item.noAutorizados === 0;

      const matchSearch = !searchTerm || 
        item.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.canalNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.canalCodigo).includes(searchTerm) ||
        String(item.idEmisor).includes(searchTerm) ||
        item.hora?.includes(searchTerm) ||
        item.fecha?.includes(searchTerm);
      
      return matchNemonico && matchPais && matchCanal && matchStatus && matchSearch;
    });

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'autorizados' || sortField === 'duplicados' || sortField === 'noAutorizados' || sortField === 'totalHora') {
        valA = Number(valA);
        valB = Number(valB);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [normalizedRecords, selectedNemonicos, selectedPaises, selectedCanales, filterStatus, searchTerm, sortField, sortOrder]);

  // Aplicar rango de fechas global
  const filteredRecords = useMemo(() => {
    if (!startDate || !endDate) return filteredRecordsWithoutDateRange;
    return filteredRecordsWithoutDateRange.filter(item => {
      return item.fecha >= startDate && item.fecha <= endDate;
    });
  }, [filteredRecordsWithoutDateRange, startDate, endDate]);

  // KPIs actualizados
  const kpis = useMemo(() => {
    const totalAutorizados = filteredRecords.reduce((acc, curr) => acc + curr.autorizados, 0);
    const totalDuplicados = filteredRecords.reduce((acc, curr) => acc + curr.duplicados, 0);
    const totalNoAutorizados = filteredRecords.reduce((acc, curr) => acc + curr.noAutorizados, 0);
    const totalGeneral = totalAutorizados + totalDuplicados + totalNoAutorizados;
    
    const tasaEfectividad = totalGeneral > 0 ? ((totalAutorizados + totalDuplicados) / totalGeneral) * 100 : 100;
    
    const emisoresUnicosConErrores = new Set(
      filteredRecords.filter(r => r.noAutorizados > 0).map(r => r.idEmisor)
    ).size;

    return {
      autorizados: totalAutorizados,
      duplicados: totalDuplicados,
      noAutorizados: totalNoAutorizados,
      tasa: tasaEfectividad,
      emisoresAfectados: emisoresUnicosConErrores
    };
  }, [filteredRecords]);

  // Contadores consolidados por Canal
  const channelSummaryData = useMemo(() => {
    const summary: Record<string, { canal: string, canalCodigo: number, autorizados: number, duplicados: number, noAutorizados: number, total: number }> = {};
    
    filteredRecords.forEach(r => {
      const key = `${r.canalNombre} (${r.canalCodigo})`;
      if (!summary[key]) {
        summary[key] = { canal: r.canalNombre, canalCodigo: r.canalCodigo, autorizados: 0, duplicados: 0, noAutorizados: 0, total: 0 };
      }
      summary[key].autorizados += r.autorizados;
      summary[key].duplicados += r.duplicados;
      summary[key].noAutorizados += r.noAutorizados;
      summary[key].total += r.totalHora;
    });

    return Object.values(summary);
  }, [filteredRecords]);

  // Aplicar Ordenamiento Interactivo a la tabla resumen de canales
  const sortedChannelSummaryData = useMemo(() => {
    const data = [...channelSummaryData];
    data.sort((a, b) => {
      let valA: any = a[channelSortField];
      let valB: any = b[channelSortField];
      
      if (channelSortField !== 'canal') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return channelSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return channelSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [channelSummaryData, channelSortField, channelSortOrder]);

  // Línea de tiempo transaccional agrupada por Canal
  // Línea de tiempo transaccional agrupada por Canal
  const channelTimelineChartData = useMemo(() => {
    const dayRecords = filteredRecordsWithoutDateRange.filter(r => {
      if (globalPeriod === 'hoy') {
        return r.fecha === datesInfo.todayStr;
      } else if (globalPeriod === 'ayer') {
        return r.fecha === datesInfo.yesterdayStr;
      } else if (globalPeriod === 'semana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha < datesInfo.todayStr;
      } else if (globalPeriod === 'todaSemana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha <= datesInfo.todayStr;
      }
      return true;
    });

    const uniqueChannels = Array.from(new Set(normalizedRecords.map(r => r.canalNombre))).filter(Boolean);
    const points: Record<string, any> = {};
    
    // Inicializar las horas del gráfico (hasta 23:00, o limitadas hasta la hora actual si limitToCurrentHour es true)
    const maxHour = limitToCurrentHour ? currentHour : 23;
    
    for (let h = 0; h <= maxHour; h++) {
      const hStr = String(h).padStart(2, '0') + ':00';
      
      points[hStr] = {
        key: hStr,
        label: hStr,
        hora: hStr,
      };
      
      uniqueChannels.forEach(ch => {
        points[hStr][ch] = 0;
      });
    }
    
    // Poblar con la suma transaccional real de cada canal
    dayRecords.forEach(r => {
      const hh = r.hora;
      if (points[hh]) {
        const hInt = parseInt(hh.split(':')[0], 10);
        if (!limitToCurrentHour || hInt <= currentHour) {
          points[hh][r.canalNombre] = (points[hh][r.canalNombre] || 0) + r.totalHora;
        }
      }
    });

    let dateLabel = '';
    if (globalPeriod === 'hoy') dateLabel = datesInfo.todayStr;
    else if (globalPeriod === 'ayer') dateLabel = datesInfo.yesterdayStr;
    else if (globalPeriod === 'semana') dateLabel = `Semana (Sin Hoy: ${datesInfo.weekStartStr} al ${datesInfo.yesterdayStr})`;
    else if (globalPeriod === 'todaSemana') dateLabel = `Semana (Con Hoy: ${datesInfo.weekStartStr} al ${datesInfo.todayStr})`;

    return {
      data: Object.values(points).sort((a, b) => a.key.localeCompare(b.key)),
      channels: uniqueChannels,
      dateLabel
    };
  }, [filteredRecordsWithoutDateRange, normalizedRecords, globalPeriod, datesInfo, limitToCurrentHour, currentHour]);

  // Gráfica 1: Tendencia Horaria Consolidada (filtro temporal: hoy, ayer, semana, todaSemana)
  const hourlyChartData = useMemo(() => {
    const hoursSummary: Record<string, { hora: string, autorizados: number, duplicados: number, noAutorizados: number }> = {};
    
    const maxHour = limitToCurrentHour ? currentHour : 23;
    for (let i = 0; i <= maxHour; i++) {
      const hh = String(i).padStart(2, '0') + ':00';
      hoursSummary[hh] = { hora: hh, autorizados: 0, duplicados: 0, noAutorizados: 0 };
    }

    const filteredForTrend = filteredRecordsWithoutDateRange.filter(r => {
      if (globalPeriod === 'hoy') {
        return r.fecha === datesInfo.todayStr;
      } else if (globalPeriod === 'ayer') {
        return r.fecha === datesInfo.yesterdayStr;
      } else if (globalPeriod === 'semana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha < datesInfo.todayStr;
      } else if (globalPeriod === 'todaSemana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha <= datesInfo.todayStr;
      }
      return true;
    });

    filteredForTrend.forEach(r => {
      const hh = r.hora;
      if (hoursSummary[hh]) {
        const hInt = parseInt(hh.split(':')[0], 10);
        if (!limitToCurrentHour || hInt <= currentHour) {
          hoursSummary[hh].autorizados += r.autorizados;
          hoursSummary[hh].duplicados += r.duplicados;
          hoursSummary[hh].noAutorizados += r.noAutorizados;
        }
      }
    });

    return Object.values(hoursSummary).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [filteredRecordsWithoutDateRange, globalPeriod, datesInfo, limitToCurrentHour, currentHour]);

  // Gráfica 2: Top Emisores Afectados
  const topEmisoresChartData = useMemo(() => {
    const emisorSummary: Record<string, { name: string, razonSocial: string, autorizados: number, duplicados: number, no_autorizados: number }> = {};
    
    const filteredForTop = filteredRecordsWithoutDateRange.filter(r => {
      if (globalPeriod === 'hoy') {
        return r.fecha === datesInfo.todayStr;
      } else if (globalPeriod === 'ayer') {
        return r.fecha === datesInfo.yesterdayStr;
      } else if (globalPeriod === 'semana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha < datesInfo.todayStr;
      } else if (globalPeriod === 'todaSemana') {
        return r.fecha >= datesInfo.weekStartStr && r.fecha <= datesInfo.todayStr;
      }
      return true;
    }).filter(r => {
      if (limitToCurrentHour) {
        const hInt = parseInt(r.hora.split(':')[0], 10);
        return hInt <= currentHour;
      }
      return true;
    });

    filteredForTop.forEach(r => {
      const key = r.nemonico;
      if (!emisorSummary[key]) {
        emisorSummary[key] = { name: key, razonSocial: r.razonSocial, autorizados: 0, duplicados: 0, no_autorizados: 0 };
      }
      emisorSummary[key].autorizados += r.autorizados;
      emisorSummary[key].duplicados += r.duplicados;
      emisorSummary[key].no_autorizados += r.noAutorizados;
    });

    return Object.values(emisorSummary)
      .map(e => ({
        name: e.name,
        emisor: e.razonSocial,
        autorizados: e.autorizados,
        duplicados: e.duplicados,
        no_autorizados: e.no_autorizados,
        total: e.autorizados + e.duplicados + e.no_autorizados
      }))
      .sort((a, b) => b.no_autorizados - a.no_autorizados)
      .slice(0, 10);
  }, [filteredRecordsWithoutDateRange, globalPeriod, datesInfo, limitToCurrentHour, currentHour]);

  // Análisis de Anomalías de la Operación Actual (Hoy)
  const anomaliesAnalysis = useMemo(() => {
    const todayRecords = filteredRecordsWithoutDateRange.filter(r => r.fecha === datesInfo.todayStr && parseInt(r.hora.split(':')[0], 10) <= currentHour);
    const historicalRecords = filteredRecordsWithoutDateRange.filter(r => r.fecha !== datesInfo.todayStr && parseInt(r.hora.split(':')[0], 10) <= currentHour);
    
    const uniqueHistDays = Array.from(new Set(historicalRecords.map(r => r.fecha))).filter(Boolean);
    const histDaysCount = uniqueHistDays.length || 1;

    const todayAuts = todayRecords.reduce((acc, r) => acc + r.autorizados, 0);
    const todayDups = todayRecords.reduce((acc, r) => acc + r.duplicados, 0);
    const todayNoAuts = todayRecords.reduce((acc, r) => acc + r.noAutorizados, 0);
    const todayTotal = todayAuts + todayDups + todayNoAuts;

    const histAutsAvg = historicalRecords.reduce((acc, r) => acc + r.autorizados, 0) / histDaysCount;
    const histDupsAvg = historicalRecords.reduce((acc, r) => acc + r.duplicados, 0) / histDaysCount;
    const histNoAutsAvg = historicalRecords.reduce((acc, r) => acc + r.noAutorizados, 0) / histDaysCount;
    const histTotalAvg = histAutsAvg + histDupsAvg + histNoAutsAvg;

    const alerts: { type: 'danger' | 'warning' | 'info' | 'success', message: string, detail: string }[] = [];

    if (todayTotal > 0 && histTotalAvg > 0) {
      const autPct = ((todayAuts - histAutsAvg) / (histAutsAvg || 1)) * 100;
      if (autPct < -20) {
        alerts.push({
          type: 'danger',
          message: 'Bajo Volumen de Aprobaciones',
          detail: `Hoy se han autorizado ${todayAuts.toLocaleString()} comprobantes, un ${Math.abs(autPct).toFixed(1)}% MENOS del promedio histórico a esta hora (${histAutsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`
        });
      } else if (autPct > 20) {
        alerts.push({
          type: 'success',
          message: 'Pico de Facturación / Autorizados',
          detail: `Operación con alto rendimiento: hoy se han autorizado ${todayAuts.toLocaleString()} comprobantes, un ${autPct.toFixed(1)}% MÁS que el promedio histórico a esta hora (${histAutsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`
        });
      }

      const dupPct = ((todayDups - histDupsAvg) / (histDupsAvg || 1)) * 100;
      if (todayDups > histDupsAvg + 10 && dupPct > 25) {
        alerts.push({
          type: 'warning',
          message: 'Alerta de Comprobantes Duplicados',
          detail: `Se detecta un incremento de duplicados (Estado 14) de +${dupPct.toFixed(1)}% (Hoy: ${todayDups.toLocaleString()} vs Promedio a esta hora: ${histDupsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`
        });
      }

      const noAutPct = ((todayNoAuts - histNoAutsAvg) / (histNoAutsAvg || 1)) * 100;
      if (todayNoAuts > histNoAutsAvg + 10 && noAutPct > 25) {
        alerts.push({
          type: 'danger',
          message: 'Incremento de Comprobantes No Autorizados',
          detail: `Pico crítico de rechazos de +${noAutPct.toFixed(1)}% (Hoy: ${todayNoAuts.toLocaleString()} vs Promedio a esta hora: ${histNoAutsAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`
        });
      }
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'info',
        message: 'Comportamiento transaccional estable',
        detail: 'El flujo transaccional y la tasa de aprobación de hoy se encuentran dentro de los parámetros normales habituales (variación < 15%).'
      });
    }

    const emisorTodayMap: Record<string, { razonSocial: string, auts: number, dups: number, noAuts: number }> = {};
    const emisorHistMap: Record<string, { razonSocial: string, auts: number, dups: number, noAuts: number }> = {};

    todayRecords.forEach(r => {
      if (!emisorTodayMap[r.nemonico]) {
        emisorTodayMap[r.nemonico] = { razonSocial: r.razonSocial, auts: 0, dups: 0, noAuts: 0 };
      }
      emisorTodayMap[r.nemonico].auts += r.autorizados;
      emisorTodayMap[r.nemonico].dups += r.duplicados;
      emisorTodayMap[r.nemonico].noAuts += r.noAutorizados;
    });

    historicalRecords.forEach(r => {
      if (!emisorHistMap[r.nemonico]) {
        emisorHistMap[r.nemonico] = { razonSocial: r.razonSocial, auts: 0, dups: 0, noAuts: 0 };
      }
      emisorHistMap[r.nemonico].auts += r.autorizados;
      emisorHistMap[r.nemonico].dups += r.duplicados;
      emisorHistMap[r.nemonico].noAuts += r.noAutorizados;
    });

    const emisorAnomalies: { nemonico: string, razonSocial: string, todayAuts: number, todayNoAuts: number, todayDups: number, histAutsAvg: number, histNoAutsAvg: number, histDupsAvg: number, pctChange: number, label: string }[] = [];

    Object.keys(emisorTodayMap).forEach(nemonico => {
      const today = emisorTodayMap[nemonico];
      const hist = emisorHistMap[nemonico] || { auts: 0, dups: 0, noAuts: 0 };

      const eHistAutsAvg = hist.auts / histDaysCount;
      const eHistNoAutsAvg = hist.noAuts / histDaysCount;
      const eHistDupsAvg = hist.dups / histDaysCount;

      let pctChange = 0;
      let label = '';
      
      if (today.noAuts > eHistNoAutsAvg + 5) {
        pctChange = eHistNoAutsAvg > 0 ? ((today.noAuts - eHistNoAutsAvg) / eHistNoAutsAvg) * 100 : 100;
        label = `Pico de Errores (Hoy: ${today.noAuts} vs Prom: ${eHistNoAutsAvg.toFixed(1)})`;
      }
      else if (today.dups > eHistDupsAvg + 5) {
        pctChange = eHistDupsAvg > 0 ? ((today.dups - eHistDupsAvg) / eHistDupsAvg) * 100 : 100;
        label = `Pico de Duplicados (Hoy: ${today.dups} vs Prom: ${eHistDupsAvg.toFixed(1)})`;
      }
      else if (eHistAutsAvg > 10 && today.auts < eHistAutsAvg * 0.5) {
        pctChange = ((eHistAutsAvg - today.auts) / eHistAutsAvg) * 100;
        label = `Baja Aprobación (${pctChange.toFixed(0)}% menos de lo normal)`;
      }

      if (label) {
        emisorAnomalies.push({
          nemonico,
          razonSocial: today.razonSocial,
          todayAuts: today.auts,
          todayNoAuts: today.noAuts,
          todayDups: today.dups,
          histAutsAvg: eHistAutsAvg,
          histNoAutsAvg: eHistNoAutsAvg,
          histDupsAvg: eHistDupsAvg,
          pctChange,
          label
        });
      }
    });

    return {
      alerts,
      topAnomalousEmisores: emisorAnomalies.sort((a, b) => b.pctChange - a.pctChange).slice(0, 5)
    };
  }, [datesInfo, currentHour, filteredRecordsWithoutDateRange]);

  // Pestañas locales para gráficos
  const [activeChartTab, setActiveChartTab] = useState<'acumulado' | 'historial' | 'comparador'>('acumulado');

  // Línea de tiempo con detalle por hora
  const timelineChartData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const hourlySummary: Record<string, { label: string, key: string, fecha: string, hora: string, autorizados: number, duplicados: number, noAutorizados: number }> = {};
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    const isSingleDay = startDate === endDate;

    const current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const fStr = `${year}-${month}-${day}`;

      for (let h = 0; h < 24; h++) {
        const hStr = String(h).padStart(2, '0') + ':00';
        const key = `${fStr} ${hStr}`;
        const label = isSingleDay 
          ? hStr 
          : `${month}-${day} ${hStr}`;

        hourlySummary[key] = {
          key,
          label,
          fecha: fStr,
          hora: hStr,
          autorizados: 0,
          duplicados: 0,
          noAutorizados: 0
        };
      }
      current.setDate(current.getDate() + 1);
    }

    filteredRecords.forEach(r => {
      const key = `${r.fecha} ${r.hora}`;
      if (hourlySummary[key]) {
        hourlySummary[key].autorizados += r.autorizados;
        hourlySummary[key].duplicados += r.duplicados;
        hourlySummary[key].noAutorizados += r.noAutorizados;
      }
    });

    return Object.values(hourlySummary).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredRecords, startDate, endDate]);

  // Lista de fechas únicas para el comparador
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(filteredRecordsWithoutDateRange.map(r => r.fecha))).filter(Boolean).sort();
    return dates.reverse();
  }, [filteredRecordsWithoutDateRange]);

  // Estados de comparación
  const [compareDayA, setCompareDayA] = useState<string>('');
  const [compareDayB, setCompareDayB] = useState<string>('');
  const [compareMetric, setCompareMetric] = useState<'noAutorizados' | 'autorizados' | 'duplicados' | 'todos'>('noAutorizados');

  // Inicializar días de comparación
  useEffect(() => {
    if (uniqueDates.length > 0) {
      if (!compareDayA || !uniqueDates.includes(compareDayA)) {
        setCompareDayA(uniqueDates[0]);
      }
      if (!compareDayB || !uniqueDates.includes(compareDayB)) {
        setCompareDayB(uniqueDates[1] || uniqueDates[0]);
      }
    }
  }, [uniqueDates, compareDayA, compareDayB]);

  // Datos para gráfico comparativo
  const comparisonChartData = useMemo(() => {
    if (!compareDayA || !compareDayB) return [];

    const hoursSummary: Record<string, { hora: string, dayA_ok: number, dayA_dup: number, dayA_fail: number, dayB_ok: number, dayB_dup: number, dayB_fail: number }> = {};
    
    for (let i = 0; i < 24; i++) {
      const hh = String(i).padStart(2, '0') + ':00';
      hoursSummary[hh] = { hora: hh, dayA_ok: 0, dayA_dup: 0, dayA_fail: 0, dayB_ok: 0, dayB_dup: 0, dayB_fail: 0 };
    }

    filteredRecordsWithoutDateRange.forEach(r => {
      const hh = r.hora;
      if (hoursSummary[hh]) {
        if (r.fecha === compareDayA) {
          hoursSummary[hh].dayA_ok += r.autorizados;
          hoursSummary[hh].dayA_dup += r.duplicados;
          hoursSummary[hh].dayA_fail += r.noAutorizados;
        }
        if (r.fecha === compareDayB) {
          hoursSummary[hh].dayB_ok += r.autorizados;
          hoursSummary[hh].dayB_dup += r.duplicados;
          hoursSummary[hh].dayB_fail += r.noAutorizados;
        }
      }
    });

    return Object.values(hoursSummary).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [filteredRecordsWithoutDateRange, compareDayA, compareDayB]);

  // Paginación
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  }, [filteredRecords, pageSize]);

  const toggleSort = (field: keyof NormalizedRecord) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  // Función para ordenar la tabla de canales
  const toggleChannelSort = (field: typeof channelSortField) => {
    if (channelSortField === field) {
      setChannelSortOrder(channelSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setChannelSortField(field);
      setChannelSortOrder('desc');
    }
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
    setSelectedCanales([]);
    setFilterStatus('Todos');
    setSearchTerm('');
    setLocalSearchTerm('');
    if (allUniqueDates.length > 0) {
      setStartDate(allUniqueDates[0]);
      setEndDate(allUniqueDates[allUniqueDates.length - 1]);
    }
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (!filteredRecords.length) return;
    const csvContent = [
      ['Fecha', 'Hora', 'Emisor', 'Nemonico', 'Pais', 'Canal', 'Autorizados', 'Duplicados', 'No Autorizados', 'Total', 'Ultimo Autorizado OK'],
      ...filteredRecords.map(r => [
        r.fecha,
        r.hora,
        `"${r.razonSocial.replace(/"/g, '""')}"`,
        r.nemonico,
        r.paisNombre,
        r.canalNombre,
        r.autorizados,
        r.duplicados,
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
                <p className="text-xs text-neutral-500 font-medium tracking-tight">Monitoreo transaccional por hora, canal y estado de comprobantes.</p>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Comprobantes Autorizados</p>
          <h3 className="text-3xl font-black text-[#71BF44] leading-none">{kpis.autorizados.toLocaleString()}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Autorizados con éxito en el período.</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Comprobantes Duplicados</p>
          <h3 className="text-3xl font-black text-blue-500 leading-none">{kpis.duplicados.toLocaleString()}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Transacciones duplicadas (Estado 14).</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Comprobantes No Autorizados</p>
          <h3 className="text-3xl font-black text-red-500 leading-none">{kpis.noAutorizados.toLocaleString()}</h3>
          <p className="text-[10px] text-neutral-400 mt-2">Rechazados o fallidos (Sin Duplicados).</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Tasa de Efectividad</p>
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

      {/* Pestañas de Visualización */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6 gap-2 bg-neutral-50/50 dark:bg-white/[0.01] p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveChartTab('acumulado')}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all tracking-wider cursor-pointer ${activeChartTab === 'acumulado' ? 'bg-[#71BF44] text-white dark:text-[#111] shadow' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'}`}
        >
          Análisis Acumulado
        </button>
        <button
          onClick={() => setActiveChartTab('historial')}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all tracking-wider cursor-pointer ${activeChartTab === 'historial' ? 'bg-[#71BF44] text-white dark:text-[#111] shadow' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'}`}
        >
          Línea de Tiempo Diaria
        </button>
        <button
          onClick={() => setActiveChartTab('comparador')}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition-all tracking-wider cursor-pointer ${activeChartTab === 'comparador' ? 'bg-[#71BF44] text-white dark:text-[#111] shadow' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'}`}
        >
          Comparador de Días
        </button>
      </div>

      {/* Renderizado de Visualizaciones según pestaña activa */}
      {activeChartTab === 'acumulado' && (
        <div className="flex flex-col gap-8 mb-10">
          {/* Selector de periodo unificado y opciones globales */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Periodo de Análisis:</span>
              <div className="flex bg-neutral-105 dark:bg-neutral-850 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase">
                <button 
                  onClick={() => setGlobalPeriod('hoy')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${globalPeriod === 'hoy' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-450'}`}
                >
                  Hoy
                </button>
                <button 
                  onClick={() => setGlobalPeriod('ayer')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${globalPeriod === 'ayer' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-450'}`}
                >
                  Ayer
                </button>
                <button 
                  onClick={() => setGlobalPeriod('semana')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${globalPeriod === 'semana' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-450'}`}
                >
                  Semana (Exc. Hoy)
                </button>
                <button 
                  onClick={() => setGlobalPeriod('todaSemana')}
                  className={`px-4 py-2 rounded transition-all cursor-pointer ${globalPeriod === 'todaSemana' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-450'}`}
                >
                  Toda la Semana
                </button>
              </div>
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={limitToCurrentHour} 
                onChange={(e) => setLimitToCurrentHour(e.target.checked)}
                className="w-4.5 h-4.5 text-[#71BF44] bg-neutral-105 border-neutral-300 rounded focus:ring-[#71BF44] focus:ring-2 dark:focus:ring-offset-neutral-900 focus:ring-offset-2 dark:bg-neutral-800 dark:border-neutral-700 cursor-pointer"
              />
              <span className="text-xs font-bold text-neutral-750 dark:text-neutral-300 uppercase tracking-wider">
                Comparar solo hasta la hora actual ({String(currentHour).padStart(2, '0')}:00)
              </span>
            </label>
          </div>

          {/* Panel de Detección de Anomalías (HOY) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna de Alertas Generales de la Plataforma */}
            <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Análisis y Estado General de la Operación (Hoy)
                </h3>
              </div>
              <div className="flex flex-col gap-4 flex-1 justify-center">
                {anomaliesAnalysis.alerts.map((alert, idx) => {
                  const bgColors = {
                    danger: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
                    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
                    success: 'bg-[#71BF44]/10 border-[#71BF44]/20 text-emerald-700 dark:text-emerald-400',
                    info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                  };
                  const textColors = {
                    danger: 'text-red-500',
                    warning: 'text-amber-500',
                    success: 'text-[#71BF44]',
                    info: 'text-blue-500'
                  };
                  return (
                    <div key={idx} className={`p-5 border rounded-2xl ${bgColors[alert.type]} flex gap-4 items-start`}>
                      <div className={`p-2 rounded-xl bg-white dark:bg-[#1c1c1c] border border-current/10 shrink-0 ${textColors[alert.type]}`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider mb-1">{alert.message}</h4>
                        <p className="text-xs opacity-90 leading-relaxed font-medium">{alert.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Columna de Emisores con Comportamiento Diferente (Top 5) */}
            <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-[#71BF44]" />
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Top 5 Emisores con Operación Inusual
                </h3>
              </div>
              <div className="flex flex-col gap-4 flex-1 overflow-y-auto max-h-[300px]">
                {anomaliesAnalysis.topAnomalousEmisores.map((emisor, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedNemonicos([emisor.nemonico]);
                      document.getElementById('grid-area')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-4 border border-neutral-100 dark:border-neutral-800 hover:border-[#71BF44]/30 dark:hover:border-[#71BF44]/30 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.01] transition-all group"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-black text-neutral-900 dark:text-white group-hover:text-[#71BF44] transition-colors truncate">
                        {emisor.nemonico}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-bold truncate">
                        {emisor.razonSocial}
                      </span>
                      <span className="text-[10px] text-red-500 font-black uppercase mt-1">
                        {emisor.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black text-red-500">
                        {emisor.pctChange > 0 ? `+${emisor.pctChange.toFixed(0)}%` : `-${emisor.pctChange.toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                ))}
                {anomaliesAnalysis.topAnomalousEmisores.length === 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-[#71BF44] opacity-50 mb-2" />
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Emisores estables</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico 1: Tendencia Horaria (Filtro Unificado) */}
            <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <Clock className="w-5 h-5 text-[#71BF44]" />
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Tendencia de Actividad por Hora
                </h3>
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#71BF44" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDup" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                    <Area name="Duplicados" type="monotone" dataKey="duplicados" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDup)" strokeWidth={1.5} />
                    <Area name="No Autorizados" type="monotone" dataKey="noAutorizados" stroke="#ef4444" fillOpacity={1} fill="url(#colorFail)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Top Emisores */}
            <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <Building2 className="w-5 h-5 text-[#71BF44]" />
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Top 10 Emisores con Incidencias
                </h3>
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
                    <Bar name="Autorizados" dataKey="autorizados" fill="#71BF44" stackId="stack" />
                    <Bar name="Duplicados" dataKey="duplicados" fill="#3b82f6" stackId="stack" />
                    <Bar name="No Autorizados" dataKey="no_autorizados" fill="#ef4444" stackId="stack" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Nueva Sección: Contadores por Canal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tabla resumen de Canales con Ordenamiento */}
            <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Radio className="w-5 h-5 text-[#71BF44]" />
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                    Distribución Transaccional por Canal
                  </h3>
                </div>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Ordenar haciendo clic en columnas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest select-none">
                      <th className="py-4 cursor-pointer hover:text-[#71BF44] transition-colors" onClick={() => toggleChannelSort('canal')}>
                        Canal (Código) {channelSortField === 'canal' && (channelSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)}
                      </th>
                      <th className="py-4 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleChannelSort('autorizados')}>
                        Autorizados {channelSortField === 'autorizados' && (channelSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)}
                      </th>
                      <th className="py-4 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleChannelSort('duplicados')}>
                        Duplicados {channelSortField === 'duplicados' && (channelSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)}
                      </th>
                      <th className="py-4 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleChannelSort('noAuthorized' as any)}>
                        No Autorizados {channelSortField === 'noAutorizados' && (channelSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)}
                      </th>
                      <th className="py-4 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleChannelSort('total')}>
                        Total {channelSortField === 'total' && (channelSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)}
                      </th>
                      <th className="py-4 text-right">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                    {sortedChannelSummaryData.map((row, i) => {
                      const totalGeneral = kpis.autorizados + kpis.duplicados + kpis.noAutorizados;
                      const pct = totalGeneral > 0 ? (row.total / totalGeneral) * 100 : 0;
                      return (
                        <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-white/[0.01]">
                          <td className="py-4 font-black text-neutral-800 dark:text-neutral-200 uppercase">
                            {row.canal} <span className="text-[10px] font-mono text-neutral-400 font-bold ml-1">({row.canalCodigo})</span>
                          </td>
                          <td className="py-4 text-right text-[#71BF44] font-bold">{row.autorizados.toLocaleString()}</td>
                          <td className="py-4 text-right text-blue-500 font-bold">{row.duplicados.toLocaleString()}</td>
                          <td className="py-4 text-right text-red-500 font-bold">{row.noAutorizados.toLocaleString()}</td>
                          <td className="py-4 text-right font-black text-neutral-950 dark:text-white">{row.total.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono text-neutral-550">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    {sortedChannelSummaryData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center italic text-neutral-400">Sin datos de canales en el periodo</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Gráfico de línea de tiempo con transacciones por Canal */}
            <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                    Línea de Tiempo por Canal (Trx)
                  </h3>
                  <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-widest block mt-0.5">
                    Actividad de: <strong className="text-[#71BF44]">{channelTimelineChartData.dateLabel}</strong>
                  </span>
                </div>
                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Haz clic en la leyenda para ocultar/mostrar</span>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={channelTimelineChartData.data} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.1} />
                    <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 8 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#888', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }} />
                    <Legend 
                      onClick={(props) => toggleChannelVisibility(props.value as string)}
                      iconType="circle" 
                      wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', cursor: 'pointer' }}
                      formatter={(value) => (
                        <span style={{ opacity: hiddenChannels.includes(value) ? 0.35 : 1, textDecoration: hiddenChannels.includes(value) ? 'line-through' : 'none' }}>
                          {value}
                        </span>
                      )}
                    />
                    {channelTimelineChartData.channels.map((ch, idx) => {
                      if (hiddenChannels.includes(ch)) return null;
                      const colors = ['#71BF44', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#ef4444'];
                      const color = colors[idx % colors.length];
                      return (
                        <Line 
                          key={ch} 
                          name={ch} 
                          type="monotone" 
                          dataKey={ch} 
                          stroke={color} 
                          strokeWidth={1.5} 
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeChartTab === 'historial' && (
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm mb-10">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#71BF44]" />
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Línea de Tiempo Técnica (Evolución Detallada por Hora)
                </h3>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">Comportamiento temporal de comprobantes procesados por hora</p>
              </div>
            </div>

            {/* Controles de Rango de Fechas */}
            <div className="flex flex-wrap items-center gap-4 bg-neutral-50/50 dark:bg-neutral-850 p-2 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-neutral-455 uppercase tracking-widest">Desde:</span>
                <select
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-850 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[#71BF44]/50 cursor-pointer"
                >
                  {allUniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-neutral-455 uppercase tracking-widest">Hasta:</span>
                <select
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (e.target.value < startDate) {
                      setStartDate(e.target.value);
                    }
                  }}
                  className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-850 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[#71BF44]/50 cursor-pointer"
                >
                  {allUniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              
              <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 hidden sm:block"></div>
              
              <button
                onClick={() => {
                  if (allUniqueDates.length > 0) {
                    setStartDate(allUniqueDates[0]);
                    setEndDate(allUniqueDates[allUniqueDates.length - 1]);
                  }
                }}
                className="text-[10px] font-black uppercase text-[#71BF44] hover:underline cursor-pointer px-2"
              >
                Ver Todo
              </button>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#71BF44]" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Autorizados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Duplicados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">No Autorizados</span>
              </div>
            </div>
          </div>

          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineChartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="histColorOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71BF44" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="histColorDup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="histColorFail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.1} />
                <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1a1a1a] border border-neutral-800 p-4 rounded-2xl shadow-xl text-xs flex flex-col gap-1.5">
                          <span className="font-mono text-neutral-400 text-[10px] uppercase">Detalle Temporal</span>
                          <span className="font-black text-white">{data.fecha} a las {data.hora}</span>
                          <div className="h-px bg-neutral-800 my-1" />
                          <div className="flex items-center gap-2 text-[#71BF44]">
                            <div className="w-2 h-2 rounded-full bg-[#71BF44]" />
                            <span>Autorizados: <strong className="text-white">{data.autorizados.toLocaleString()}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-blue-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Duplicados: <strong className="text-white">{data.duplicados.toLocaleString()}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-red-500">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span>No Autorizados: <strong className="text-white">{data.noAutorizados.toLocaleString()}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-neutral-400 font-bold mt-0.5 border-t border-neutral-800 pt-1.5">
                            <span>Total Hora: <strong className="text-white">{(data.autorizados + data.duplicados + data.noAutorizados).toLocaleString()}</strong></span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Area name="Autorizados" type="monotone" dataKey="autorizados" stroke="#71BF44" fillOpacity={1} fill="url(#histColorOk)" strokeWidth={1.5} />
                <Area name="Duplicados" type="monotone" dataKey="duplicados" stroke="#3b82f6" fillOpacity={1} fill="url(#histColorDup)" strokeWidth={1.5} />
                <Area name="No Autorizados" type="monotone" dataKey="noAutorizados" stroke="#ef4444" fillOpacity={1} fill="url(#histColorFail)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeChartTab === 'comparador' && (
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-8 shadow-sm mb-10 flex flex-col gap-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#71BF44]" />
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest">
                  Comparativa Horaria Interdiaria (Día A vs Día B)
                </h3>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">Analiza el patrón de errores hora por hora entre dos fechas</p>
              </div>
            </div>

            {/* Controles de Selección de Día */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-neutral-455 uppercase tracking-widest">Día A:</span>
                <select
                  value={compareDayA}
                  onChange={(e) => setCompareDayA(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-xs font-bold text-neutral-850 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[#71BF44]/50 cursor-pointer"
                >
                  {uniqueDates.length > 0 ? (
                    uniqueDates.map(d => <option key={d} value={d}>{d}</option>)
                  ) : (
                    <option value="">Sin datos</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-neutral-455 uppercase tracking-widest">Día B:</span>
                <select
                  value={compareDayB}
                  onChange={(e) => setCompareDayB(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2 text-xs font-bold text-neutral-850 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[#71BF44]/50 cursor-pointer"
                >
                  {uniqueDates.length > 0 ? (
                    uniqueDates.map(d => <option key={d} value={d}>{d}</option>)
                  ) : (
                    <option value="">Sin datos</option>
                  )}
                </select>
              </div>

              <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-2 hidden sm:block"></div>

              {/* Selector de Métrica */}
              <div className="flex bg-neutral-50 dark:bg-neutral-850 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setCompareMetric('noAutorizados')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded uppercase transition-all cursor-pointer ${compareMetric === 'noAutorizados' ? 'bg-red-500 text-white' : 'text-neutral-500 hover:text-neutral-850 dark:text-neutral-455'}`}
                >
                  No Autorizados
                </button>
                <button
                  onClick={() => setCompareMetric('duplicados')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded uppercase transition-all cursor-pointer ${compareMetric === 'duplicados' ? 'bg-blue-500 text-white' : 'text-neutral-500 hover:text-neutral-850 dark:text-neutral-455'}`}
                >
                  Duplicados
                </button>
                <button
                  onClick={() => setCompareMetric('autorizados')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded uppercase transition-all cursor-pointer ${compareMetric === 'autorizados' ? 'bg-[#71BF44] text-white dark:text-[#111]' : 'text-neutral-500 hover:text-neutral-850 dark:text-neutral-455'}`}
                >
                  Autorizados
                </button>
                <button
                  onClick={() => setCompareMetric('todos')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded uppercase transition-all cursor-pointer ${compareMetric === 'todos' ? 'bg-neutral-800 text-white dark:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-850 dark:text-neutral-455'}`}
                >
                  Todos
                </button>
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonChartData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.1} />
                <XAxis dataKey="hora" tick={{ fill: '#888', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#181818', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                
                {(compareMetric === 'autorizados' || compareMetric === 'todos') && (
                  <Line name={`Día A: Autorizados (${compareDayA})`} type="monotone" dataKey="dayA_ok" stroke="#71BF44" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                )}
                {(compareMetric === 'autorizados' || compareMetric === 'todos') && (
                  <Line name={`Día B: Autorizados (${compareDayB})`} type="monotone" dataKey="dayB_ok" stroke="#9ee379" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                )}

                {(compareMetric === 'duplicados' || compareMetric === 'todos') && (
                  <Line name={`Día A: Duplicados (${compareDayA})`} type="monotone" dataKey="dayA_dup" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                )}
                {(compareMetric === 'duplicados' || compareMetric === 'todos') && (
                  <Line name={`Día B: Duplicados (${compareDayB})`} type="monotone" dataKey="dayB_dup" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                )}
                
                {(compareMetric === 'noAutorizados' || compareMetric === 'todos') && (
                  <Line name={`Día A: No Autorizados (${compareDayA})`} type="monotone" dataKey="dayA_fail" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                )}
                {(compareMetric === 'noAutorizados' || compareMetric === 'todos') && (
                  <Line name={`Día B: No Autorizados (${compareDayB})`} type="monotone" dataKey="dayB_fail" stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
              icon={<Building2 className="w-4 h-4 text-neutral-450 dark:text-neutral-550" />}
              placeholder="Buscar empresa..."
            />

            {/* Filter Pais */}
            <MultiSelectDropdown 
              label="País"
              options={paisesList}
              selectedValues={selectedPaises}
              onChange={setSelectedPaises}
              icon={<Globe className="w-4 h-4 text-neutral-450 dark:text-neutral-550" />}
              placeholder="Buscar país..."
            />

            {/* Filter Canal */}
            <MultiSelectDropdown 
              label="Canal"
              options={canalesList}
              selectedValues={selectedCanales}
              onChange={setSelectedCanales}
              icon={<Radio className="w-4 h-4 text-neutral-450 dark:text-neutral-550" />}
              placeholder="Buscar canal..."
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
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Buscar en Razón Social, Canal, Hora o Fecha</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text" 
                  placeholder="Ej: FTP, WEB, 13:00, 2026-05..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#71BF44]/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={clearFilters}
              className="h-12 px-5 bg-neutral-100 dark:bg-neutral-850 text-neutral-500 hover:text-red-500 rounded-2xl transition-all flex items-center justify-center border border-neutral-200 dark:border-neutral-750"
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
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleSort('duplicados')}>
                  Duplicados {sortField === 'duplicados' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 cursor-pointer hover:text-[#71BF44] transition-colors text-right" onClick={() => toggleSort('noAutorizados')}>
                  No Autorizados {sortField === 'noAutorizados' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </th>
                <th className="px-8 py-5 text-right">Total Hora</th>
                <th className="px-8 py-5">Último OK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {paginatedRecords.map((row, i) => {
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
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black text-[#71BF44] bg-[#71BF44]/5 px-2 py-0.5 rounded border border-[#71BF44]/10 uppercase tracking-widest">{row.nemonico}</span>
                          <span className="text-[9px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800/50 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 font-mono font-bold">ID: {row.idEmisor}</span>
                          <span className="text-[9px] text-neutral-450 dark:text-neutral-555 flex items-center gap-1 uppercase">
                            <Globe className="w-2.5 h-2.5" />
                            {row.paisNombre}
                          </span>
                          <span className="text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded border border-blue-500/10 font-bold uppercase tracking-wider">
                            {row.canalNombre} <span className="text-[8px] font-mono text-blue-400 font-bold">({row.canalCodigo})</span>
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
                      <span className="text-sm font-black text-blue-500 tracking-tighter">
                        {row.duplicados.toLocaleString()}
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
                  <td colSpan={7} className="py-24 text-center">
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

        {/* Controles de Paginación */}
        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50/30 dark:bg-white/[0.005]">
          <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
            Mostrando {filteredRecords.length === 0 ? 0 : Math.min(filteredRecords.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredRecords.length, currentPage * pageSize)} de {filteredRecords.length.toLocaleString()} registros
          </div>
          
          <div className="flex flex-wrap items-center gap-6">
            {/* Selector de tamaño de página */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            {/* Botones de navegación */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-lg text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                title="Primera página"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-lg text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-xs font-black text-neutral-800 dark:text-neutral-250 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-lg text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              >
                Siguiente
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-lg text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                title="Última página"
              >
                »
              </button>
            </div>
          </div>
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
              <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-[0.2em] mt-1">mySatcom Monitoreo Module v1.0</span>
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
        <span className="text-[10px] text-neutral-450 ml-1">▼</span>
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
