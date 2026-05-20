'use client';
// Version: 1.0.1 - Force Vercel Redeploy

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
  ChevronUp,
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
  LifeBuoy
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/components/NotificationProvider';
import { formatDate } from '@/lib/formatters';

interface Voucher {
  ambiente: string;
  co_motivo: string;
  co_pais: number;
  co_nemonico: string;
  Column1: string; // ID
  co_hora_in: string;
  co_fecha_emision: string;
  co_num_comprobante: string;
  co_codigo_tipo_documento: string;
  co_establecimiento: string;
  co_punto_emision: string;
  Reprocesable: boolean;
  co_detalle: string;
  co_ultima_actualizacion: string;
  co_numero_reprocesos: number;
  co_hora_reproceso: string;
  DescripcionEstatus: string;
  DescripcionTipoDocumento: string;
}

const AMBIENTE_DOMAINS: Record<string, string> = {
  'V5': 'https://www5.mysatcomla.com',
  'Colombia': 'https://colombia.mysatcomla.com',
};

const AMBIENTE_LABELS: Record<string, string> = {
  'V5': 'V5',
  'Colombia': 'Colombia-AWS',
};

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

type SortField = keyof Voucher | 'pais_name';
type SortOrder = 'asc' | 'desc';

export default function UnauthorizedVouchersPage() {
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(1800);
  const [copied, setCopied] = useState(false);
  const [groupCopied, setGroupCopied] = useState<string | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

  const { data: session } = useSession();
  const { showNotification } = useNotification();
  
  const handleSync = async () => {
    try {
      setRefreshing(true);
      showNotification('Iniciando sincronización forzada...', 'info');
      // Llamada al SP de forzado (sin parámetros de país ya que es global en el backend)
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=V5&Proceso=consulta_tablero_no_autorizados_2026_forzar`);
      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      
      showNotification('Sincronización enviada con éxito. Los datos se actualizarán en breve.', 'success');
      // Refrescamos la vista actual después de un pequeño delay
      setTimeout(() => fetchData(true), 2000);
    } catch (err: any) {
      showNotification(`Error al sincronizar: ${err.message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Case Creation States
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [casePriority, setCasePriority] = useState('Media');
  const [caseSubject, setCaseSubject] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseTargetVouchers, setCaseTargetVouchers] = useState<Voucher[]>([]);
  const [caseArea, setCaseArea] = useState('Infraestructura');
  const [caseDept, setCaseDept] = useState('816030000000006907'); // Default: Soporte
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);
  const [isPreview, setIsPreview] = useState(true);

  // Estados para creación de Regla de Monitoreo
  const [modalTab, setModalTab] = useState<'caso'|'regla'>('caso');
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState('DIARIO');
  const [ruleMinEvents, setRuleMinEvents] = useState(10);
  const [ruleMainStatus, setRuleMainStatus] = useState('*');
  const [ruleMainReason, setRuleMainReason] = useState('*');
  const [ruleCountMode, setRuleCountMode] = useState('POR_EMISOR');
  const [ruleCountType, setRuleCountType] = useState('NUMERO');
  const [ruleNotifyType, setRuleNotifyType] = useState('TODOS');

  // Layout states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200;
  const [sortField, setSortField] = useState<SortField>('co_hora_in');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedAmbiente, setSelectedAmbiente] = useState<string>('');
  const [availableCountries, setAvailableCountries] = useState<{co_pais: number, count: number}[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Global but hidden from top UI (driven by column filters)
  const [filters, setFilters] = useState({
    co_num_comprobante: '',
    co_detalle: '',
    co_nemonico: '',
    co_pais: '',
    ambiente: '',
    DescripcionEstatus: '',
    DescripcionTipoDocumento: '',
    co_establecimiento: '',
    co_punto_emision: '',
  });

  const fetchCountries = useCallback(async (ambiente: string) => {
    if (!ambiente) return;
    try {
      setLoading(true);
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${ambiente}&Proceso=consulta_tablero_paises_ambiente_2026`);
      if (!res.ok) throw new Error('Error al obtener lista de países');
      const json = await res.json();
      
      let countries: any[] = [];
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item && item.data) {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) countries = [...countries, ...parsed];
            } catch(e) { console.error('Error al parsear países:', e); }
          } else if (item && item.co_pais) {
            countries.push(item);
          }
        });
      }
      
      // Filtrar elementos nulos y asegurar que sean únicos
      const cleanCountries = countries.map(c => ({
        co_pais: c.co_pais || c.Pais, // Soporte para ambos nombres de campo
        count: c.count || c.total || 0
      })).filter(c => c && (c.co_pais !== undefined && c.co_pais !== null));
      
      setAvailableCountries(cleanCountries);
      setError(null);
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const fetchData = useCallback(async (isRefresh = false, countryCodeOverride?: number) => {
    const countryCode = countryCodeOverride || selectedCountryCode;
    if (!selectedAmbiente || !countryCode) return;

    // Lógica de selección de SP según requerimiento
    let spName = 'consulta_tablero_no_autorizados_2026_OTROS';
    if (countryCode === 593) spName = 'consulta_tablero_no_autorizados_2026_EC';
    else if (countryCode === 57) spName = 'consulta_tablero_no_autorizados_2026_COL';
    else if (countryCode === 507) spName = 'consulta_tablero_no_autorizados_2026_PA';
    else if (countryCode === 506) spName = 'consulta_tablero_no_autorizados_2026_CR';

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const res = await fetch(`https://sara.mysatcomla.com/webhook/GetData?Ambiente=${selectedAmbiente}&Proceso=${spName}&Pais=${countryCode}`);

      if (!res.ok) throw new Error('Error al obtener datos de comprobantes');
      
      const json: any = await res.json();
      let flattened: Voucher[] = [];
      
      if (Array.isArray(json)) {
        json.forEach(item => {
          if (item.data && typeof item.data === 'string') {
            try {
              const parsed = JSON.parse(item.data);
              if (Array.isArray(parsed)) flattened = [...flattened, ...parsed];
            } catch (e) { console.error('Error parsing nested JSON', e); }
          } else if (item.ambiente || item.Column1 || item.co_id_comprobante) {
            flattened.push(item);
          }
        });
      }
      
      const uniqueMap = new Map();
      flattened.forEach(v => {
        if (!v) return;
        const id = v.Column1 || (v as any).co_id_comprobante;
        if (id && !uniqueMap.has(id)) uniqueMap.set(id, v);
      });
      
      setData(Array.from(uniqueMap.values()));
      setError(null);
      setCountdown(1800);
      setExpandedGroups(new Set());
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAmbiente, selectedCountryCode]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/db/monitoreo-rules');
      const json = await res.json();
      if (json.data) setRules(json.data);
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (selectedAmbiente) {
      fetchCountries(selectedAmbiente);
      setSelectedCountryCode(null);
      setData([]);
    }
  }, [selectedAmbiente, fetchCountries]);

  // Selección automática del país según prioridad: EC (593), COL (57), CR (506), PA (507)
  useEffect(() => {
    if (availableCountries.length > 0 && selectedCountryCode === null) {
      const priority = [593, 57, 506, 507];
      const codesInAvailable = availableCountries.map(c => Number(c.co_pais));
      
      const found = priority.find(p => codesInAvailable.includes(p));
      if (found) {
        setSelectedCountryCode(found);
        const name = PAIS_MAP[found] || String(found);
        setFilters(f => ({ ...f, co_pais: name }));
      } else if (codesInAvailable.length > 0) {
        // Fallback al primer país disponible si ninguno de la prioridad existe
        const firstCode = codesInAvailable[0];
        setSelectedCountryCode(firstCode);
        const name = PAIS_MAP[firstCode] || String(firstCode);
        setFilters(f => ({ ...f, co_pais: name }));
      }
    }
  }, [availableCountries, selectedCountryCode]);

  useEffect(() => {
    if (selectedCountryCode) {
      fetchData();
    }
  }, [selectedCountryCode, fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 1800;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);


  const anyFilterActive = useMemo(() => Object.values(filters).some(v => v !== '') || selectedDate !== '' || showUnmappedOnly, [filters, selectedDate, showUnmappedOnly]);

  const isVoucherMapped = useCallback((v: Voucher) => {
    if (rules.length === 0) return false;
    return rules.some(rule => {
      if (!rule.esta_activa) return false;
      
      // Filtro de ambiente
      if (rule.ambiente !== 'Todos' && rule.ambiente !== selectedAmbiente) return false;

      // Match de Estado
      const statusMatch = rule.expresion_estado === '*' || 
                         (v.DescripcionEstatus && v.DescripcionEstatus.toLowerCase().includes(rule.expresion_estado.toLowerCase()));
      
      // Match de Motivo
      const reasonMatch = rule.expresion_motivo === '*' || 
                         (v.co_detalle && v.co_detalle.toLowerCase().includes(rule.expresion_motivo.toLowerCase()));
                         
      return statusMatch && reasonMatch;
    });
  }, [rules, selectedAmbiente]);

  const stats = useMemo(() => {
    const byPais = data.reduce((acc, d) => {
      acc[d.co_pais] = (acc[d.co_pais] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byTime = data.filter(item => {
      return (
        (!filters.co_num_comprobante || item.co_num_comprobante.toLowerCase().includes(filters.co_num_comprobante.toLowerCase())) &&
        (!filters.co_detalle || item.co_detalle.toLowerCase().includes(filters.co_detalle.toLowerCase())) &&
        (!filters.co_nemonico || item.co_nemonico.toLowerCase().includes(filters.co_nemonico.toLowerCase())) &&
        (!filters.co_pais || (PAIS_MAP[item.co_pais] || item.co_pais.toString()).toLowerCase().includes(filters.co_pais.toLowerCase())) &&
        (!filters.ambiente || item.ambiente.toLowerCase().includes(filters.ambiente.toLowerCase())) &&
        (!filters.DescripcionEstatus || item.DescripcionEstatus.toLowerCase().includes(filters.DescripcionEstatus.toLowerCase())) &&
        (!filters.DescripcionTipoDocumento || item.DescripcionTipoDocumento.toLowerCase().includes(filters.DescripcionTipoDocumento.toLowerCase())) &&
        (!filters.co_establecimiento || item.co_establecimiento.toLowerCase().includes(filters.co_establecimiento.toLowerCase())) &&
        (!filters.co_punto_emision || item.co_punto_emision.toLowerCase().includes(filters.co_punto_emision.toLowerCase()))
      );
    }).reduce((acc, d) => {
      const field = d.co_hora_in;
      if (!field || typeof field !== 'string') return acc;
      const datePart = field.split('T')[0];
      if (!datePart) return acc;
      acc[datePart] = (acc[datePart] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedDates = Object.entries(byTime).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    }).slice(-15);

    return { byPais, sortedDates };
  }, [data, filters]);

  const maxDateCount = useMemo(() => Math.max(...stats.sortedDates.map(d => d[1]), 1), [stats.sortedDates]);

  // Selección automática eliminada para dar paso a selección manual por país
  /*
  useEffect(() => {
    if (data.length > 0 && selectedAmbiente && !anyFilterActive) {
      const countries = Object.keys(stats.byPais);
      if (countries.length > 0) {
        const firstCountryCode = Number(countries[0]);
        const countryName = PAIS_MAP[firstCountryCode] || String(firstCountryCode);
        setFilters(f => ({ ...f, co_pais: countryName }));
      }
    }
  }, [data, selectedAmbiente, anyFilterActive, stats.byPais]);
  */

  const lastUpdate = useMemo(() => {
    if (data.length === 0) return '---';
    const dates = data.map(d => new Date(d.co_ultima_actualizacion).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return '---';
    return formatDate(new Date(Math.max(...dates)), true);
  }, [data]);

  const isOutdated = useMemo(() => {
    if (data.length === 0) return false;
    const dates = data.map(d => new Date(d.co_ultima_actualizacion).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return false;
    const maxTimestamp = Math.max(...dates);
    const now = new Date().getTime();
    const diffMs = now - maxTimestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 12;
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      return (
        (!filters.co_num_comprobante || item.co_num_comprobante.toLowerCase().includes(filters.co_num_comprobante.toLowerCase())) &&
        (!filters.co_detalle || item.co_detalle.toLowerCase().includes(filters.co_detalle.toLowerCase())) &&
        (!filters.co_nemonico || item.co_nemonico.toLowerCase().includes(filters.co_nemonico.toLowerCase())) &&
        (!filters.co_pais || (PAIS_MAP[item.co_pais] || item.co_pais.toString()).toLowerCase().includes(filters.co_pais.toLowerCase())) &&
        (!filters.ambiente || item.ambiente.toLowerCase().includes(filters.ambiente.toLowerCase())) &&
        (!filters.DescripcionEstatus || item.DescripcionEstatus.toLowerCase().includes(filters.DescripcionEstatus.toLowerCase())) &&
        (!filters.DescripcionTipoDocumento || item.DescripcionTipoDocumento.toLowerCase().includes(filters.DescripcionTipoDocumento.toLowerCase())) &&
        (!filters.co_establecimiento || item.co_establecimiento.toLowerCase().includes(filters.co_establecimiento.toLowerCase())) &&
        (!filters.co_punto_emision || item.co_punto_emision.toLowerCase().includes(filters.co_punto_emision.toLowerCase())) &&
        (!selectedDate || (item.co_hora_in && item.co_hora_in.split('T')[0] === selectedDate))
      );
    });

    result.sort((a, b) => {
      let valA: any = a[sortField as keyof Voucher] ?? '';
      let valB: any = b[sortField as keyof Voucher] ?? '';
      if (sortField === 'pais_name') {
        valA = PAIS_MAP[a.co_pais] || '';
        valB = PAIS_MAP[b.co_pais] || '';
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    if (showUnmappedOnly) {
      result = result.filter(v => !isVoucherMapped(v));
    }

    return result;
  }, [data, filters, sortField, sortOrder, selectedDate, showUnmappedOnly, isVoucherMapped]);

  const groupedData = useMemo(() => {
    if (!anyFilterActive) return [];
    
    const groupRecursive = (vouchers: Voucher[], fields: string[], depth = 0): any[] => {
      if (fields.length === 0 || depth >= fields.length) return vouchers;
      
      const field = fields[depth];
      const groups: Record<string, Voucher[]> = {};
      
      vouchers.forEach(v => {
        let key = 'Sin Categoría';
        if (field === 'co_nemonico') key = (v.co_nemonico || '').trim();
        else if (field === 'co_detalle') key = (v.co_detalle || '').trim() || 'Sin Detalle';
        else if (field === 'DescripcionEstatus') key = (v.DescripcionEstatus || '').trim() || 'Sin Estado';
        else if (field === 'DescripcionTipoDocumento') key = (v.DescripcionTipoDocumento || '').trim() || 'Sin Tipo Documento';
        else if (field === 'co_hora_in') key = v.co_hora_in ? v.co_hora_in.split('T')[0] : 'Sin Fecha';
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      });
      
      return Object.entries(groups).map(([key, items]) => {
        const vouchers = Array.isArray(items) ? items : [];
        const mappedCount = vouchers.filter(v => isVoucherMapped(v)).length;
        const isFullyMapped = vouchers.length > 0 && mappedCount === vouchers.length;
        const isPartiallyMapped = mappedCount > 0 && mappedCount < vouchers.length;

        return {
          key,
          items: groupRecursive(items, fields, depth + 1),
          count: items.length,
          mappedCount,
          isFullyMapped,
          isPartiallyMapped,
          field
        };
      }).sort((a, b) => b.count - a.count);
    };

    if (groupBy.length === 0) return [{ key: 'Todos', items: filteredData, count: filteredData.length, field: 'none' }];
    
    return groupRecursive(filteredData, groupBy);
  }, [filteredData, groupBy, anyFilterActive]);

  const displayItems = useMemo(() => {
    if (!anyFilterActive) return [];
    
    const flat: any[] = [];
    
    const flatten = (items: any[], path = '') => {
      items.forEach(item => {
        if ('items' in item) {
          const currentPath = path ? `${path} > ${item.key}` : item.key;
          
          // Get all leaf vouchers from this group recursively
          const getAllVouchers = (node: any): Voucher[] => {
            if (Array.isArray(node)) return node;
            if (Array.isArray(node.items)) {
              if (node.items.length > 0 && !('items' in node.items[0])) return node.items;
              return node.items.flatMap((child: any) => getAllVouchers(child));
            }
            return [];
          };

          const vouchers = getAllVouchers(item);

          flat.push({ 
            type: 'header', 
            label: item.key, 
            count: item.count, 
            mappedCount: item.mappedCount,
            isFullyMapped: item.isFullyMapped,
            isPartiallyMapped: item.isPartiallyMapped,
            vouchers: vouchers,
            path: currentPath,
            depth: currentPath.split(' > ').length - 1
          });
          
          if (expandedGroups.has(currentPath)) {
            if (Array.isArray(item.items)) {
              if (item.items.length > 0 && 'items' in item.items[0]) {
                flatten(item.items, currentPath);
              } else {
                flat.push(...item.items);
              }
            }
          }
        }
      });
    };

    if (groupBy.length === 0) {
      flat.push(...filteredData);
    } else {
      flatten(groupedData);
    }
    
    return flat;
  }, [groupedData, groupBy, expandedGroups, anyFilterActive, filteredData]);

  const totalPages = Math.ceil(displayItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayItems.slice(start, start + pageSize);
  }, [displayItems, currentPage]);

  const handleCopy = () => {
    const ids = filteredData.map(v => v.Column1 || (v as any).co_id_comprobante).join('\n');
    navigator.clipboard.writeText(ids);
    setCopied(true);
    showNotification('IDs copiados al portapapeles', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMassReprocess = async (ambiente: string, ids: string) => {
    try {
      setLoading(true);
      const res = await fetch('https://sara.mysatcomla.com/webhook/ReprocesoMasivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Ambiente: ambiente,
          Data: ids
        })
      });

      if (!res.ok) throw new Error('Error al procesar la solicitud');
      
      showNotification('Reproceso masivo iniciado correctamente', 'success');
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = (vouchers: Voucher[]) => {
    if (!vouchers.length) return;
    
    const emitters = Array.from(new Set(vouchers.map(v => v.co_nemonico)));
    const emitterSummary = emitters.map(n => {
      const count = vouchers.filter(v => v.co_nemonico === n).length;
      return `- ${n}: ${count} evento(s)`;
    }).join('\n');

    // Muestreo aleatorio: Máximo 10 por emisor, límite global de 200 IDs
    let selectedIds: string[] = [];
    for (const emitter of emitters) {
      if (selectedIds.length >= 200) break;
      const emitterVouchers = vouchers.filter(v => v.co_nemonico === emitter);
      const shuffled = [...emitterVouchers].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10).map(v => v.Column1 || (v as any).co_id_comprobante);
      selectedIds = [...selectedIds, ...selected];
    }
    
    if (selectedIds.length > 200) {
      selectedIds = selectedIds.slice(0, 200);
    }

    const idsNote = vouchers.length > selectedIds.length 
      ? `\n*Nota: Mostrando una muestra representativa de ${selectedIds.length} IDs (máximo 10 por emisor, límite de 200).*` 
      : '';

    const errorMessages = Array.from(new Set(vouchers.map(v => v.co_detalle))).filter(Boolean);
    const statuses = Array.from(new Set(vouchers.map(v => v.DescripcionEstatus))).filter(Boolean);

    const mainStatus = statuses[0] || 'N/A';
    const mainReason = errorMessages[0] ? (errorMessages[0].length > 50 ? errorMessages[0].substring(0, 47) + '...' : errorMessages[0]) : 'Sin detalle';

    setRuleMainStatus(mainStatus);
    setRuleMainReason(errorMessages[0] || '*');
    setRuleName(`Alerta: ${mainStatus}`);
    setModalTab('caso');

    const userName = session?.user?.name || 'Usuario Satcom';
    const activeFilters = Object.entries(filters).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');

    setCaseSubject(`Incidencia ${selectedAmbiente}: [${mainStatus}] - ${mainReason}`);
    setCaseDescription(`
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 800px; border: 1px solid #e1e4e8; padding: 20px; border-radius: 10px; background-color: #ffffff;">
  <h2 style="color: #d9534f; font-size: 20px; margin-top: 0; border-bottom: 2px solid #d9534f; padding-bottom: 10px;">
    🚨 REPORTE DE INCIDENCIA OPERATIVA
  </h2>
  
  <div style="margin: 15px 0; background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 5px solid #0052cc;">
    <p style="margin: 5px 0;"><strong>Generado por:</strong> <span style="color: #0052cc;">${userName}</span></p>
    <p style="margin: 5px 0;"><strong>Ambiente:</strong> <span style="color: #0052cc;">${selectedAmbiente}</span></p>
    <p style="margin: 5px 0;"><strong>Afectación:</strong> <span style="background-color: #ffeb3b; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${vouchers.length} documentos</span></p>
  </div>

  <h3 style="color: #444; font-size: 16px; margin-top: 20px;">📝 DETALLE</h3>
  <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e1e4e8; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 4px 0; color: #666; width: 110px;"><b>Filtros:</b></td><td style="padding: 4px 0;">${activeFilters || 'Ninguno'}</td></tr>
      <tr><td style="padding: 4px 0; color: #666;"><b>Estados:</b></td><td style="padding: 4px 0;">${statuses.join(', ')}</td></tr>
      <tr><td style="padding: 4px 0; color: #666;"><b>Resumen:</b></td><td style="padding: 4px 0;">${errorMessages.slice(0, 3).map(m => m.length > 60 ? m.substring(0, 57) + '...' : m).join(' / ')}</td></tr>
    </table>
  </div>

  <h3 style="color: #444; font-size: 16px; margin-top: 20px;">🔍 MUESTREO DE IDs (TOP ${selectedIds.length})</h3>
  <div style="background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 13px; overflow-x: auto;">
    ${selectedIds.join('<br>')}
  </div>

  <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0 10px 0;">
  <p style="font-style: italic; color: #888; font-size: 11px; text-align: right;">
    Generado por SARA Monitoring - ${new Date().toLocaleString('es-EC')}
  </p>
</div>
    `.trim());
    
    setCaseTargetVouchers(vouchers);
    setShowCaseModal(true);
  };

  const submitCase = async () => {
    try {
      setIsSubmittingCase(true);
      const res = await fetch('https://satcomla.app.n8n.cloud/webhook/CasosDesk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic QWRtaW46TUFJTkNyZWFyY2Fzb3MyMDI2ISE='
        },
        body: JSON.stringify({
          departmentId: caseDept,
          contactId: "816030000053275791",
          subject: caseSubject,
          description: caseDescription,
          priority: casePriority.split('/')[0], // Use base priority (Crítica)
          classification: "Incidencia en producción",
          cf: {
            cf_existe_una_solucion_temporal_disponible_1: "No aplica",
            cf_area: caseDept === '816030000001304039' ? caseArea : "Soporte",
            cf_portal: selectedAmbiente || "Rocca"
          },
          channel: "Dashboard-Monitoreo",
          status: "Abierto"
        })
      });

      if (!res.ok) throw new Error('Fallo al crear el caso en la mesa de ayuda');
      
      const responseData = await res.json();
      
      const dataNode = responseData.items ? responseData.items[0] : responseData[0];
      
      // Manejar errores devueltos explícitamente en el JSON de n8n
      if (dataNode?.error) {
        throw new Error(dataNode.error.message || 'Error desconocido desde la mesa de ayuda');
      }

      let ticketNum = '';
      
      try {
        ticketNum = dataNode?.content[0]?.text?.ticketNumber || '';
      } catch (e) {
        console.error('Error parsing ticket number', e);
      }

      showNotification('Caso creado exitosamente en la mesa de ayuda', 'ticket', ticketNum);
      setShowCaseModal(false);
    } catch (err: any) {
      showNotification(`Error al crear caso: ${err.message}`, 'error');
    } finally {
      setIsSubmittingCase(false);
    }
  };

  const submitRule = async () => {
    try {
      setIsSubmittingRule(true);
      const res = await fetch('/api/db/monitoreo-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: ruleName,
          ambiente: selectedAmbiente || 'Todos',
          expresion_estado: ruleMainStatus,
          expresion_motivo: ruleMainReason,
          minimo_eventos: ruleMinEvents,
          modo: ruleCountMode,
          frecuencia: ruleFrequency,
          prioridad_ticket: casePriority.split('/')[0],
          departamento_id: caseDept,
          esta_activa: true,
          configuracion: {
            tipo_conteo: ruleCountType,
            modo_conteo: ruleCountMode,
            frecuencia_evaluacion: ruleFrequency,
            notificar: ruleNotifyType
          }
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error del servidor');
      
      // Removido if(error) porque el error se lanza arriba si !res.ok
      showNotification('Regla automática guardada exitosamente', 'success');
      setShowCaseModal(false);
    } catch (err: any) {
      showNotification(`Error creando regla: ${err.message}`, 'error');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const exportToCSV = () => {
    if (!filteredData.length) return;

    const headers = [
      'ID',
      'Comprobante',
      'Tipo Documento',
      'Fecha Emisión',
      'Establecimiento',
      'Punto Emisión',
      'Nemónico',
      'Ambiente',
      'País',
      'Fecha Ingreso',
      'Estado',
      'Detalle',
      'Intenciones',
      'Última Gestión'
    ];

    // Helper to force text format in Excel and escape semicolons
    const sanitize = (valValue: any) => {
      if (valValue === null || valValue === undefined) return '""';
      let str = String(valValue).replace(/"/g, '""').trim();
      // Prefix with \t to force Excel to treat as text (avoids scientific notation)
      return `"\t${str}"`;
    };

    const rows = filteredData.map(v => {
      const id = v.Column1 || (v as any).co_id_comprobante;
      return [
        sanitize(id),
        sanitize(v.co_num_comprobante),
        sanitize(v.DescripcionTipoDocumento),
        sanitize(v.co_fecha_emision ? new Date(v.co_fecha_emision).toLocaleDateString('es-EC') : ''),
        sanitize(v.co_establecimiento),
        sanitize(v.co_punto_emision),
        sanitize(v.co_nemonico),
        sanitize(v.ambiente),
        sanitize(PAIS_MAP[v.co_pais] || v.co_pais),
        sanitize(v.co_hora_in ? formatDate(v.co_hora_in, true) : ''),
        sanitize(v.DescripcionEstatus),
        sanitize(v.co_detalle),
        sanitize(v.co_numero_reprocesos || 0),
        sanitize(v.co_hora_reproceso ? formatDate(v.co_hora_reproceso, true) : '')
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `NoAutorizados_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const toggleGroup = (path: string) => {
    const next = new Set(expandedGroups);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedGroups(next);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all">
          <div className="flex flex-col items-center gap-6 p-10 bg-white dark:bg-[#0c0c0c] border border-[#71BF44]/20 rounded-[40px] shadow-2xl shadow-[#71BF44]/10 animate-in zoom-in duration-300">
            <div className="relative">
              <RefreshCw className="w-16 h-16 text-[#71BF44] animate-spin" />
              <div className="absolute inset-0 blur-2xl bg-[#71BF44]/20 animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#71BF44] font-black uppercase tracking-[0.3em] text-xs">Procesando</span>
              <span className="text-neutral-500 font-bold text-[10px] uppercase tracking-widest">Satcom Analytics</span>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="mb-12 py-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/analytics" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1 font-semibold transition-all group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Regresar a Analytics
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-white dark:bg-[#111] border border-[#71BF44]/20 rounded-2xl shadow-lg shadow-[#71BF44]/5 flex items-center justify-center">
              <FileWarning className="w-8 h-8 text-[#71BF44]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tighter leading-tight mb-2">
                Comprobantes No Autorizados <span className="text-[#71BF44] opacity-50 text-xs sm:text-sm ml-2 font-black">(Refinado)</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 text-[#71BF44] ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{formatCountdown(countdown)}</span>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#71BF44] animate-pulse"></div>
                <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-[0.2em]">Live Monitor</span>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSync}
            disabled={refreshing}
            className="w-full md:w-auto bg-neutral-900 border border-neutral-800 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black hover:border-[#71BF44] flex items-center justify-center gap-3 shadow-2xl active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar Datos
          </button>
        </div>
      </header>
      
      {/* Global Environment Selector (Step 1) */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 rounded-[32px] shadow-sm">
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-4 sm:px-6 py-2.5 rounded-2xl shadow-xl w-full md:w-auto overflow-hidden">
            <Globe className="w-4 h-4 text-[#71BF44] shrink-0" />
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">Ambiente:</span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
               {['V5', 'Colombia'].map(amb => (
                 <button
                  key={amb}
                  onClick={() => { 
                    setSelectedAmbiente(amb); 
                    setSelectedCountryCode(null);
                    setAvailableCountries([]);
                    setCurrentPage(1); 
                    setData([]); 
                    setFilters({
                      co_num_comprobante: '',
                      co_detalle: '',
                      co_nemonico: '',
                      co_pais: '',
                      ambiente: '',
                      DescripcionEstatus: '',
                      DescripcionTipoDocumento: '',
                      co_establecimiento: '',
                      co_punto_emision: '',
                    });
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${selectedAmbiente === amb ? 'bg-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                 >
                   {AMBIENTE_LABELS[amb] || amb}
                 </button>
               ))}
            </div>
          </div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest md:ml-4 italic opacity-50 text-center md:text-left">
            {!selectedAmbiente ? '← Inicie seleccionando un ambiente de trabajo' : 'Ambiente activo'}
          </p>
      </div>

      {!selectedAmbiente ? (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-neutral-100 dark:border-neutral-800/30 rounded-[40px] animate-in fade-in zoom-in duration-700">
           <Globe className="w-16 h-16 text-neutral-200 dark:text-neutral-800 animate-pulse mb-6" />
           <h2 className="text-xl font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-[0.3em] text-center">Seleccione un Ambiente<br/><span className="text-xs tracking-widest opacity-50">para comenzar el monitoreo</span></h2>
        </div>
      ) : (
        <>
          {/* Alerta de Desactualización */}
          {selectedCountryCode && isOutdated && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-500 shadow-lg shadow-red-500/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl text-red-500 shrink-0 animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Alerta: Datos Desactualizados</h4>
                  <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    La última actualización de datos para el país seleccionado fue el <span className="font-bold text-neutral-800 dark:text-white">{lastUpdate}</span>, lo que supera las 12 horas de antigüedad permitidas.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleSync}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-[9px] font-black text-red-500 uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronizar Ahora
              </button>
            </div>
          )}

          {/* Timeline Chart */}
          <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[24px] p-6 mb-8 shadow-sm">
             <div className="flex items-center gap-2 mb-8">
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#71BF44]" />
                  <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Volumen de Ingreso por Fecha (co_hora_in)</h3>
                </div>
                {selectedDate && (
                  <button 
                    onClick={() => setSelectedDate('')}
                    className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    <X className="w-3 h-3" /> Limpiar Filtro Fecha: {formatDate(selectedDate)}
                  </button>
                )}
              </div>
            </div>
             <div className="h-48 flex items-end gap-3 sm:gap-6 px-4 border-b border-neutral-100 dark:border-neutral-800/10">
                {stats.sortedDates.map(([date, count]) => (
                  <button 
                    key={date} 
                    onClick={() => setSelectedDate(selectedDate === date ? '' : date)}
                    className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end outline-none"
                  >
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 text-white text-[10px] font-black px-2 py-1 rounded-md pointer-events-none z-10 whitespace-nowrap">
                       {count} comprobantes
                     </div>
                     <div 
                       className={`w-full border-t-4 rounded-t-xl transition-all shadow-[0_0_20px_rgba(113,191,68,0.1)] ${selectedDate === date ? 'bg-[#71BF44] border-[#71BF44] h-full shadow-[#71BF44]/30' : 'bg-[#71BF44]/40 border-[#71BF44]/60 group-hover:bg-[#71BF44]/60'}`}
                       style={{ height: selectedDate === date ? '100%' : `${(count / maxDateCount) * 100}%` }}
                     />
                     <div className={`text-[8px] font-black rotate-45 origin-left mt-4 mb-2 whitespace-nowrap uppercase tracking-tighter ${selectedDate === date ? 'text-[#71BF44]' : 'text-neutral-500'}`}>
    
                       {formatDate(date)}
                     </div>
                  </button>
                ))}
             </div>
          </div>

      {/* Filters Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:flex xl:flex-wrap items-center gap-4 sm:gap-6 mb-8">

          {/* Country Selector (Second Step) */}
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-4 sm:px-6 py-2.5 rounded-2xl shadow-xl w-full sm:w-auto">
            <MapPin className="w-4 h-4 text-[#71BF44] shrink-0" />
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">País:</span>
            <select
              value={selectedCountryCode || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedCountryCode(val);
                const countryName = val ? (PAIS_MAP[val] || String(val)) : '';
                setFilters(f => ({ ...f, co_pais: countryName }));
                setCurrentPage(1);
              }}
              className="bg-transparent text-[9px] font-black uppercase text-[#71BF44] outline-none cursor-pointer hover:text-white transition-colors h-6 w-full sm:w-auto"
            >
              <option value="" className="bg-[#111] text-neutral-500">Seleccione País...</option>
              {availableCountries.map((c, idx) => {
                const code = c.co_pais;
                const name = PAIS_MAP[Number(code)] || String(code);
                return (
                  <option key={`${code}-${idx}`} value={code} className="bg-[#111] text-white">
                    {name} {Number(c.count) > 0 ? `(${c.count})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Última Actualización del País */}
          {selectedCountryCode && (
            <div className={`flex items-center gap-3 bg-neutral-900 px-4 sm:px-6 py-2.5 rounded-2xl shadow-xl w-full sm:w-auto animate-in fade-in slide-in-from-left duration-300 border ${isOutdated ? 'border-red-500/50' : 'border-neutral-800'}`}>
              <Clock className={`w-4 h-4 shrink-0 ${isOutdated ? 'text-red-500 animate-bounce' : 'text-[#71BF44] animate-pulse'}`} />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">Última Actualización:</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isOutdated ? 'text-red-500' : 'text-[#71BF44]'}`}>{lastUpdate}</span>
            </div>
          )}

          {/* Group Selector "Agrupar" (Now Second) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-neutral-900 border border-neutral-800 p-2 sm:px-6 sm:py-2.5 rounded-2xl shadow-xl w-full sm:w-auto overflow-hidden">
            <div className="flex items-center gap-3 px-2 sm:px-0">
              <Layers className="w-4 h-4 text-[#71BF44] shrink-0" />
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">Agrupar:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 px-2 sm:px-0">
               {[
                 { id: 'none', label: 'Plana' },
                 { id: 'DescripcionEstatus', label: 'Estado' },
                 { id: 'co_detalle', label: 'Motivo' },
                 { id: 'co_nemonico', label: 'Cliente' },
                 { id: 'DescripcionTipoDocumento', label: 'Doc' },
                 { id: 'co_hora_in', label: 'Fecha' }
               ].map(opt => {
                 const isActive = opt.id === 'none' ? groupBy.length === 0 : groupBy.includes(opt.id);
                 return (
                   <button
                    key={opt.id}
                    onClick={() => { 
                      if (opt.id === 'none') {
                        setGroupBy([]);
                      } else {
                        setGroupBy(prev => {
                          if (prev.includes(opt.id)) return prev.filter(g => g !== opt.id);
                          return [...prev, opt.id];
                        });
                      }
                      setCurrentPage(1); 
                      setExpandedGroups(new Set()); 
                    }}
                    className={`px-3 sm:px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${isActive ? 'bg-[#71BF44] text-white shadow-lg shadow-[#71BF44]/20' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                   >
                     {opt.label}
                   </button>
                 );
               })}
            </div>
         </div>

         {/* Active Group Tags */}
         {groupBy.length > 0 && (
           <div className="flex flex-wrap items-center gap-2 p-2 bg-[#1a1a1a] rounded-2xl border border-neutral-800 w-full sm:w-auto">
             {groupBy.map((g, idx) => {
               const label = [
                 { id: 'DescripcionEstatus', label: 'Estado' },
                 { id: 'co_detalle', label: 'Motivo' },
                 { id: 'co_nemonico', label: 'Cliente' },
                 { id: 'DescripcionTipoDocumento', label: 'Documento' },
                 { id: 'co_hora_in', label: 'F. Llegada' }
               ].find(opt => opt.id === g)?.label || g;
               
               return (
                 <div key={g} className="flex items-center gap-2 px-3 py-1 bg-[#71BF44]/20 border border-[#71BF44]/30 rounded-lg text-[9px] font-black text-[#71BF44] uppercase tracking-widest">
                   {label}
                   <button 
                    onClick={() => {
                      setGroupBy(prev => prev.filter(p => p !== g));
                      setCurrentPage(1);
                      setExpandedGroups(new Set());
                    }}
                    className="hover:text-white transition-colors"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               );
             })}
           </div>
         )}


          {/* Unmapped Filter Toggle */}
          <button
            onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all shadow-xl whitespace-nowrap ${showUnmappedOnly ? 'bg-red-500 text-white border-red-400 shadow-red-500/20' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'}`}
          >
            <AlertCircle className={`w-4 h-4 ${showUnmappedOnly ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{showUnmappedOnly ? 'Viendo solo No Mapeados' : 'Filtrar No Mapeados'}</span>
          </button>


          {/* Pagination Controls */}
         {totalPages > 1 && (
            <div className="flex items-center justify-between sm:justify-start gap-4 bg-[#111] border border-neutral-800 px-4 py-2 rounded-2xl w-full sm:w-auto">
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronsLeft className="w-5 h-5"/></button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronLeft className="w-5 h-5"/></button>
              </div>
              <span className="text-[10px] font-black text-white px-2 whitespace-nowrap uppercase tracking-widest">PAG {currentPage} / {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronRight className="w-5 h-5"/></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1 text-[#71BF44] disabled:opacity-20"><ChevronsRight className="w-5 h-5"/></button>
              </div>
            </div>
         )}
         
         {/* Export & Global Actions */}
         <div className="flex items-center gap-3 w-full sm:w-auto xl:ml-auto">
            {filteredData.length > 0 && anyFilterActive && (
              <button
                onClick={() => handleCreateCase(filteredData)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-amber-500 hover:bg-amber-500/10 transition-all rounded-2xl shadow-xl group"
              >
                <LifeBuoy className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Caso Global</span>
              </button>
            )}

            {filteredData.length > 0 && anyFilterActive && (
                <button
                  onClick={exportToCSV}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-[#71BF44] hover:bg-[#71BF44]/10 transition-all rounded-2xl shadow-xl group"
                >
                  <Download className="w-4 h-4 text-[#71BF44] group-hover:-translate-y-0.5 transition-transform" />
                  <span className="text-[10px] font-black text-[#71BF44] uppercase tracking-widest">Exportar</span>
                </button>
            )}
         </div>
      </div>

      {/* Main Grid */}
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-[32px] overflow-hidden shadow-2xl transition-all duration-300">
         <div className="overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                  <tr className="bg-neutral-50 dark:bg-[#0c0c0c] border-b border-neutral-200 dark:border-neutral-800">
                     <th className="px-6 py-4 min-w-[300px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_num_comprobante')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Comprobante
                              {sortField === 'co_num_comprobante' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="relative group">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700" />
                              <input 
                                placeholder="Filtrar por Número..."
                                value={filters.co_num_comprobante}
                                onChange={(e) => { setFilters(f => ({ ...f, co_num_comprobante: e.target.value })); setCurrentPage(1); }}
                                className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-[10px] font-medium outline-none transition-all focus:ring-1 focus:ring-[#71BF44]/30"
                              />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[200px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_establecimiento')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Establecimiento
                              {sortField === 'co_establecimiento' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="grid grid-cols-2 gap-2">
                             <input placeholder="Est." value={filters.co_establecimiento} onChange={(e) => setFilters(f => ({ ...f, co_establecimiento: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                             <input placeholder="Pto." value={filters.co_punto_emision} onChange={(e) => setFilters(f => ({ ...f, co_punto_emision: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[200px]">
                        <div className="space-y-4">
                           <button onClick={() => toggleSort('co_nemonico')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                              Origen
                              {sortField === 'co_nemonico' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                           </button>
                           <div className="space-y-2">
                              <input placeholder="Nemónico..." value={filters.co_nemonico} onChange={(e) => setFilters(f => ({ ...f, co_nemonico: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                              <input placeholder="País/Amb..." value={filters.ambiente} onChange={(e) => setFilters(f => ({ ...f, ambiente: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-800 rounded-lg px-2 py-1.5 text-[9px] outline-none" />
                           </div>
                        </div>
                     </th>
                     <th className="px-6 py-6 min-w-[150px]">
                        <button onClick={() => toggleSort('co_hora_in')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-[#71BF44] transition-colors group">
                           Ingreso
                           {sortField === 'co_hora_in' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#71BF44]"/> : <ArrowDown className="w-3 h-3 text-[#71BF44]"/>) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100"/>}
                        </button>
                     </th>
                     <th className="px-6 py-6 min-w-[350px]">
                        <div className="space-y-4">
                           <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Información de Reproceso</span>
                           <div className="grid grid-cols-2 gap-2">
                              <input placeholder="Motivo/Detalle..." value={filters.co_detalle} onChange={(e) => setFilters(f => ({ ...f, co_detalle: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] outline-none" />
                              <input placeholder="Estado..." value={filters.DescripcionEstatus} onChange={(e) => setFilters(f => ({ ...f, DescripcionEstatus: e.target.value }))} className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] outline-none" />
                           </div>
                        </div>
                     </th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/10">
                  {!selectedAmbiente ? (
                    <tr><td colSpan={5} className="py-24 text-center">
                       <div className="flex flex-col items-center gap-4 animate-pulse">
                          <Globe className="w-12 h-12 text-[#71BF44]" />
                          <div className="text-[#71BF44] font-black uppercase tracking-[0.2em]">Seleccione un Ambiente para cargar los datos</div>
                       </div>
                    </td></tr>
                  ) : !anyFilterActive ? (
                    <tr><td colSpan={5} className="py-24 text-center">
                       <div className="flex flex-col items-center gap-4 animate-pulse">
                          <Filter className="w-12 h-12 text-neutral-700" />
                          <div className="text-neutral-500 font-black uppercase tracking-[0.2em]">Seleccione un País o aplique un filtro para visualizar datos</div>
                       </div>
                    </td></tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr><td colSpan={5} className="py-24 text-center text-neutral-400 font-black uppercase tracking-[0.5em] opacity-20 text-3xl">Sin Registros</td></tr>
                  ) : (
                    paginatedItems.map((item: any, i: number) => {
                      if ('type' in item && item.type === 'header') {
                        const isExp = expandedGroups.has(item.path);
                        return (
                          <tr key={`h-${item.path}`} className="bg-neutral-800 dark:bg-black/90 z-20 transition-all hover:bg-neutral-700 border-l-4 border-l-[#71BF44]">
                             <td colSpan={5} className="px-4 sm:px-6 py-4 cursor-pointer" style={{ paddingLeft: `${item.depth * 1.5 + 1}rem` }} onClick={() => toggleGroup(item.path)}>
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                   <div className="flex items-center gap-3">
                                      <div className={`p-1.5 rounded-lg shrink-0 ${isExp ? 'bg-[#71BF44] text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                                         {isExp ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                      </div>
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                        <span className="text-xs font-black text-white uppercase tracking-[0.1em] break-words line-clamp-2 sm:line-clamp-none">{item.label}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] sm:text-xs font-bold text-[#71BF44] whitespace-nowrap">({item.count} eventos)</span>
                                          {item.isFullyMapped ? (
                                            <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-tighter border border-green-500/30">Mapeado</span>
                                          ) : item.isPartiallyMapped ? (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-tighter border border-amber-500/30">Parcial</span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-tighter border border-red-500/30">Sin Regla</span>
                                          )}
                                        </div>
                                      </div>
                                   </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:mr-4">
                                        {item.vouchers.length > 0 && (
                                          <button
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                const ids = item.vouchers.map((v: any) => v.Column1 || v.co_id_comprobante).join('\n');
                                                handleMassReprocess(selectedAmbiente, ids);
                                             }}
                                             className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border bg-white/5 text-neutral-400 border-white/10 hover:bg-[#71BF44] hover:text-white hover:border-[#71BF44] shadow-lg shadow-black/20"
                                             title="Reprocesar todos los comprobantes de este subgrupo"
                                          >
                                             <RefreshCw className="w-3 h-3" />
                                             <span>Reproceso Masivo</span>
                                          </button>
                                        )}
                                        {item.vouchers.length > 0 && (
                                          <button
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                handleCreateCase(item.vouchers);
                                             }}
                                             className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white shadow-lg shadow-black/20"
                                             title="Crear caso en mesa de ayuda para este grupo"
                                          >
                                             <LifeBuoy className="w-3 h-3" />
                                             <span>Crear Caso</span>
                                          </button>
                                        )}
                                        {item.vouchers.length > 0 && (
                                          <button
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                const ids = item.vouchers.map((v: any) => v.Column1 || v.co_id_comprobante).join('\n');
                                                navigator.clipboard.writeText(ids);
                                                setGroupCopied(item.path);
                                                showNotification('IDs de grupo copiados', 'success');
                                                setTimeout(() => setGroupCopied(null), 2000);
                                             }}
                                             className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${groupCopied === item.path ? 'bg-green-600 text-white border-green-500' : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-[#71BF44] hover:text-white hover:border-[#71BF44] shadow-lg shadow-black/20'}`}
                                             title="Copiar IDs de este subgrupo"
                                          >
                                             {groupCopied === item.path ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                             <span>{groupCopied === item.path ? 'Copiado!' : 'Exportar IDs'}</span>
                                          </button>
                                        )}
                                         <div className="flex items-center gap-2 ml-auto lg:ml-0">
                                           <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{isExp ? 'OCULTAR' : 'VER'}</span>
                                           {isExp ? <ChevronUp className="w-3 h-3 text-neutral-500"/> : <ChevronDown className="w-3 h-3 text-neutral-500"/>}
                                         </div>
                                      </div>
                                 </div>
                             </td>
                          </tr>
                        );
                      }
                      
                      const v = item as Voucher;
                      const ID = v.Column1 || (v as any).co_id_comprobante;
                      const isGrouped = groupBy.length > 0;
                      return (
                        <tr key={ID} className={`group transition-all ${isGrouped ? 'bg-[#71BF44]/[0.02] hover:bg-[#71BF44]/10' : 'hover:bg-[#71BF44]/5'}`}>
                           <td className={`px-6 py-6 transition-all ${isGrouped ? 'pl-10' : 'group-hover:pl-8'}`}>
                              <div className="flex flex-col">
                                 <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const url = `${AMBIENTE_DOMAINS[selectedAmbiente] || 'https://www5.mysatcomla.com'}/Facturacion/Comprobantes/DetalleReporte?idComprobante=${ID}`;
                                    navigator.clipboard.writeText(url);
                                    showNotification('Enlace del comprobante copiado', 'success');
                                  }}
                                  className="text-[10px] font-black text-[#71BF44] hover:underline mb-1 flex items-center gap-1 group/link cursor-pointer text-left"
                                 >
                                    <Hash className="w-3 h-3" /> {ID}
                                    <Copy className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                 </button>
                                 <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-neutral-900 dark:text-white">{v.co_num_comprobante}</span>
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                                       {v.DescripcionTipoDocumento}
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2 mt-2">
                                    <Calendar className="w-3 h-3 text-neutral-500" />
                                    <span className="text-[10px] font-bold text-neutral-400">{v.co_fecha_emision ? formatDate(v.co_fecha_emision) : 'S/F'}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2 text-xs font-black text-neutral-800 dark:text-neutral-300">
                                    <Building2 className="w-3.5 h-3.5 text-neutral-600" /> {v.co_establecimiento}
                                 </div>
                                 <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                                    <MapPin className="w-3.5 h-3.5 text-neutral-600" /> {v.co_punto_emision}
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="space-y-2">
                                 <div className="text-[11px] font-black text-neutral-900 dark:text-white tracking-widest">{v.co_nemonico}</div>
                                 <div className="flex flex-wrap gap-2">
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 border border-blue-600/20">{v.ambiente}</span>
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-600/10 text-amber-600 border border-amber-600/20">{PAIS_MAP[v.co_pais] || v.co_pais}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="flex flex-col font-mono">
                                 <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200">{v.co_hora_in ? formatDate(v.co_hora_in) : '--'}</span>
                                 <span className="text-[10px] text-neutral-500">{v.co_hora_in ? new Date(v.co_hora_in).toLocaleTimeString('es-EC') : '--'}</span>
                              </div>
                           </td>
                           <td className="px-6 py-6">
                              <div className="space-y-4">
                                 <div className="flex items-start gap-4">
                                    {v.DescripcionEstatus && (
                                       <div className="flex flex-col gap-1">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${v.DescripcionEstatus.toLowerCase().includes('rechazado') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                             {v.DescripcionEstatus}
                                          </span>
                                          {isVoucherMapped(v) ? (
                                            <div className="flex items-center gap-1 px-1 text-[8px] font-bold text-green-500/60 uppercase">
                                              <Check className="w-2.5 h-2.5" /> Regla Activa
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 px-1 text-[8px] font-bold text-red-500/60 uppercase">
                                              <AlertCircle className="w-2.5 h-2.5" /> Sin Regla
                                            </div>
                                          )}
                                       </div>
                                    )}
                                    <p className="text-[10px] font-medium text-neutral-500 leading-normal line-clamp-2 italic" title={v.co_detalle}>
                                       {v.co_detalle || 'Sin detalle técnico reportado.'}
                                    </p>
                                 </div>
                                 <div className="grid grid-cols-2 gap-6 p-3 bg-neutral-50 dark:bg-black/50 rounded-xl border border-neutral-100 dark:border-neutral-900">
                                    <div className="flex flex-col gap-0.5">
                                       <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Intenciones</span>
                                       <div className="flex items-center gap-2">
                                          <div className={`text-xs font-black ${Number(v.co_numero_reprocesos) > 0 ? 'text-[#71BF44]' : 'text-neutral-600'}`}>
                                             {v.co_numero_reprocesos ?? 0}
                                          </div>
                                          {(v.co_numero_reprocesos || 0) > 3 && <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />}
                                       </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                       <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Última Gestión</span>
                                       <span className="text-[10px] font-mono font-bold text-neutral-400">
                                          {formatDate(v.co_hora_reproceso, true)}
                                       </span>
                                    </div>
                                 </div>
                              </div>
                           </td>
                        </tr>
                      );
                    })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Case Creation Modal */}
      {showCaseModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#0c0c0c] border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                       <LifeBuoy className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight">Crear Caso Mesa de Ayuda</h3>
                       <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Portal de Autogestión de Incidencias</p>
                    </div>
                 </div>
                 <button onClick={() => setShowCaseModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-neutral-400" />
                 </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">

              <div className="flex border-b border-neutral-100 dark:border-neutral-800">
                 <button 
                   onClick={() => setModalTab('caso')} 
                   className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${modalTab === 'caso' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/50'}`}
                 >
                    Crear Caso (Mesa de Ayuda)
                 </button>
                 <button 
                   onClick={() => setModalTab('regla')} 
                   className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${modalTab === 'regla' ? 'border-[#71BF44] text-[#71BF44] bg-[#71BF44]/5' : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/50'}`}
                 >
                    Crear Regla (Monitoreo Auto)
                 </button>
              </div>

              {modalTab === 'caso' ? (
                 <div className="p-8 space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Asunto del Caso</label>
                       <input 
                         type="text" 
                         value={caseSubject} 
                         onChange={(e) => setCaseSubject(e.target.value)}
                         className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Departamento</label>
                          <select 
                            value={caseDept}
                            onChange={(e) => setCaseDept(e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="816030000000006907">Soporte</option>
                            <option value="816030000001906033">Soporte Interno</option>
                            <option value="816030000001304039">Tecnología</option>
                          </select>
                       </div>
                       {caseDept === '816030000001304039' && (
                         <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Área Destino</label>
                            <select 
                              value={caseArea}
                              onChange={(e) => setCaseArea(e.target.value)}
                              className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all appearance-none cursor-pointer"
                            >
                              <option value="Infraestructura">Infraestructura</option>
                              <option value="Desarrollo">Desarrollo</option>
                            </select>
                         </div>
                       )}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Prioridad</label>
                       <div className="flex gap-2">
                          {['Baja', 'Media', 'Alta', 'Crítica/Urgente'].map(p => (
                            <button 
                              key={p}
                              onClick={() => setCasePriority(p)}
                              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${casePriority === p ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-400 border-neutral-100 dark:border-neutral-800 hover:border-amber-500/30'}`}
                            >
                               {p}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Afectación</label>
                       <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tighter">{caseTargetVouchers.length}</span>
                          <span className="text-[9px] font-bold text-neutral-400 uppercase ml-2">Documentos</span>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Descripción / Cuerpo del Mensaje</label>
                          <button 
                            type="button"
                            onClick={() => setIsPreview(!isPreview)}
                            className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20"
                          >
                             {isPreview ? 'Editar Código HTML' : 'Ver Resultado HTML'}
                          </button>
                       </div>
                       
                       {isPreview ? (
                         <div 
                           className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 min-h-[250px] max-h-[400px] overflow-y-auto text-sm custom-scrollbar shadow-inner"
                           dangerouslySetInnerHTML={{ __html: caseDescription }}
                         />
                       ) : (
                         <textarea 
                           rows={12}
                           value={caseDescription}
                           onChange={(e) => setCaseDescription(e.target.value)}
                           className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-[10px] font-mono focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none custom-scrollbar"
                         />
                       )}
                    </div>
                 </div>
              ) : (
                 <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-4 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-xl mb-4">
                       <h4 className="text-sm font-bold text-[#71BF44] flex items-center gap-2 mb-1"><Activity className="w-4 h-4" /> Configuración de Alerta</h4>
                       <p className="text-xs text-neutral-500 dark:text-neutral-400">Esta regla monitoreará los eventos de la plataforma y creará un caso automáticamente en ZohoDesk usando estos parámetros cuando se cumplan las condiciones.</p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Nombre de la Regla</label>
                       <input 
                         type="text" 
                         value={ruleName} 
                         onChange={e => setRuleName(e.target.value)} 
                         className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all" 
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Expresión de Estado</label>
                          <input 
                            type="text" 
                            value={ruleMainStatus} 
                            onChange={e => setRuleMainStatus(e.target.value)} 
                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all" 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Expresión de Motivo</label>
                          <input 
                            type="text" 
                            value={ruleMainReason} 
                            onChange={e => setRuleMainReason(e.target.value)} 
                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all" 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Modo de Conteo</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl h-12">
                             {[
                               { id: 'GLOBAL', label: 'Global' },
                               { id: 'POR_EMISOR', label: 'Por Emisor' }
                             ].map(opt => (
                                <button
                                   key={opt.id}
                                   onClick={() => setRuleCountMode(opt.id)}
                                   className={`flex-1 py-1 px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${ruleCountMode === opt.id ? 'bg-white dark:bg-black text-[#71BF44] shadow-sm ring-1 ring-[#71BF44]/20' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                   {opt.label}
                                </button>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Tipo de Conteo</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl h-12">
                             {[
                               { id: 'NUMERO', label: 'Número' },
                               { id: 'PORCENTAJE', label: 'Porcentaje (%)' }
                             ].map(opt => (
                                <button
                                   key={opt.id}
                                   onClick={() => setRuleCountType(opt.id)}
                                   className={`flex-1 py-1 px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${ruleCountType === opt.id ? 'bg-white dark:bg-black text-[#71BF44] shadow-sm ring-1 ring-[#71BF44]/20' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                   {opt.label}
                                </button>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Límite ({ruleCountType === 'PORCENTAJE' ? '%' : 'Q'})</label>
                          <input 
                            type="number" 
                            value={ruleMinEvents} 
                            onChange={e => setRuleMinEvents(Number(e.target.value))} 
                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 h-12 text-sm font-bold focus:ring-2 focus:ring-[#71BF44]/20 outline-none transition-all" 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Frecuencia</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl h-12">
                             {[
                               { id: 'HORARIO', label: 'Hora' },
                               { id: 'DIARIO', label: 'Día' },
                               { id: 'SEMANAL', label: 'Sem' },
                               { id: 'MENSUAL', label: 'Mes' }
                             ].map(opt => (
                                <button
                                   key={opt.id}
                                   onClick={() => setRuleFrequency(opt.id)}
                                   className={`flex-1 py-1 px-1 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${ruleFrequency === opt.id ? 'bg-white dark:bg-black text-[#71BF44] shadow-sm ring-1 ring-[#71BF44]/20' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                   {opt.label}
                                </button>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Alcance de Notificación</label>
                          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl h-12">
                             {[
                               { id: 'TODOS', label: 'Notificar Todos los Eventos Involucrados' },
                               { id: 'SOLO_SUPERAN_LIMITE', label: 'Notificar Solo los que Superan el Límite' }
                             ].map(opt => (
                                <button
                                   key={opt.id}
                                   onClick={() => setRuleNotifyType(opt.id)}
                                   className={`flex-1 py-1 px-4 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${ruleNotifyType === opt.id ? 'bg-white dark:bg-black text-amber-500 shadow-sm ring-1 ring-amber-500/20' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                                >
                                   {opt.label}
                                </button>
                             ))}
                          </div>
                       </div>
                     </div>
                  </div>
              )}
              </div>

              <div className="p-8 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
                 <button onClick={() => setShowCaseModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600 transition-colors">
                    Cancelar
                 </button>
                 {modalTab === 'caso' ? (
                   <button 
                     onClick={submitCase}
                     disabled={isSubmittingCase || !caseSubject || !caseDescription}
                     className="flex-[2] bg-amber-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                   >
                      {isSubmittingCase ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LifeBuoy className="w-4 h-4" />}
                      {isSubmittingCase ? 'Procesando...' : 'Confirmar y Crear Caso'}
                   </button>
                 ) : (
                   <button 
                     onClick={submitRule}
                     disabled={isSubmittingRule || !ruleName}
                     className="flex-[2] bg-[#71BF44] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#71BF44]/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                   >
                      {isSubmittingRule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                      {isSubmittingRule ? 'Guardando...' : 'Guardar Regla de Monitoreo'}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
