// ============ TIPOS ============

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  defaultSize: 'full' | 'col-span-2' | 'half' | 'third';
  /** Componente lazy – se importa dinámicamente en DashboardGrid */
}

export interface WidgetLayoutItem {
  widgetId: string;
  order: number;
  size: 'full' | 'col-span-2' | 'half' | 'third';
}

// ============ REGISTRY ============

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'top-cards',
    name: 'Métricas Principales',
    description: 'Tarjetas con ejecuciones activas, workflows y métricas clave',
    defaultSize: 'full',
  },
  {
    id: 'active-tools',
    name: 'Workflows Activos',
    description: 'Lista de workflows activos en n8n',
    defaultSize: 'col-span-2',
  },
  {
    id: 'monitoreo-chart',
    name: 'Gráfico Monitoreo',
    description: 'Gráfico de barras de volumen de eventos de monitoreo',
    defaultSize: 'col-span-2',
  },
  {
    id: 'monitoreo-widget',
    name: 'Bitácora Eventos',
    description: 'Tabla de eventos recientes de monitoreo',
    defaultSize: 'full',
  },
  {
    id: 'analytics-links',
    name: 'Analytics',
    description: 'Accesos directos a los paneles de análisis disponibles',
    defaultSize: 'third',
  },
  {
    id: 'quick-links',
    name: 'Accesos Rápidos',
    description: 'Enlaces rápidos a las secciones más utilizadas',
    defaultSize: 'third',
  },
  {
    id: 'sara-chat',
    name: 'Chat con SARA',
    description: 'Interactúa de forma integrada con el asistente de IA SARA',
    defaultSize: 'col-span-2',
  },
  {
    id: 'usage-chart',
    name: 'Uso de IA',
    description: 'Gráfico de tokens consumidos y costos acumulados en los últimos 30 días',
    defaultSize: 'col-span-2',
  },
  {
    id: 'system-health',
    name: 'Salud de la Infraestructura',
    description: 'Uso de base de datos de Supabase y estado de las conexiones n8n',
    defaultSize: 'third',
  },
  {
    id: 'rag-collections',
    name: 'Colecciones RAG',
    description: 'Estado de sincronización y volumen de las colecciones vectoriales del RAG',
    defaultSize: 'col-span-2',
  },
  {
    id: 'monitoreo-rules',
    name: 'Reglas de Monitoreo',
    description: 'Estatus y prioridades de las reglas y alertas técnicas activas',
    defaultSize: 'third',
  },
  {
    id: 'user-profile',
    name: 'Mi Perfil y Permisos',
    description: 'Información de la sesión actual, tu rol y lista de permisos del sistema',
    defaultSize: 'third',
  },
  {
    id: 'quick-actions',
    name: 'Acciones Rápidas',
    description: 'Disparadores de acciones del sistema como test de red y limpieza de caché',
    defaultSize: 'third',
  },
  {
    id: 'workflow-stats',
    name: 'Estadísticas de n8n',
    description: 'Ejecuciones acumuladas y desglose frente a límites mensuales',
    defaultSize: 'third',
  },
  {
    id: 'recent-logs',
    name: 'Bitácora Rápida',
    description: 'Últimos eventos técnicos del sistema de monitoreo en vista compacta',
    defaultSize: 'third',
  },
  {
    id: 'system-resources',
    name: 'Recursos y Límites',
    description: 'Comparativa de RAM asignada, límites de compilación y créditos',
    defaultSize: 'third',
  },
];

// ============ LAYOUT DEFAULT ============

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { widgetId: 'top-cards', order: 0, size: 'full' },
  { widgetId: 'active-tools', order: 1, size: 'col-span-2' },
  { widgetId: 'system-health', order: 2, size: 'third' },
  { widgetId: 'usage-chart', order: 3, size: 'col-span-2' },
  { widgetId: 'quick-links', order: 4, size: 'third' },
];

// ============ HELPERS ============

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.id === id);
}
