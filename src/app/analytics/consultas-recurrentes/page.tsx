'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  RefreshCw, 
  Search, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Server, 
  TrendingUp, 
  BarChart3, 
  Database,
  Building2,
  Calendar,
  AlertCircle,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Copy,
  Braces,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface SPEmisorAgrupado {
  id: number;
  nemonico: string;
}

interface EmitterRecord {
  IdEmisor: number;
  Nemonico: string;
  Estado: string;
  NombreComercial: string;
  Identificacion: string;
  RazonSocial: string;
  CodigoPais: number;
  FechaCreacion: string;
  FechaActualizacion: string;
  UltimaTrxAutorizada: string | null;
  HoraUltimaTrx: string | null;
}

interface SPRecord {
  StoredProcedure: string;
  IdEmisor: number | null;
  TotalEjecuciones: number;
  TiempoTotal_ms: number;
  TiempoPromedio_ms: number;
  TiempoMaximo_ms: number;
  TiempoMinimo_ms: number;
  TotalBloqueos: number;
  Fecha: string;
  // Campos enriquecidos opcionales
  Nemonico?: string | null;
  PaisId?: number | null;
  UltimaTrxAutorizada?: string | null;
  HoraUltimaTrx?: string | null;
  EmisoresAgrupados?: SPEmisorAgrupado[];
}

