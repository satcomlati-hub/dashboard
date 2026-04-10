// ============ TIPOS ============

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  defaultSize: 'full' | 'col-span-2' | 'half' | 'third';
  /** Componente lazy — se importa dinámicamente en DashboardGrid */
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
    id: 'monitoreo-widget',
    name: 'Bitácora Eventos',
    description: 'Tabla de eventos recientes de monitoreo',
    defaultSize: 'full',
  },
  {
    id: 'quick-links',
    name: 'Accesos Rápidos',
    description: 'Enlaces rápidos a las secciones más utilizadas',
    defaultSize: 'third',
  },
  {
    id: 'usage-placeholder',
    name: 'Uso en el Tiempo',
    description: 'Gráfico de ejecuciones históricas (próximamente)',
    defaultSize: 'third',
  },
];

// ============ LAYOUT DEFAULT ============
// Replica el dashboard actual exactamente

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { widgetId: 'top-cards', order: 0, size: 'full' },
  { widgetId: 'active-tools', order: 1, size: 'col-span-2' },
  { widgetId: 'usage-placeholder', order: 2, size: 'third' },
];

// ============ HELPERS ============

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.id === id);
}