export default function ConsultasRecurrentesPage() {
  const [data, setData] = useState<SPRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'mas-ejecutados' | 'mas-lentos' | 'mas-bloqueados' | 'alertas' | 'todos'>('mas-ejecutados');
  const [excludedSPs, setExcludedSPs] = useState<string[]>([]);
  const [groupBySP, setGroupBySP] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [copiedState, setCopiedState] = useState<{ idx: number; type: 'text' | 'json' } | null>(null);
  const [selectedEmisorId, setSelectedEmisorId] = useState<number | null>(null);
  const [modalSP, setModalSP] = useState<string | null>(null);
  const [modalSortConfig, setModalSortConfig] = useState<{ key: 'nemonico' | 'paisId' | 'ejecuciones' | 'tiempoPromedio' | 'bloqueos' | 'ultimaTrx'; direction: 'asc' | 'desc' } | null>({ key: 'ejecuciones', direction: 'desc' });

  // Estados para optimización en memoria de emisores y comparativa por fecha
  const [emitters, setEmitters] = useState<Record<number, EmitterRecord>>({});
  const emittersRef = useRef<Record<number, EmitterRecord>>({});
  const [selectedDate, setSelectedDate] = useState<string>('TODOS');
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [dateA, setDateA] = useState<string>('');
  const [dateB, setDateB] = useState<string>('');

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  const requestModalSort = (key: 'nemonico' | 'paisId' | 'ejecuciones' | 'tiempoPromedio' | 'bloqueos' | 'ultimaTrx') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (modalSortConfig && modalSortConfig.key === key && modalSortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (modalSortConfig && modalSortConfig.key === key && modalSortConfig.direction === 'desc') {
      setModalSortConfig(null);
      return;
    }
    setModalSortConfig({ key, direction });
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      // 1. Carga optimizada de emisores en memoria
      let currentEmitters = emittersRef.current;
      if (isRefresh || Object.keys(currentEmitters).length === 0) {
        try {
          const emitRes = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_emisores_2026`);
          if (emitRes.ok) {
            const emitJson = await emitRes.json();
            let rawEmitters: EmitterRecord[] = [];
            
            if (Array.isArray(emitJson)) {
              emitJson.forEach(item => {
                const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
                if (Array.isArray(p)) {
                  rawEmitters = [...rawEmitters, ...p];
                } else if (p && p.IdEmisor !== undefined) {
                  rawEmitters.push(p);
                }
              });
            }
            
            const dict: Record<number, EmitterRecord> = {};
            rawEmitters.forEach(em => {
              const id = Number(em.IdEmisor);
              if (!isNaN(id)) {
                dict[id] = {
                  ...em,
                  IdEmisor: id,
                  CodigoPais: Number(em.CodigoPais) || 0
                };
              }
            });
            
            emittersRef.current = dict;
            setEmitters(dict);
            currentEmitters = dict;
          }
        } catch (emitErr) {
          console.error('Error al cargar catálogo de emisores:', emitErr);
        }
      }
      
      // 2. Carga de monitoreo de Stored Procedures
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_monitoreo_sps_2026`);
      if (!res.ok) throw new Error('Error al conectar con SARA');
      
      const json = await res.json();
      let records: SPRecord[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          const p = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : item;
          if (Array.isArray(p)) {
            records = [...records, ...p];
          } else if (p && p.StoredProcedure !== undefined) {
            records.push(p);
          }
        });
      }
      
      // Normalización de tipos de datos y cruce con emisores
      const normalized = records.map(r => {
        const idEmisorNum = r.IdEmisor !== null ? Number(r.IdEmisor) : null;
        const em = idEmisorNum !== null ? currentEmitters[idEmisorNum] : null;
        
        return {
          ...r,
          TotalEjecuciones: Number(r.TotalEjecuciones) || 0,
          TiempoTotal_ms: Number(r.TiempoTotal_ms) || 0,
          TiempoPromedio_ms: Number(r.TiempoPromedio_ms) || 0,
          TiempoMaximo_ms: Number(r.TiempoMaximo_ms) || 0,
          TiempoMinimo_ms: Number(r.TiempoMinimo_ms) || 0,
          TotalBloqueos: Number(r.TotalBloqueos) || 0,
          IdEmisor: idEmisorNum,
          Fecha: r.Fecha || '',
          
          // Enriquecimiento de datos desde la caché en memoria de emisores
          Nemonico: em ? em.Nemonico : (idEmisorNum ? `ID ${idEmisorNum}` : 'S/N'),
          PaisId: em ? em.CodigoPais : null,
          UltimaTrxAutorizada: em ? em.UltimaTrxAutorizada : null,
          HoraUltimaTrx: em ? em.HoraUltimaTrx : null
        };
      });
      
      setData(normalized);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido al obtener datos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Datos filtrados por exclusión (se excluye si coincide con la lista de SPs excluidos)
  const dataFilteredByExclusions = useMemo(() => {
    return data.filter(r => !excludedSPs.some(excluded => r.StoredProcedure.toLowerCase() === excluded.toLowerCase()));
  }, [data, excludedSPs]);

  // Fechas únicas disponibles en el dataset
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    data.forEach(r => {
      if (r.Fecha) dates.add(r.Fecha);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [data]);

  // Efecto para inicializar las fechas de comparación
  useEffect(() => {
    if (uniqueDates.length >= 2) {
      if (!dateA) setDateA(uniqueDates[0]);
      if (!dateB) setDateB(uniqueDates[1]);
    } else if (uniqueDates.length === 1) {
      if (!dateA) setDateA(uniqueDates[0]);
      if (!dateB) setDateB(uniqueDates[0]);
    }
  }, [uniqueDates, dateA, dateB]);

  // Datos filtrados por fecha (solo para modo normal)
  const dataFilteredByDate = useMemo(() => {
    if (comparisonMode) return dataFilteredByExclusions;
    if (selectedDate === 'TODOS') return dataFilteredByExclusions;
    return dataFilteredByExclusions.filter(r => r.Fecha === selectedDate);
  }, [dataFilteredByExclusions, selectedDate, comparisonMode]);

  // Datos filtrados por emisor focalizado
  const dataFiltered = useMemo(() => {
    return dataFilteredByDate.filter(r => {
      if (selectedEmisorId === null) return true;
      return r.IdEmisor === selectedEmisorId;
    });
  }, [dataFilteredByDate, selectedEmisorId]);

  // Agrupamiento por Stored Procedure (opcional)
  const groupedData = useMemo(() => {
    if (!groupBySP) return dataFiltered;
    
    const map = new Map<string, SPRecord>();
    dataFiltered.forEach(r => {
      const key = r.StoredProcedure;
      const current = map.get(key);
      const emisorObj = r.IdEmisor && r.Nemonico ? { id: r.IdEmisor, nemonico: r.Nemonico } : null;
      
      if (!current) {
        map.set(key, {
          ...r,
          IdEmisor: null,
          Nemonico: null,
          EmisoresAgrupados: emisorObj ? [emisorObj] : []
        });
      } else {
        const totalEj = current.TotalEjecuciones + r.TotalEjecuciones;
        const tiempoTotal = current.TiempoTotal_ms + r.TiempoTotal_ms;
        
        const emisores = [...(current.EmisoresAgrupados || [])];
        if (emisorObj && !emisores.some(e => e.id === emisorObj.id)) {
          emisores.push(emisorObj);
        }
        
        map.set(key, {
          StoredProcedure: key,
          IdEmisor: null,
          Nemonico: null,
          PaisId: current.PaisId === r.PaisId ? current.PaisId : null,
          TotalEjecuciones: totalEj,
          TiempoTotal_ms: tiempoTotal,
          TiempoPromedio_ms: totalEj > 0 ? Math.round(tiempoTotal / totalEj) : 0,
          TiempoMaximo_ms: Math.max(current.TiempoMaximo_ms, r.TiempoMaximo_ms),
          TiempoMinimo_ms: Math.min(current.TiempoMinimo_ms, r.TiempoMinimo_ms),
          TotalBloqueos: current.TotalBloqueos + r.TotalBloqueos,
          Fecha: current.Fecha, // Mantener fecha
          UltimaTrxAutorizada: (current.UltimaTrxAutorizada && r.UltimaTrxAutorizada) 
            ? (new Date(current.UltimaTrxAutorizada) > new Date(r.UltimaTrxAutorizada) ? current.UltimaTrxAutorizada : r.UltimaTrxAutorizada)
            : (current.UltimaTrxAutorizada || r.UltimaTrxAutorizada),
          HoraUltimaTrx: current.HoraUltimaTrx,
          EmisoresAgrupados: emisores
        });
      }
    });
    return Array.from(map.values());
  }, [dataFiltered, groupBySP]);

  // KPIs globales calculados (en modo comparación reflejan Día A y su diferencia contra Día B)
  const kpis = useMemo(() => {
    const baseList = comparisonMode 
      ? dataFilteredByExclusions.filter(r => r.Fecha === dateA && (selectedEmisorId === null || r.IdEmisor === selectedEmisorId))
      : dataFiltered;
      
    const listB = comparisonMode
      ? dataFilteredByExclusions.filter(r => r.Fecha === dateB && (selectedEmisorId === null || r.IdEmisor === selectedEmisorId))
      : [];

    const totalConsultas = baseList.reduce((acc, r) => acc + r.TotalEjecuciones, 0);
    const tiempoTotalSec = baseList.reduce((acc, r) => acc + r.TiempoTotal_ms, 0) / 1000;
    const totalBloqueos = baseList.reduce((acc, r) => acc + r.TotalBloqueos, 0);
    const tasaBloqueo = totalConsultas > 0 ? (totalBloqueos / totalConsultas) * 100 : 0;

    const totalConsultasB = listB.reduce((acc, r) => acc + r.TotalEjecuciones, 0);
    const tiempoTotalSecB = listB.reduce((acc, r) => acc + r.TiempoTotal_ms, 0) / 1000;
    const totalBloqueosB = listB.reduce((acc, r) => acc + r.TotalBloqueos, 0);
    const tasaBloqueoB = totalConsultasB > 0 ? (totalBloqueosB / totalConsultasB) * 100 : 0;
    
    // Alertas de emisores activos pero sin trx autorizadas en las últimas 2 semanas (14 días)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 14);
    
    const alertEmisores = baseList.filter(r => {
      if (!r.IdEmisor || r.IdEmisor <= 0) return false;
      if (r.TotalEjecuciones === 0) return false;
      
      if (!r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---') {
        return true;
      }
      
      const trxDate = new Date(r.UltimaTrxAutorizada);
      return !isNaN(trxDate.getTime()) && trxDate < thresholdDate;
    });

    const uniqueAlertEmisores = Array.from(new Set(alertEmisores.map(r => r.IdEmisor)));

    return {
      totalConsultas,
      tiempoTotalSec,
      totalBloqueos,
      tasaBloqueo,
      totalConsultasB,
      tiempoTotalSecB,
      totalBloqueosB,
      tasaBloqueoB,
      alertasCount: uniqueAlertEmisores.length,
      alertEmisoresList: alertEmisores
    };
  }, [dataFiltered, dataFilteredByExclusions, comparisonMode, dateA, dateB, selectedEmisorId]);

  // Lógica de comparación interdiaria
  const comparisonRecords = useMemo(() => {
    if (!comparisonMode) return [];

    const baseList = dataFilteredByExclusions.filter(r => selectedEmisorId === null || r.IdEmisor === selectedEmisorId);
    const map = new Map<string, {
      StoredProcedure: string;
      IdEmisor: number | null;
      Nemonico: string | null;
      PaisId: number | null;
      EmisoresAgrupados: SPEmisorAgrupado[];
      
      ejecucionesA: number;
      tiempoTotalA: number;
      bloqueosA: number;
      tiempoMaximoA: number;
      
      ejecucionesB: number;
      tiempoTotalB: number;
      bloqueosB: number;
      tiempoMaximoB: number;
    }>();

    baseList.forEach(r => {
      if (r.Fecha !== dateA && r.Fecha !== dateB) return;

      const isDateA = r.Fecha === dateA;
      const key = groupBySP ? r.StoredProcedure : `${r.StoredProcedure}_${r.IdEmisor || 0}`;
      const current = map.get(key);

      const emisorObj = r.IdEmisor && r.Nemonico ? { id: r.IdEmisor, nemonico: r.Nemonico } : null;

      if (!current) {
        map.set(key, {
          StoredProcedure: r.StoredProcedure,
          IdEmisor: groupBySP ? null : r.IdEmisor,
          Nemonico: groupBySP ? null : (r.Nemonico ?? null),
          PaisId: r.PaisId || null,
          EmisoresAgrupados: emisorObj ? [emisorObj] : [],
          
          ejecucionesA: isDateA ? r.TotalEjecuciones : 0,
          tiempoTotalA: isDateA ? r.TiempoTotal_ms : 0,
          bloqueosA: isDateA ? r.TotalBloqueos : 0,
          tiempoMaximoA: isDateA ? r.TiempoMaximo_ms : 0,
          
          ejecucionesB: !isDateA ? r.TotalEjecuciones : 0,
          tiempoTotalB: !isDateA ? r.TiempoTotal_ms : 0,
          bloqueosB: !isDateA ? r.TotalBloqueos : 0,
          tiempoMaximoB: !isDateA ? r.TiempoMaximo_ms : 0,
        });
      } else {
        const emisores = [...current.EmisoresAgrupados];
        if (emisorObj && !emisores.some(e => e.id === emisorObj.id)) {
          emisores.push(emisorObj);
        }

        map.set(key, {
          ...current,
          PaisId: current.PaisId === r.PaisId ? current.PaisId : null,
          EmisoresAgrupados: emisores,
          
          ejecucionesA: current.ejecucionesA + (isDateA ? r.TotalEjecuciones : 0),
          tiempoTotalA: current.tiempoTotalA + (isDateA ? r.TiempoTotal_ms : 0),
          bloqueosA: current.bloqueosA + (isDateA ? r.TotalBloqueos : 0),
          tiempoMaximoA: isDateA ? Math.max(current.tiempoMaximoA, r.TiempoMaximo_ms) : current.tiempoMaximoA,
          
          ejecucionesB: current.ejecucionesB + (!isDateA ? r.TotalEjecuciones : 0),
          tiempoTotalB: current.tiempoTotalB + (!isDateA ? r.TiempoTotal_ms : 0),
          bloqueosB: current.bloqueosB + (!isDateA ? r.TotalBloqueos : 0),
          tiempoMaximoB: !isDateA ? Math.max(current.tiempoMaximoB, r.TiempoMaximo_ms) : current.tiempoMaximoB,
        });
      }
    });

    return Array.from(map.values()).map(item => {
      const promedioA = item.ejecucionesA > 0 ? Math.round(item.tiempoTotalA / item.ejecucionesA) : 0;
      const promedioB = item.ejecucionesB > 0 ? Math.round(item.tiempoTotalB / item.ejecucionesB) : 0;

      const deltaEjecuciones = item.ejecucionesA - item.ejecucionesB;
      const deltaEjecucionesPct = item.ejecucionesB > 0 ? (deltaEjecuciones / item.ejecucionesB) * 100 : (item.ejecucionesA > 0 ? 100 : 0);

      const deltaPromedio = promedioA - promedioB;
      const deltaPromedioPct = promedioB > 0 ? (deltaPromedio / promedioB) * 100 : (promedioA > 0 ? 100 : 0);

      const deltaBloqueos = item.bloqueosA - item.bloqueosB;
      const deltaBloqueosPct = item.bloqueosB > 0 ? (deltaBloqueos / item.bloqueosB) * 100 : (item.bloqueosA > 0 ? 100 : 0);

      return {
        ...item,
        promedioA,
        promedioB,
        deltaEjecuciones,
        deltaEjecucionesPct,
        deltaPromedio,
        deltaPromedioPct,
        deltaBloqueos,
        deltaBloqueosPct
      };
    });
  }, [comparisonMode, dataFilteredByExclusions, selectedEmisorId, groupBySP, dateA, dateB]);

  // Filtrado y ordenado para registros comparativos
  const filteredComparisonRecords = useMemo(() => {
    return comparisonRecords.filter(r => {
      const matchSearch = !searchTerm || 
        r.StoredProcedure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.IdEmisor && String(r.IdEmisor).includes(searchTerm)) ||
        (r.EmisoresAgrupados && r.EmisoresAgrupados.some(e => e.nemonico.toLowerCase().includes(searchTerm.toLowerCase()) || String(e.id).includes(searchTerm)));
      return matchSearch;
    });
  }, [comparisonRecords, searchTerm]);

  const sortedComparisonRecords = useMemo(() => {
    const records = [...filteredComparisonRecords];
    if (!sortConfig) return records;

    const { key, direction } = sortConfig;

    records.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (key === 'PaisNombre') {
        aVal = getPaisNombre(a.PaisId);
        bVal = getPaisNombre(b.PaisId);
      } else if (key === 'Nemonico' && groupBySP) {
        aVal = (a.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
        bVal = (b.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
      } else {
        aVal = (a as any)[key];
        bVal = (b as any)[key];
      }

      if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1;

      if (typeof aVal === 'string') {
        return direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      } else {
        return direction === 'asc' 
          ? (aVal > bVal ? 1 : -1) 
          : (bVal > aVal ? 1 : -1);
      }
    });

    return records;
  }, [filteredComparisonRecords, sortConfig, groupBySP]);

  const baseActiveComparisonRecords = useMemo(() => {
    if (!comparisonMode) return [];
    
    switch (activeSubTab) {
      case 'mas-ejecutados':
        return [...filteredComparisonRecords].sort((a, b) => b.ejecucionesA - a.ejecucionesA).slice(0, 50);
      case 'mas-lentos':
        return [...filteredComparisonRecords].sort((a, b) => b.promedioA - a.promedioA).slice(0, 50);
      case 'mas-bloqueados':
        return [...filteredComparisonRecords].sort((a, b) => b.bloqueosA - a.bloqueosA).slice(0, 50);
      case 'alertas':
        return [];
      default:
        return filteredComparisonRecords;
    }
  }, [comparisonMode, activeSubTab, filteredComparisonRecords]);

  const activeComparisonRecords = useMemo(() => {
    const records = [...baseActiveComparisonRecords];
    if (!sortConfig) return records;

    const { key, direction } = sortConfig;

    records.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (key === 'PaisNombre') {
        aVal = getPaisNombre(a.PaisId);
        bVal = getPaisNombre(b.PaisId);
      } else if (key === 'Nemonico' && groupBySP) {
        aVal = (a.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
        bVal = (b.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
      } else {
        aVal = (a as any)[key];
        bVal = (b as any)[key];
      }

      if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1;

      if (typeof aVal === 'string') {
        return direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      } else {
        return direction === 'asc' 
          ? (aVal > bVal ? 1 : -1) 
          : (bVal > aVal ? 1 : -1);
      }
    });

    return records;
  }, [baseActiveComparisonRecords, sortConfig, groupBySP]);

  // Filtrado de registros para las tablas
  const filteredData = useMemo(() => {
    return groupedData.filter(r => {
      const matchSearch = !searchTerm || 
        r.StoredProcedure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.IdEmisor && String(r.IdEmisor).includes(searchTerm)) ||
        (r.EmisoresAgrupados && r.EmisoresAgrupados.some(e => e.nemonico.toLowerCase().includes(searchTerm.toLowerCase()) || String(e.id).includes(searchTerm)));
      return matchSearch;
    });
  }, [groupedData, searchTerm]);

  // 1. Top Más Ejecutados
  const topMasEjecutados = useMemo(() => {
    return [...filteredData].sort((a, b) => b.TotalEjecuciones - a.TotalEjecuciones).slice(0, 50);
  }, [filteredData]);

  // 2. Más Lentos (Tiempo Promedio)
  const topMasLentos = useMemo(() => {
    return [...filteredData].sort((a, b) => b.TiempoPromedio_ms - a.TiempoPromedio_ms).slice(0, 50);
  }, [filteredData]);

  // 3. Más Bloqueados
  const topMasBloqueados = useMemo(() => {
    return [...filteredData].sort((a, b) => b.TotalBloqueos - a.TotalBloqueos).slice(0, 50);
  }, [filteredData]);

  // 4. Emisores con Actividad sin Trxs (Alertas) - Nota: Siempre se evalúa a nivel individual de emisor
  const emisoresConAlertas = useMemo(() => {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 14);

    const matchSearch = (r: SPRecord) => !searchTerm || 
      r.StoredProcedure?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.Nemonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.IdEmisor && String(r.IdEmisor).includes(searchTerm));

    return dataFiltered.filter(r => {
      if (!r.IdEmisor || r.IdEmisor <= 0) return false;
      if (r.TotalEjecuciones === 0) return false;
      if (!matchSearch(r)) return false;
      
      if (!r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---') {
        return true;
      }
      
      const trxDate = new Date(r.UltimaTrxAutorizada);
      return !isNaN(trxDate.getTime()) && trxDate < thresholdDate;
    }).sort((a, b) => b.TotalEjecuciones - a.TotalEjecuciones);
  }, [dataFiltered, searchTerm]);

  // Obtener emisores únicos de la base de datos completa con exclusiones
  const uniqueEmitters = useMemo(() => {
    const map = new Map<number, string>();
    dataFilteredByExclusions.forEach(r => {
      if (r.IdEmisor && r.IdEmisor > 0) {
        map.set(r.IdEmisor, r.Nemonico || `Emisor ${r.IdEmisor}`);
      }
    });
    return Array.from(map.entries())
      .map(([id, nemonico]) => ({ id, nemonico }))
      .sort((a, b) => a.nemonico.localeCompare(b.nemonico));
  }, [dataFilteredByExclusions]);

  // Top Emisores con Más Consultas (para una métrica secundaria)
  const topEmisoresConsultas = useMemo(() => {
    const map = new Map<number, { nemonico: string, count: number, bloqueos: number }>();
    dataFilteredByExclusions.forEach(r => {
      if (r.IdEmisor && r.IdEmisor > 0) {
        const current = map.get(r.IdEmisor) || { nemonico: r.Nemonico || `Emisor ${r.IdEmisor}`, count: 0, bloqueos: 0 };
        map.set(r.IdEmisor, {
          nemonico: r.Nemonico || current.nemonico,
          count: current.count + r.TotalEjecuciones,
          bloqueos: current.bloqueos + r.TotalBloqueos
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [dataFilteredByExclusions]);

  // Desglose de emisores para el SP seleccionado en el modal
  const modalEmitters = useMemo(() => {
    if (!modalSP) return [];
    
    // Obtener todas las filas de este SP
    const spRecords = dataFilteredByExclusions.filter(r => r.StoredProcedure === modalSP);
    
    // Calcular totales
    const totalExecs = spRecords.reduce((sum, r) => sum + r.TotalEjecuciones, 0);
    const totalBlocks = spRecords.reduce((sum, r) => sum + r.TotalBloqueos, 0);
    const totalTime = spRecords.reduce((sum, r) => sum + r.TiempoTotal_ms, 0);
    
    return spRecords.map(r => {
      const execPct = totalExecs > 0 ? (r.TotalEjecuciones / totalExecs) * 100 : 0;
      const blockPct = totalBlocks > 0 ? (r.TotalBloqueos / totalBlocks) * 100 : 0;
      const timePct = totalTime > 0 ? (r.TiempoTotal_ms / totalTime) * 100 : 0;
      
      return {
        id: r.IdEmisor,
        nemonico: r.Nemonico || `Emisor ${r.IdEmisor || 'S/N'}`,
        paisId: r.PaisId,
        ejecuciones: r.TotalEjecuciones,
        ejecucionesPct: execPct,
        bloqueos: r.TotalBloqueos,
        bloqueosPct: blockPct,
        tiempoPromedio: r.TiempoPromedio_ms,
        tiempoMaximo: r.TiempoMaximo_ms,
        tiempoTotal: r.TiempoTotal_ms,
        tiempoTotalPct: timePct,
        ultimaTrx: r.UltimaTrxAutorizada
      };
    });
  }, [dataFilteredByExclusions, modalSP]);

  // Ordenamiento de los emisores del modal según la configuración activa
  const sortedModalEmitters = useMemo(() => {
    if (!modalEmitters.length) return [];
    if (!modalSortConfig) return modalEmitters;

    const { key, direction } = modalSortConfig;
    const sorted = [...modalEmitters];

    sorted.sort((a, b) => {
      let aVal: any = a[key];
      let bVal: any = b[key];

      if (key === 'paisId') {
        aVal = getPaisNombre(a.paisId);
        bVal = getPaisNombre(b.paisId);
      } else if (key === 'ultimaTrx') {
        const getVal = (val: string | null | undefined) => {
          if (!val || val === 'NULL' || val === '---') return 0;
          const parsed = Date.parse(val);
          return isNaN(parsed) ? 0 : parsed;
        };
        const aTime = getVal(a.ultimaTrx);
        const bTime = getVal(b.ultimaTrx);

        if (aTime === 0 && bTime !== 0) return 1;
        if (bTime === 0 && aTime !== 0) return -1;

        return direction === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1;

      if (typeof aVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return direction === 'asc'
          ? (aVal > bVal ? 1 : -1)
          : (bVal > aVal ? 1 : -1);
      }
    });

    return sorted;
  }, [modalEmitters, modalSortConfig]);

  // Datos para la gráfica: dinámicos según el activeSubTab seleccionado
  const chartData = useMemo(() => {
    if (comparisonMode) {
      return baseActiveComparisonRecords.slice(0, 7).map(item => {
        let valA = 0;
        let valB = 0;
        let metricName = '';

        if (activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos') {
          valA = item.ejecucionesA;
          valB = item.ejecucionesB;
          metricName = 'Ejecuciones';
        } else if (activeSubTab === 'mas-bloqueados') {
          valA = item.bloqueosA;
          valB = item.bloqueosB;
          metricName = 'Bloqueos';
        } else {
          valA = item.promedioA;
          valB = item.promedioB;
          metricName = 'Promedio (ms)';
        }

        const nameLabel = item.StoredProcedure.length > 25 
          ? item.StoredProcedure.substring(0, 22) + '...' 
          : item.StoredProcedure;

        return {
          name: nameLabel,
          fullName: item.StoredProcedure,
          valueA: valA,
          valueB: valB,
          metricName: metricName
        };
      });
    }

    // Si la pestaña es alertas, graficamos sobre los emisores con alertas. De lo contrario, usamos dataFiltered
    const baseData = activeSubTab === 'alertas' ? emisoresConAlertas : dataFiltered;
    
    const spMap = new Map<string, { sp: string; value: number }>();
    
    baseData.forEach(r => {
      const key = r.StoredProcedure;
      const current = spMap.get(key) || { sp: key, value: 0 };
      
      if (activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos') {
        // Para ejecuciones, sumamos todas las ejecuciones
        spMap.set(key, { sp: key, value: current.value + r.TotalEjecuciones });
      } else if (activeSubTab === 'mas-bloqueados') {
        // Para bloqueos, sumamos todos los bloqueos
        spMap.set(key, { sp: key, value: current.value + r.TotalBloqueos });
      } else {
        // Para mas-lentos y alertas, tomamos el mayor promedio de ejecución (ms)
        if (r.TiempoPromedio_ms > current.value) {
          spMap.set(key, { sp: key, value: r.TiempoPromedio_ms });
        }
      }
    });

    const metricName = 
      (activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos') ? 'Ejecuciones' :
      (activeSubTab === 'mas-bloqueados') ? 'Bloqueos' : 'Promedio (ms)';

    return Array.from(spMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
      .map(item => ({
        name: item.sp.length > 25 ? item.sp.substring(0, 22) + '...' : item.sp,
        fullName: item.sp,
        value: item.value,
        metricName: metricName
      }));
  }, [comparisonMode, baseActiveComparisonRecords, activeSubTab, dataFiltered, emisoresConAlertas]);

  // Helper para mapear IDs de País a Nombre
  const getPaisNombre = (paisId: number | null | undefined) => {
    if (!paisId) return 'N/A';
    const PAIS_MAP: Record<number, string> = {
      593: 'Ecuador',
      57: 'Colombia',
      506: 'Costa Rica',
      507: 'Panamá'
    };
    return PAIS_MAP[paisId] || `País ${paisId}`;
  };

  const getSubTabTitle = () => {
    switch (activeSubTab) {
      case 'mas-ejecutados': return 'Top SPs más Ejecutados';
      case 'mas-lentos': return 'Top SPs más Lentos (Tiempo Promedio)';
      case 'alertas': return 'Alertas de Desconexión Transaccional';
      default: return 'Todos los Procedimientos Registrados';
    }
  };

  const baseActiveRecords = useMemo(() => {
    switch (activeSubTab) {
      case 'mas-ejecutados': return topMasEjecutados;
      case 'mas-lentos': return topMasLentos;
      case 'mas-bloqueados': return topMasBloqueados;
      case 'alertas': return emisoresConAlertas;
      default: return filteredData;
    }
  }, [activeSubTab, topMasEjecutados, topMasLentos, topMasBloqueados, emisoresConAlertas, filteredData]);

  const activeRecords = useMemo(() => {
    const records = [...baseActiveRecords];
    if (!sortConfig) return records;
    
    const { key, direction } = sortConfig;
    
    records.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      if (key === 'PaisNombre') {
        aVal = getPaisNombre(a.PaisId);
        bVal = getPaisNombre(b.PaisId);
      } else if (key === 'Nemonico' && groupBySP) {
        aVal = (a.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
        bVal = (b.EmisoresAgrupados || []).map(e => e.nemonico).join(', ');
      } else if (key === 'UltimaTrxAutorizada') {
        const getVal = (val: string | null | undefined) => {
          if (!val || val === 'NULL' || val === '---') return 0;
          const parsed = Date.parse(val);
          return isNaN(parsed) ? 0 : parsed;
        };
        const aTime = getVal(a.UltimaTrxAutorizada);
        const bTime = getVal(b.UltimaTrxAutorizada);
        
        if (aTime === 0 && bTime !== 0) return 1;
        if (bTime === 0 && aTime !== 0) return -1;
        
        return direction === 'asc' ? aTime - bTime : bTime - aTime;
      } else {
        aVal = a[key as keyof SPRecord];
        bVal = b[key as keyof SPRecord];
      }
      
      if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1;
      
      if (typeof aVal === 'string') {
        return direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      } else {
        return direction === 'asc' 
          ? (aVal > bVal ? 1 : -1) 
          : (bVal > aVal ? 1 : -1);
      }
    });
    
    return records;
  }, [baseActiveRecords, sortConfig, groupBySP]);
    
  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0 inline-block" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1.5 text-[#71BF44] shrink-0 inline-block" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1.5 text-[#71BF44] shrink-0 inline-block" />;
  };

  const renderModalSortIcon = (key: 'nemonico' | 'paisId' | 'ejecuciones' | 'tiempoPromedio' | 'bloqueos' | 'ultimaTrx') => {
    if (!modalSortConfig || modalSortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-100 transition-opacity shrink-0 inline-block" />;
    }
    return modalSortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-[#71BF44] shrink-0 inline-block" />
      : <ArrowDown className="w-3 h-3 ml-1 text-[#71BF44] shrink-0 inline-block" />;
  };

  // Restablecer la ordenación del modal cuando se cambia de SP
  useEffect(() => {
    if (modalSP) {
      setModalSortConfig({ key: 'ejecuciones', direction: 'desc' });
    }
  }, [modalSP]);

  // Copia el contenido de la fila formateado como texto legible con cabeceras
  const handleCopyText = (r: SPRecord, idx: number) => {
    const emisoresText = groupBySP 
      ? (r.EmisoresAgrupados && r.EmisoresAgrupados.length > 0 ? r.EmisoresAgrupados.map(e => `${e.nemonico} (ID: ${e.id})`).join(', ') : 'Sin emisores')
      : `${r.Nemonico || 'S/N'} (ID: ${r.IdEmisor || 'N/A'})`;
      
    const paisText = groupBySP && !r.PaisId ? 'Múltiples' : getPaisNombre(r.PaisId);
    const ultTrx = r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' 
      ? r.UltimaTrxAutorizada 
      : 'Sin registros trx';

    const text = [
      `--- DETALLE DE CONSULTA RECURRENTE ---`,
      `Procedimiento Almacenado (SP): ${r.StoredProcedure}`,
      `Emisor / Nemónico: ${emisoresText}`,
      `País: ${paisText}`,
      `Ejecuciones: ${r.TotalEjecuciones.toLocaleString()}`,
      `Promedio: ${r.TiempoPromedio_ms.toLocaleString()} ms`,
      `Máximo: ${r.TiempoMaximo_ms.toLocaleString()} ms`,
      `Total Bloqueos: ${r.TotalBloqueos.toLocaleString()}`,
      `Última Trx Autorizada: ${ultTrx}`,
      `--------------------------------------`
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedState({ idx, type: 'text' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  // Copia el objeto de la fila en formato JSON estructurado
  const handleCopyJson = (r: SPRecord, idx: number) => {
    const jsonStr = JSON.stringify(r, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedState({ idx, type: 'json' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  // Copia el contenido de la fila comparativa formateado como texto legible con cabeceras
  const handleCopyComparisonText = (r: any, idx: number) => {
    const emisoresText = groupBySP 
      ? (r.EmisoresAgrupados && r.EmisoresAgrupados.length > 0 ? r.EmisoresAgrupados.map((e: any) => `${e.nemonico} (ID: ${e.id})`).join(', ') : 'Sin emisores')
      : `${r.Nemonico || 'S/N'} (ID: ${r.IdEmisor || 'N/A'})`;
      
    const paisText = groupBySP && !r.PaisId ? 'Múltiples' : getPaisNombre(r.PaisId);
    
    const deltaEjSign = r.deltaEjecuciones > 0 ? '+' : '';
    const deltaPrSign = r.deltaPromedio > 0 ? '+' : '';
    const deltaBlSign = r.deltaBloqueos > 0 ? '+' : '';

    const text = [
      `--- DETALLE COMPARATIVO DE CONSULTA RECURRENTE ---`,
      `Procedimiento Almacenado (SP): ${r.StoredProcedure}`,
      `Emisor / Nemónico: ${emisoresText}`,
      `País: ${paisText}`,
      `--------------------------------------`,
      `Fecha A (Reciente): ${dateA} | Fecha B (Anterior): ${dateB}`,
      `--------------------------------------`,
      `Ejecuciones Día A: ${r.ejecucionesA.toLocaleString()}`,
      `Ejecuciones Día B: ${r.ejecucionesB.toLocaleString()}`,
      `Delta Ejecuciones: ${deltaEjSign}${r.deltaEjecuciones.toLocaleString()} (${deltaEjSign}${r.deltaEjecucionesPct.toFixed(1)}%)`,
      `--------------------------------------`,
      `Promedio Día A: ${r.promedioA.toLocaleString()} ms`,
      `Promedio Día B: ${r.promedioB.toLocaleString()} ms`,
      `Delta Promedio: ${deltaPrSign}${r.deltaPromedio.toLocaleString()} ms (${deltaPrSign}${r.deltaPromedioPct.toFixed(1)}%)`,
      `--------------------------------------`,
      `Bloqueos Día A: ${r.bloqueosA.toLocaleString()}`,
      `Bloqueos Día B: ${r.bloqueosB.toLocaleString()}`,
      `Delta Bloqueos: ${deltaBlSign}${r.deltaBloqueos.toLocaleString()} (${deltaBlSign}${r.deltaBloqueosPct.toFixed(1)}%)`,
      `--------------------------------------`
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedState({ idx, type: 'text' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  // Copia el objeto comparativo en formato JSON estructurado
  const handleCopyComparisonJson = (r: any, idx: number) => {
    const jsonStr = JSON.stringify(r, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedState({ idx, type: 'json' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Cabecera */}
      <header className="mb-10 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#71BF44]/10 rounded-2xl flex items-center justify-center ring-1 ring-[#71BF44]/20">
              <Clock className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase mb-1">
                Consultas Recurrentes <span className="text-[#71BF44] opacity-40 text-sm ml-1 font-black italic">BDD</span>
              </h1>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 bg-[#71BF44]/10 rounded-full border border-[#71BF44]/20">
                    <div className="w-1.5 h-1.5 bg-[#71BF44] rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Activo (Últimos 2 Días)</span>
                 </div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest opacity-60">
                   Monitoreo y rendimiento de Stored Procedures
                 </p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => fetchData(true)} 
            disabled={refreshing || loading} 
            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Panel
          </button>
        </div>
      </header>

      {/* Listado de SPs Excluidos */}
      {excludedSPs.length > 0 && (
        <div className="mb-8 p-5 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Procedimientos Excluidos:</span>
          <div className="flex flex-wrap gap-2">
            {excludedSPs.map(sp => (
              <span key={sp} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-neutral-850 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                <span className="line-clamp-1 max-w-[200px]" title={sp}>{sp}</span>
                <button 
                  onClick={() => setExcludedSPs(excludedSPs.filter(item => item !== sp))}
                  className="text-neutral-400 hover:text-red-500 font-bold ml-1 transition-colors cursor-pointer"
                  title="Restaurar"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button 
            onClick={() => setExcludedSPs([])} 
            className="text-[10px] font-black text-[#71BF44] hover:underline uppercase tracking-widest ml-auto"
          >
            Restaurar Todos
          </button>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Error al cargar datos</h4>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest">Total Ejecuciones</span>
            <Activity className="w-4 h-4 text-[#71BF44]" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : kpis.totalConsultas.toLocaleString()}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">
            {loading ? '...' : !comparisonMode ? (
              'Consultas registradas'
            ) : (
              (() => {
                const deltaEj = kpis.totalConsultas - kpis.totalConsultasB;
                const pctEj = kpis.totalConsultasB > 0 ? (deltaEj / kpis.totalConsultasB) * 100 : 0;
                const sign = deltaEj > 0 ? '+' : '';
                return (
                  <span className={deltaEj > 0 ? 'text-[#71BF44]' : deltaEj < 0 ? 'text-red-500' : 'text-neutral-400'}>
                    {sign}{deltaEj.toLocaleString()} ({sign}{pctEj.toFixed(1)}%) vs Día B
                  </span>
                );
              })()
            )}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Carga Total de BDD</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : `${kpis.tiempoTotalSec.toFixed(2)}s`}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">
            {loading ? '...' : !comparisonMode ? (
              'Tiempo CPU total consumido'
            ) : (
              (() => {
                const deltaTi = kpis.tiempoTotalSec - kpis.tiempoTotalSecB;
                const pctTi = kpis.tiempoTotalSecB > 0 ? (deltaTi / kpis.tiempoTotalSecB) * 100 : 0;
                const sign = deltaTi > 0 ? '+' : '';
                return (
                  <span className={deltaTi < 0 ? 'text-[#71BF44]' : deltaTi > 0 ? 'text-red-500' : 'text-neutral-400'}>
                    {sign}{deltaTi.toFixed(2)}s ({sign}{pctTi.toFixed(1)}%) vs Día B
                  </span>
                );
              })()
            )}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-neutral-100 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Bloqueos de Rate Limit</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-none">
            {loading ? '...' : kpis.totalBloqueos.toLocaleString()}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">
            {loading ? '...' : !comparisonMode ? (
              `Tasa de bloqueo: ${kpis.tasaBloqueo.toFixed(2)}%`
            ) : (
              (() => {
                const deltaBl = kpis.totalBloqueos - kpis.totalBloqueosB;
                const pctBl = kpis.totalBloqueosB > 0 ? (deltaBl / kpis.totalBloqueosB) * 100 : 0;
                const sign = deltaBl > 0 ? '+' : '';
                return (
                  <span className={deltaBl < 0 ? 'text-[#71BF44]' : deltaBl > 0 ? 'text-red-500' : 'text-neutral-400'}>
                    {sign}{deltaBl.toLocaleString()} ({sign}{pctBl.toFixed(1)}%) vs Día B
                  </span>
                );
              })()
            )}
          </p>
        </div>

        <div className={`border rounded-[32px] p-6 shadow-sm transition-all duration-300 ${kpis.alertasCount > 0 ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/50 animate-pulse' : 'bg-white dark:bg-[#111] border-neutral-100 dark:border-neutral-800'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[10px] font-black uppercase tracking-widest ${kpis.alertasCount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
              Alertas de Desconexión
            </span>
            <AlertCircle className={`w-4 h-4 ${kpis.alertasCount > 0 ? 'text-red-600' : 'text-neutral-400'}`} />
          </div>
          <h3 className={`text-4xl font-black tracking-tighter leading-none ${kpis.alertasCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-white'}`}>
            {loading ? '...' : kpis.alertasCount}
          </h3>
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mt-4">Emisores consultando sin trx en +2 semanas</p>
        </div>
      </div>

      {/* Gráfica y Resumen Secundario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Gráfica Recharts */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#71BF44]" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {!comparisonMode ? (
                activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos' 
                  ? 'Top 7 SPs más Ejecutados' 
                  : activeSubTab === 'mas-bloqueados' 
                    ? 'Top 7 SPs más Bloqueados' 
                    : activeSubTab === 'alertas'
                      ? 'Top 7 SPs de Emisores Alertados (Latencia)'
                      : 'Top 7 SPs con mayor Latencia (Promedio)'
              ) : (
                activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos'
                  ? `Comparativa: Ejecuciones por SP (${dateA} vs ${dateB})`
                  : activeSubTab === 'mas-bloqueados'
                    ? `Comparativa: Bloqueos por SP (${dateA} vs ${dateB})`
                    : `Comparativa: Latencia Promedio por SP (${dateA} vs ${dateB})`
              )}
            </h3>
          </div>
          
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center text-neutral-400 text-xs font-black uppercase tracking-widest">
                Cargando gráfica...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData as any} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-neutral-800/40" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#888888', fontSize: 10, fontWeight: 700 }} 
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#888888', fontSize: 10, fontWeight: 700 }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ 
                      value: activeSubTab === 'mas-ejecutados' || activeSubTab === 'todos' 
                        ? 'ejecuciones' 
                        : activeSubTab === 'mas-bloqueados' 
                          ? 'bloqueos' 
                          : 'milisegundos (ms)', 
                      angle: -90, 
                      position: 'insideLeft', 
                      style: { textAnchor: 'middle', fill: '#888888', fontSize: 10, fontWeight: 700 } 
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131313', borderColor: '#262626', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ color: '#71BF44', fontSize: 11 }}
                    formatter={(value: any, name: any, props: any) => {
                      const metric = props.payload.metricName || 'Valor';
                      const suffix = metric === 'Promedio (ms)' ? ' ms' : '';
                      
                      if (name.includes('Día A') || name.includes('Día B')) {
                        return [`${value.toLocaleString()}${suffix}`, `${metric} (${name})`];
                      }
                      
                      if (metric === 'Promedio (ms)') {
                        return [`${value.toLocaleString()} ms`, 'Latencia Promedio'];
                      }
                      return [value.toLocaleString(), metric];
                    }}
                  />
                  {comparisonMode ? (
                    <>
                      <Bar 
                        dataKey="valueA" 
                        name={`Día A: ${dateA}`}
                        fill="#71BF44"
                        radius={[8, 8, 0, 0]}
                        onClick={(entry: any) => {
                          if (entry && entry.fullName) {
                            setSearchTerm(entry.fullName);
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <Bar 
                        dataKey="valueB" 
                        name={`Día B: ${dateB}`}
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                        onClick={(entry: any) => {
                          if (entry && entry.fullName) {
                            setSearchTerm(entry.fullName);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </>
                  ) : (
                    <Bar 
                      dataKey="value" 
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry && entry.fullName) {
                          setSearchTerm(entry.fullName);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index < 3 ? '#f97316' : '#71BF44'} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-neutral-400 text-xs font-bold">
                Sin datos suficientes para graficar
              </div>
            )}
          </div>
        </div>

        {/* Top Emisores por consultas */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Top 5 Emisores con más consultas</h3>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-400 text-xs font-black uppercase tracking-widest py-10">
                Cargando emisores...
              </div>
            ) : topEmisoresConsultas.length > 0 ? (
              topEmisoresConsultas.slice(0, 5).map((em, idx) => {
                const isSelected = selectedEmisorId === em.id;
                return (
                  <button
                    key={em.id}
                    onClick={() => setSelectedEmisorId(isSelected ? null : em.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer group ${
                      isSelected 
                        ? 'bg-[#71BF44]/10 border-[#71BF44] ring-1 ring-[#71BF44]' 
                        : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-100 dark:border-neutral-800/30 hover:border-[#71BF44]/40 hover:bg-[#71BF44]/5'
                    }`}
                    title={isSelected ? "Quitar filtro de emisor" : `Analizar emisor ${em.nemonico}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                        isSelected ? 'bg-[#71BF44] text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className={`text-xs font-black uppercase leading-none mb-1 transition-colors ${
                          isSelected ? 'text-[#71BF44]' : 'text-neutral-800 dark:text-white'
                        }`}>
                          {em.nemonico}
                        </h4>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                          ID Emisor: {em.id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black block transition-colors ${
                        isSelected ? 'text-[#71BF44]' : 'text-neutral-950 dark:text-white'
                      }`}>
                        {em.count.toLocaleString()}
                      </span>
                      <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">
                        {em.bloqueos.toLocaleString()} Bloqueos
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400 text-xs font-bold py-10">
                Sin datos de emisores
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Indicador de Filtro Focado por Emisor */}
      {selectedEmisorId !== null && (
        <div className="mb-6 p-5 bg-[#71BF44]/10 border border-[#71BF44]/30 dark:border-[#71BF44]/20 rounded-3xl flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#71BF44]/20 rounded-2xl flex items-center justify-center ring-1 ring-[#71BF44]/30">
              <Building2 className="w-5 h-5 text-[#71BF44]" />
            </div>
            <div>
              <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-wider mb-0.5">
                Modo Foco Emisor Activo
              </h4>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase">
                Visualizando ejecuciones, latencias y bloqueos del emisor:{" "}
                <span className="text-[#71BF44] font-black bg-[#71BF44]/10 border border-[#71BF44]/25 px-2 py-0.5 rounded-lg">
                  {uniqueEmitters.find(e => e.id === selectedEmisorId)?.nemonico || `Emisor ${selectedEmisorId}`} (ID: {selectedEmisorId})
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedEmisorId(null)}
            className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            Quitar Filtro
          </button>
        </div>
      )}

      {/* Buscador y Navegación de Tablas */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[40px] overflow-hidden shadow-xl">
        {/* Barra superior */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-neutral-50/20 dark:bg-neutral-800/10">
          <div className="flex flex-wrap gap-3 border-b border-neutral-200/50 dark:border-neutral-800/50 lg:border-none pb-4 lg:pb-0 items-center">
            {/* Toggle de Modo Comparación */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-[#151515] border border-neutral-200/60 dark:border-neutral-800/50 rounded-2xl shadow-sm">
              <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Comparar Días:</span>
              <button
                onClick={() => {
                  const nextMode = !comparisonMode;
                  setComparisonMode(nextMode);
                  setSortConfig(null);
                  if (nextMode && activeSubTab === 'alertas') {
                    setActiveSubTab('mas-ejecutados');
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${comparisonMode ? 'bg-[#71BF44]' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${comparisonMode ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Sub tabs (renderizadas en ambos modos) */}
            <button
              onClick={() => { setActiveSubTab('mas-ejecutados'); setSortConfig(null); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'mas-ejecutados' ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-850 text-neutral-400 border-neutral-100 dark:border-neutral-800 hover:border-neutral-300'}`}
            >
              Más Ejecutados
            </button>
            <button
              onClick={() => { setActiveSubTab('mas-lentos'); setSortConfig(null); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'mas-lentos' ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-850 text-neutral-400 border-neutral-100 dark:border-neutral-800 hover:border-neutral-300'}`}
            >
              Más Lentos (Promedio)
            </button>
            <button
              onClick={() => { setActiveSubTab('mas-bloqueados'); setSortConfig(null); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'mas-bloqueados' ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-lg shadow-[#71BF44]/20' : 'bg-white dark:bg-neutral-850 text-neutral-400 border-neutral-100 dark:border-neutral-800 hover:border-neutral-300'}`}
            >
              Más Bloqueados
            </button>
            {!comparisonMode && (
              <button
                onClick={() => { setActiveSubTab('alertas'); setSortConfig(null); }}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${activeSubTab === 'alertas' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' : 'bg-white dark:bg-neutral-850 text-red-500 border-red-100 dark:border-red-500/20 hover:border-red-300'}`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Sin Transacciones ({kpis.alertasCount})
              </button>
            )}
            <button
              onClick={() => { setActiveSubTab('todos'); setSortConfig(null); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeSubTab === 'todos' ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-850 text-neutral-400 border-neutral-100 dark:border-neutral-800 hover:border-neutral-300'}`}
            >
              Todos
            </button>

            {/* Selectores de fecha según el modo */}
            {!comparisonMode ? (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl shadow-sm">
                <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Fecha:</span>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black text-neutral-700 dark:text-neutral-200 outline-none cursor-pointer max-w-[120px] truncate"
                >
                  <option value="TODOS" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">TODOS LOS DÍAS</option>
                  {uniqueDates.map(d => (
                    <option key={d} value={d} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap animate-fadeIn">
                {/* Selector Día A */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl shadow-sm">
                  <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest">Día A (Reciente):</span>
                  <select
                    value={dateA}
                    onChange={(e) => setDateA(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black text-neutral-700 dark:text-neutral-200 outline-none cursor-pointer"
                  >
                    {uniqueDates.map(d => (
                      <option key={d} value={d} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs font-black text-neutral-400">vs</span>

                {/* Selector Día B */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl shadow-sm">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Día B (Anterior):</span>
                  <select
                    value={dateB}
                    onChange={(e) => setDateB(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black text-neutral-700 dark:text-neutral-200 outline-none cursor-pointer"
                  >
                    {uniqueDates.map(d => (
                      <option key={d} value={d} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-500 rounded-full uppercase tracking-wider select-none">
                  Vista Comparativa
                </span>
              </div>
            )}

            {/* Switch de Agrupamiento por Stored Procedure */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl shadow-sm">
              <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Agrupar SPs:</span>
              <button
                onClick={() => setGroupBySP(!groupBySP)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${groupBySP ? 'bg-[#71BF44]' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${groupBySP ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Selector de Emisor */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl shadow-sm">
              <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Emisor:</span>
              <select
                value={selectedEmisorId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEmisorId(val ? Number(val) : null);
                }}
                className="bg-transparent border-none text-[10px] font-black text-neutral-700 dark:text-neutral-200 outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">TODOS</option>
                {uniqueEmitters.map(e => (
                  <option key={e.id} value={e.id} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {e.nemonico}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative min-w-[300px] lg:w-[400px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar por SP, nemónico o ID..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-12 pr-10 py-3.5 text-xs font-bold focus:ring-4 focus:ring-[#71BF44]/10 outline-none transition-all placeholder:text-neutral-300 placeholder:italic"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <svg className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-20 text-neutral-400 text-xs font-black uppercase tracking-widest">
              Cargando registros...
            </div>
          ) : !comparisonMode ? (
            activeRecords.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.12em] border-b border-neutral-100 dark:border-neutral-800 select-none">
                    <th 
                      onClick={() => requestSort('StoredProcedure')} 
                      className="px-8 py-5 cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center group">
                        Procedimiento Almacenado (SP)
                        {renderSortIcon('StoredProcedure')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('Nemonico')} 
                      className="px-6 py-5 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center group">
                        Emisor / Nemónico
                        {renderSortIcon('Nemonico')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('PaisNombre')} 
                      className="px-6 py-5 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center group">
                        País
                        {renderSortIcon('PaisNombre')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('TotalEjecuciones')} 
                      className="px-6 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end group">
                        Ejecuciones
                        {renderSortIcon('TotalEjecuciones')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('TiempoPromedio_ms')} 
                      className="px-6 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end group">
                        Promedio (ms)
                        {renderSortIcon('TiempoPromedio_ms')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('TiempoMaximo_ms')} 
                      className="px-6 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end group">
                        Máximo (ms)
                        {renderSortIcon('TiempoMaximo_ms')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('TotalBloqueos')} 
                      className="px-6 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end group">
                        Total Bloqueos
                        {renderSortIcon('TotalBloqueos')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('UltimaTrxAutorizada')} 
                      className="px-8 py-5 cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center group">
                        Última Trx Autorizada
                        {renderSortIcon('UltimaTrxAutorizada')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  {activeRecords.map((r, idx) => {
                    const hasAlert = r.IdEmisor && r.IdEmisor > 0 && r.TotalEjecuciones > 0 && (
                      !r.UltimaTrxAutorizada || r.UltimaTrxAutorizada === 'NULL' || r.UltimaTrxAutorizada === '---' ||
                      (new Date(r.UltimaTrxAutorizada) < new Date(new Date().setDate(new Date().getDate() - 14)))
                    );

                    return (
                      <tr 
                        key={idx} 
                        className={`group hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors ${hasAlert ? 'bg-red-500/[0.02]' : ''}`}
                      >
                        <td className="px-8 py-5 font-bold text-neutral-850 dark:text-neutral-200 text-xs break-all">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                if (!excludedSPs.includes(r.StoredProcedure)) {
                                  setExcludedSPs([...excludedSPs, r.StoredProcedure]);
                                }
                              }}
                              className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer shrink-0"
                              title="Excluir de análisis"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setSearchTerm(r.StoredProcedure)}
                              className="p-1.5 text-neutral-400 hover:text-[#71BF44] hover:bg-[#71BF44]/10 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Filtrar por este SP"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleCopyText(r, idx)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                                copiedState?.idx === idx && copiedState?.type === 'text'
                                  ? 'text-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title="Copiar fila (texto con cabeceras)"
                            >
                              {copiedState?.idx === idx && copiedState?.type === 'text' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleCopyJson(r, idx)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                                copiedState?.idx === idx && copiedState?.type === 'json'
                                  ? 'text-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title="Copiar objeto (JSON)"
                            >
                              {copiedState?.idx === idx && copiedState?.type === 'json' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Braces className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <span className="text-[10px] text-neutral-400 shrink-0">#{idx + 1}</span>
                            <button
                              onClick={() => setSearchTerm(r.StoredProcedure)}
                              className="text-left text-neutral-800 dark:text-neutral-200 hover:text-[#71BF44] dark:hover:text-[#71BF44] transition-colors font-bold break-all line-clamp-2 cursor-pointer font-sans"
                              title={`Filtrar por ${r.StoredProcedure}`}
                            >
                              {r.StoredProcedure}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          {groupBySP ? (
                            r.EmisoresAgrupados && r.EmisoresAgrupados.length > 0 ? (
                              <div className="flex flex-col items-center gap-1.5">
                                {r.EmisoresAgrupados.length > 3 ? (
                                  <button
                                    onClick={() => setModalSP(r.StoredProcedure)}
                                    className="px-3.5 py-2 bg-[#71BF44]/10 hover:bg-[#71BF44]/20 border border-[#71BF44]/30 rounded-xl text-[10px] font-black text-[#71BF44] uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer hover:scale-105 shadow-sm active:scale-95"
                                    title="Ver desglose detallado de emisores"
                                  >
                                    <span>{r.EmisoresAgrupados.length} Emisores</span>
                                    <span className="text-[10px]">🔍</span>
                                  </button>
                                ) : (
                                  <>
                                    <span className="text-[10px] font-black text-[#71BF44] bg-[#71BF44]/10 border border-[#71BF44]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none">
                                      {r.EmisoresAgrupados.length} {r.EmisoresAgrupados.length === 1 ? 'Emisor' : 'Emisores'}
                                    </span>
                                    <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                                      {r.EmisoresAgrupados.map(e => {
                                        const isFocused = selectedEmisorId === e.id;
                                        return (
                                          <button
                                            key={e.id}
                                            onClick={() => setSelectedEmisorId(isFocused ? null : e.id)}
                                            className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                              isFocused
                                                ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-sm'
                                                : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:text-[#71BF44] hover:bg-[#71BF44]/10 dark:hover:bg-[#71BF44]/10 hover:border-[#71BF44]/30'
                                            }`}
                                            title={isFocused ? `Quitar filtro de ${e.nemonico}` : `Ver comportamiento de ${e.nemonico}`}
                                          >
                                            {e.nemonico}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic">Sin emisores</span>
                            )
                          ) : r.IdEmisor && r.IdEmisor > 0 ? (
                            <button
                              onClick={() => setSelectedEmisorId(selectedEmisorId === r.IdEmisor ? null : r.IdEmisor)}
                              className={`inline-flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                                selectedEmisorId === r.IdEmisor
                                  ? 'bg-[#71BF44]/15 border-[#71BF44] text-[#71BF44]'
                                  : 'border-transparent hover:bg-[#71BF44]/10 hover:border-[#71BF44]/20'
                              }`}
                              title={selectedEmisorId === r.IdEmisor ? `Quitar filtro de ${r.Nemonico || 'S/N'}` : `Ver comportamiento de ${r.Nemonico || 'S/N'}`}
                            >
                              <span className={`text-xs font-black leading-none mb-1 transition-colors ${
                                selectedEmisorId === r.IdEmisor ? 'text-[#71BF44]' : 'text-neutral-800 dark:text-neutral-100'
                              }`}>
                                {r.Nemonico || 'S/N'}
                              </span>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                ID: {r.IdEmisor}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Global / Sistema</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            {groupBySP && !r.PaisId ? (
                              <span className="text-neutral-400 italic">Múltiples</span>
                            ) : (
                              getPaisNombre(r.PaisId)
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-neutral-900 dark:text-white">
                          {r.TotalEjecuciones.toLocaleString()}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${r.TiempoPromedio_ms > 5000 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : r.TiempoPromedio_ms > 1000 ? 'bg-orange-400/10 text-orange-500 border border-orange-400/20' : 'text-neutral-700 dark:text-neutral-300'}`}>
                            {r.TiempoPromedio_ms.toLocaleString()} ms
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right text-xs font-bold text-neutral-500">
                          {r.TiempoMaximo_ms.toLocaleString()} ms
                        </td>
                        <td className="px-6 py-5 text-right font-bold">
                          <div className="flex flex-col items-end">
                            <span className={r.TotalBloqueos > 0 ? 'text-red-500' : 'text-neutral-300 opacity-40'}>
                              {r.TotalBloqueos.toLocaleString()}
                            </span>
                            {r.TotalBloqueos > 0 && r.TotalEjecuciones > 0 && (
                              <span className="text-[9px] text-red-400/80 font-bold mt-0.5" title="Porcentaje de comprobantes bloqueados sobre el total de consultas">
                                {((r.TotalBloqueos / r.TotalEjecuciones) * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          {hasAlert ? (
                            <div className="relative group/alert cursor-help flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl max-w-fit select-none">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter leading-none mb-0.5">
                                  Activo sin Autorizaciones
                                </span>
                                <span className="text-[8px] text-red-400 font-bold leading-none">
                                  Última: {r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' ? r.UltimaTrxAutorizada.split(' ')[0] : 'Ninguna'}
                                </span>
                              </div>

                              {/* Tooltip Ampliado al posarse encima */}
                              <div className="absolute bottom-full right-0 mb-2.5 w-80 p-4 bg-neutral-900 dark:bg-neutral-950 text-white rounded-2xl shadow-2xl border border-neutral-800 dark:border-neutral-800/80 text-[10px] leading-relaxed hidden group-hover/alert:block z-50 pointer-events-none transition-all">
                                <div className="font-black text-red-500 dark:text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Alerta de Inactividad Transaccional
                                </div>
                                <p className="text-neutral-300 font-semibold mb-2 normal-case leading-normal">
                                  {r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' 
                                    ? `El emisor está registrando consultas en la base de datos pero no ha autorizado transacciones exitosas desde el ${r.UltimaTrxAutorizada.split(' ')[0]} a las ${r.UltimaTrxAutorizada.split(' ')[1] || ''} (hace más de 14 días).`
                                    : 'El emisor registra consultas recurrentes en los últimos 2 días pero no cuenta con ningún registro histórico de transacciones autorizadas en el sistema.'}
                                </p>
                                <div className="border-t border-neutral-850 dark:border-neutral-800 pt-2 text-[9px] text-neutral-500 font-bold uppercase tracking-wider flex justify-between">
                                  <span>Emisor: {r.Nemonico || 'S/N'}</span>
                                  <span>ID: {r.IdEmisor || 'N/A'}</span>
                                </div>
                                {/* Triangulito del tooltip en la esquina derecha para alinearlo al badge */}
                                <div className="absolute top-full right-6 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-950"></div>
                              </div>
                            </div>
                          ) : r.UltimaTrxAutorizada && r.UltimaTrxAutorizada !== 'NULL' && r.UltimaTrxAutorizada !== '---' ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-[#71BF44] shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 leading-none">
                                  {r.UltimaTrxAutorizada.split(' ')[0]}
                                </span>
                                <span className="text-[9px] text-neutral-400 font-medium leading-none mt-0.5">
                                  {r.UltimaTrxAutorizada.split(' ')[1] || ''}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Sin registros trx</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-20 text-neutral-400 text-xs font-bold">
                No se encontraron procedimientos almacenados que coincidan con la búsqueda.
              </div>
            )
          ) : (
            activeComparisonRecords.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.12em] border-b border-neutral-100 dark:border-neutral-800 select-none">
                    <th 
                      onClick={() => requestSort('StoredProcedure')} 
                      className="px-6 py-5 cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors animate-fadeIn"
                    >
                      <div className="flex items-center group">
                        Procedimiento Almacenado (SP)
                        {renderSortIcon('StoredProcedure')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('Nemonico')} 
                      className="px-4 py-5 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center group">
                        Emisor / Nemónico
                        {renderSortIcon('Nemonico')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('PaisNombre')} 
                      className="px-4 py-5 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center group">
                        País
                        {renderSortIcon('PaisNombre')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('ejecucionesA')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Ejecuciones registradas en el Día A (${dateA})`}
                    >
                      <div className="flex items-center justify-end group">
                        Ejec. Día A
                        {renderSortIcon('ejecucionesA')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('ejecucionesB')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Ejecuciones registradas en el Día B (${dateB})`}
                    >
                      <div className="flex items-center justify-end group">
                        Ejec. Día B
                        {renderSortIcon('ejecucionesB')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('deltaEjecuciones')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title="Diferencia de ejecuciones entre Día A y Día B"
                    >
                      <div className="flex items-center justify-end group">
                        Δ Ejecuciones
                        {renderSortIcon('deltaEjecuciones')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('promedioA')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Latencia promedio registrada en el Día A (${dateA})`}
                    >
                      <div className="flex items-center justify-end group">
                        Prom. A
                        {renderSortIcon('promedioA')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('promedioB')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Latencia promedio registrada en el Día B (${dateB})`}
                    >
                      <div className="flex items-center justify-end group">
                        Prom. B
                        {renderSortIcon('promedioB')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('deltaPromedio')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title="Diferencia de latencia promedio entre Día A y Día B"
                    >
                      <div className="flex items-center justify-end group">
                        Δ Promedio
                        {renderSortIcon('deltaPromedio')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('bloqueosA')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Bloqueos registrados en el Día A (${dateA})`}
                    >
                      <div className="flex items-center justify-end group">
                        Bloq. A
                        {renderSortIcon('bloqueosA')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('bloqueosB')} 
                      className="px-4 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title={`Bloqueos registrados en el Día B (${dateB})`}
                    >
                      <div className="flex items-center justify-end group">
                        Bloq. B
                        {renderSortIcon('bloqueosB')}
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('deltaBloqueos')} 
                      className="px-6 py-5 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      title="Diferencia de bloqueos entre Día A y Día B"
                    >
                      <div className="flex items-center justify-end group">
                        Δ Bloqueos
                        {renderSortIcon('deltaBloqueos')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  {activeComparisonRecords.map((r, idx) => {
                    const deltaEjSign = r.deltaEjecuciones > 0 ? '+' : '';
                    const deltaPrSign = r.deltaPromedio > 0 ? '+' : '';
                    const deltaBlSign = r.deltaBloqueos > 0 ? '+' : '';

                    const deltaEjColor = r.deltaEjecuciones > 0 
                      ? 'text-[#71BF44]' 
                      : r.deltaEjecuciones < 0 
                        ? 'text-red-500' 
                        : 'text-neutral-400';
                        
                    const deltaPrColor = r.deltaPromedio < 0 
                      ? 'text-[#71BF44]' 
                      : r.deltaPromedio > 0 
                        ? 'text-red-500' 
                        : 'text-neutral-400';
                        
                    const deltaBlColor = r.deltaBloqueos < 0 
                      ? 'text-[#71BF44]' 
                      : r.deltaBloqueos > 0 
                        ? 'text-red-500' 
                        : 'text-neutral-400';

                    return (
                      <tr 
                        key={idx} 
                        className="group hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors"
                      >
                        <td className="px-6 py-5 font-bold text-neutral-800 dark:text-neutral-200 text-xs break-all">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (!excludedSPs.includes(r.StoredProcedure)) {
                                  setExcludedSPs([...excludedSPs, r.StoredProcedure]);
                                }
                              }}
                              className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer shrink-0"
                              title="Excluir de análisis"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setSearchTerm(r.StoredProcedure)}
                              className="p-1.5 text-neutral-400 hover:text-[#71BF44] hover:bg-[#71BF44]/10 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Filtrar por este SP"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleCopyComparisonText(r, idx)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                                copiedState?.idx === idx && copiedState?.type === 'text'
                                  ? 'text-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title="Copiar fila (texto con cabeceras)"
                            >
                              {copiedState?.idx === idx && copiedState?.type === 'text' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleCopyComparisonJson(r, idx)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                                copiedState?.idx === idx && copiedState?.type === 'json'
                                  ? 'text-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title="Copiar objeto (JSON)"
                            >
                              {copiedState?.idx === idx && copiedState?.type === 'json' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Braces className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <span className="text-[10px] text-neutral-400 shrink-0">#{idx + 1}</span>
                            <button
                              onClick={() => setSearchTerm(r.StoredProcedure)}
                              className="text-left text-neutral-800 dark:text-neutral-200 hover:text-[#71BF44] dark:hover:text-[#71BF44] transition-colors font-bold break-all line-clamp-2 cursor-pointer font-sans"
                              title={`Filtrar por ${r.StoredProcedure}`}
                            >
                              {r.StoredProcedure}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          {groupBySP ? (
                            r.EmisoresAgrupados && r.EmisoresAgrupados.length > 0 ? (
                              <div className="flex flex-col items-center gap-1.5">
                                {r.EmisoresAgrupados.length > 3 ? (
                                  <button
                                    onClick={() => setModalSP(r.StoredProcedure)}
                                    className="px-3.5 py-2 bg-[#71BF44]/10 hover:bg-[#71BF44]/20 border border-[#71BF44]/30 rounded-xl text-[10px] font-black text-[#71BF44] uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer hover:scale-105 shadow-sm active:scale-95"
                                    title="Ver desglose detallado de emisores"
                                  >
                                    <span>{r.EmisoresAgrupados.length} Emisores</span>
                                    <span className="text-[10px]">🔍</span>
                                  </button>
                                ) : (
                                  <>
                                    <span className="text-[10px] font-black text-[#71BF44] bg-[#71BF44]/10 border border-[#71BF44]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none">
                                      {r.EmisoresAgrupados.length} {r.EmisoresAgrupados.length === 1 ? 'Emisor' : 'Emisores'}
                                    </span>
                                    <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                                      {r.EmisoresAgrupados.map((e: any) => {
                                        const isFocused = selectedEmisorId === e.id;
                                        return (
                                          <button
                                            key={e.id}
                                            onClick={() => setSelectedEmisorId(isFocused ? null : e.id)}
                                            className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                              isFocused
                                                ? 'bg-[#71BF44] text-white border-[#71BF44] shadow-sm'
                                                : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:text-[#71BF44] hover:bg-[#71BF44]/10 dark:hover:bg-[#71BF44]/10 hover:border-[#71BF44]/30'
                                            }`}
                                            title={isFocused ? `Quitar filtro de ${e.nemonico}` : `Ver comportamiento de ${e.nemonico}`}
                                          >
                                            {e.nemonico}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic">Sin emisores</span>
                            )
                          ) : r.IdEmisor && r.IdEmisor > 0 ? (
                            <button
                              onClick={() => setSelectedEmisorId(selectedEmisorId === r.IdEmisor ? null : r.IdEmisor)}
                              className={`inline-flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                                selectedEmisorId === r.IdEmisor
                                  ? 'bg-[#71BF44]/15 border-[#71BF44] text-[#71BF44]'
                                  : 'border-transparent hover:bg-[#71BF44]/10 hover:border-[#71BF44]/20'
                              }`}
                              title={selectedEmisorId === r.IdEmisor ? `Quitar filtro de ${r.Nemonico || 'S/N'}` : `Ver comportamiento de ${r.Nemonico || 'S/N'}`}
                            >
                              <span className={`text-xs font-black leading-none mb-1 transition-colors ${
                                selectedEmisorId === r.IdEmisor ? 'text-[#71BF44]' : 'text-neutral-800 dark:text-neutral-100'
                              }`}>
                                {r.Nemonico || 'S/N'}
                              </span>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                ID: {r.IdEmisor}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Global / Sistema</span>
                          )}
                        </td>
                        <td className="px-4 py-5 text-center">
                          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            {groupBySP && !r.PaisId ? (
                              <span className="text-neutral-400 italic">Múltiples</span>
                            ) : (
                              getPaisNombre(r.PaisId)
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-right font-bold text-neutral-900 dark:text-white">
                          {r.ejecucionesA.toLocaleString()}
                        </td>
                        <td className="px-4 py-5 text-right font-medium text-neutral-500">
                          {r.ejecucionesB.toLocaleString()}
                        </td>
                        <td className="px-4 py-5 text-right font-black">
                          <div className={`flex flex-col items-end ${deltaEjColor}`}>
                            <span className="text-xs">
                              {deltaEjSign}{r.deltaEjecuciones.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-bold opacity-80">
                              {deltaEjSign}{r.deltaEjecucionesPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-right font-bold text-neutral-900 dark:text-white">
                          {r.promedioA.toLocaleString()} ms
                        </td>
                        <td className="px-4 py-5 text-right font-medium text-neutral-500">
                          {r.promedioB.toLocaleString()} ms
                        </td>
                        <td className="px-4 py-5 text-right font-black">
                          <div className={`flex flex-col items-end ${deltaPrColor}`}>
                            <span className="text-xs">
                              {deltaPrSign}{r.deltaPromedio.toLocaleString()} ms
                            </span>
                            <span className="text-[9px] font-bold opacity-80">
                              {deltaPrSign}{r.deltaPromedioPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-right font-bold text-neutral-900 dark:text-white">
                          <span className={r.bloqueosA > 0 ? 'text-red-500 font-black' : 'text-neutral-400 opacity-60'}>
                            {r.bloqueosA.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-right font-medium text-neutral-500">
                          <span className={r.bloqueosB > 0 ? 'text-neutral-500 font-bold' : 'text-neutral-400 opacity-30'}>
                            {r.bloqueosB.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-black">
                          <div className={`flex flex-col items-end ${deltaBlColor}`}>
                            <span className="text-xs">
                              {deltaBlSign}{r.deltaBloqueos.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-bold opacity-80">
                              {deltaBlSign}{r.deltaBloqueosPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-20 text-neutral-400 text-xs font-bold">
                No se encontraron registros comparativos que coincidan con la búsqueda.
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal de Detalle de Emisores */}
      {modalSP && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850/20">
              <div>
                <span className="text-[9px] font-black text-[#71BF44] uppercase tracking-widest block mb-1">
                  Desglose de Emisores
                </span>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white break-all pr-4">
                  {modalSP}
                </h3>
              </div>
              <button
                onClick={() => setModalSP(null)}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all cursor-pointer"
                title="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800 select-none">
                      <th 
                        onClick={() => requestModalSort('nemonico')} 
                        className="pb-4 pl-2 cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center group">
                          Emisor / Nemónico
                          {renderModalSortIcon('nemonico')}
                        </div>
                      </th>
                      <th 
                        onClick={() => requestModalSort('paisId')} 
                        className="pb-4 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-center group">
                          País
                          {renderModalSortIcon('paisId')}
                        </div>
                      </th>
                      <th 
                        onClick={() => requestModalSort('ejecuciones')} 
                        className="pb-4 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-end group">
                          Ejecuciones (%)
                          {renderModalSortIcon('ejecuciones')}
                        </div>
                      </th>
                      <th 
                        onClick={() => requestModalSort('tiempoPromedio')} 
                        className="pb-4 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-end group">
                          Promedio (ms)
                          {renderModalSortIcon('tiempoPromedio')}
                        </div>
                      </th>
                      <th 
                        onClick={() => requestModalSort('bloqueos')} 
                        className="pb-4 text-right cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-end group">
                          Total Bloqueos (%)
                          {renderModalSortIcon('bloqueos')}
                        </div>
                      </th>
                      <th 
                        onClick={() => requestModalSort('ultimaTrx')} 
                        className="pb-4 pl-4 cursor-pointer hover:text-neutral-600 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center group">
                          Última Trx Autorizada
                          {renderModalSortIcon('ultimaTrx')}
                        </div>
                      </th>
                      <th className="pb-4 text-right pr-2 font-black">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                    {sortedModalEmitters.map((em, idx) => {
                      const isFocused = selectedEmisorId === em.id;
                      const hasAlert = em.id && em.id > 0 && em.ejecuciones > 0 && (
                        !em.ultimaTrx || em.ultimaTrx === 'NULL' || em.ultimaTrx === '---' ||
                        (new Date(em.ultimaTrx) < new Date(new Date().setDate(new Date().getDate() - 14)))
                      );

                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors text-xs ${hasAlert ? 'bg-red-500/[0.02]' : ''}`}
                        >
                          <td className="py-4 pl-2 font-bold text-neutral-850 dark:text-neutral-200">
                            <div className="flex flex-col">
                              <span className="font-black text-sm">{em.nemonico}</span>
                              <span className="text-[9px] text-neutral-400 uppercase tracking-widest font-bold">
                                ID: {em.id || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-center text-neutral-600 dark:text-neutral-300 font-semibold">
                            {getPaisNombre(em.paisId)}
                          </td>
                          <td className="py-4 text-right font-black text-neutral-850 dark:text-white">
                            <div>{em.ejecuciones.toLocaleString()}</div>
                            <div className="text-[9px] text-neutral-400 font-bold mt-0.5">
                              {em.ejecucionesPct.toFixed(1)}% del SP
                            </div>
                          </td>
                          <td className="py-4 text-right font-bold text-neutral-700 dark:text-neutral-300">
                            {em.tiempoPromedio.toLocaleString()} ms
                          </td>
                          <td className="py-4 text-right font-bold">
                            <div className={em.bloqueos > 0 ? 'text-red-500' : 'text-neutral-300 dark:text-neutral-600'}>
                              {em.bloqueos.toLocaleString()}
                            </div>
                            {em.bloqueos > 0 && (
                              <div className="text-[9px] text-red-400 font-bold mt-0.5">
                                {em.bloqueosPct.toFixed(1)}% del SP
                              </div>
                            )}
                          </td>
                          <td className="py-4 pl-4 text-neutral-600 dark:text-neutral-300">
                            {hasAlert ? (
                              <span className="text-red-500 font-black text-[10px] uppercase bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
                                Inactivo &gt;14d
                              </span>
                            ) : em.ultimaTrx && em.ultimaTrx !== 'NULL' && em.ultimaTrx !== '---' ? (
                              <span className="font-medium text-xs">
                                {em.ultimaTrx.split(' ')[0]} <span className="text-[10px] text-neutral-400">{em.ultimaTrx.split(' ')[1] || ''}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 italic">Sin registros trx</span>
                            )}
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button
                              onClick={() => {
                                setSelectedEmisorId(isFocused ? null : em.id);
                                setModalSP(null);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isFocused
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-[#71BF44]/10 text-[#71BF44] hover:bg-[#71BF44] hover:text-white border border-[#71BF44]/20'
                              }`}
                            >
                              {isFocused ? 'Quitar' : 'Focalizar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/10 flex justify-end">
              <button
                onClick={() => setModalSP(null)}
                className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
