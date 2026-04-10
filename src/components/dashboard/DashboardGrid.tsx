'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { WidgetLayoutItem, WIDGET_REGISTRY, getWidgetById } from '@/lib/widgets';
import WidgetWrapper from './WidgetWrapper';
import WidgetPicker from './WidgetPicker';

// Lazy-load widgets
const TopCards = dynamic(() => import('@/components/TopCards'));
const ActiveTools = dynamic(() => import('@/components/ActiveTools'));
const MonitoreoWidget = dynamic(() => import('@/components/MonitoreoWidget'));
const QuickLinks = dynamic(() => import('./QuickLinks'));

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  'top-cards': TopCards,
  'active-tools': ActiveTools,
  'monitoreo-widget': MonitoreoWidget as React.ComponentType,
  'quick-links': QuickLinks,
};

// Widget placeholder para "Uso en el Tiempo"
function UsagePlaceholder() {
  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
        <svg width="24" height="24" className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Uso en el Tiempo</h3>
      <p className="text-xs text-neutral-500 dark:text-[#ababab] max-w-[200px]">El gráfico de ejecuciones se conectará próximamente con la API de métricas históricas.</p>
    </div>
  );
}

WIDGET_COMPONENTS['usage-placeholder'] = UsagePlaceholder;

const SIZE_CLASSES: Record<string, string> = {
  'full': 'lg:col-span-3',
  'col-span-2': 'lg:col-span-2',
  'half': 'lg:col-span-2',
  'third': 'lg:col-span-1',
};

interface DashboardGridProps {
  initialLayout: WidgetLayoutItem[];
  permissions?: string[];
}

export default function DashboardGrid({ initialLayout, permissions }: DashboardGridProps) {
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(initialLayout);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const sorted = [...layout].sort((a, b) => a.order - b.order);

  const availableToAdd = WIDGET_REGISTRY.filter(
    w => !layout.some(l => l.widgetId === w.id)
  );

  const handleRemove = useCallback((widgetId: string) => {
    setLayout(prev => prev.filter(l => l.widgetId !== widgetId).map((l, i) => ({ ...l, order: i })));
  }, []);

  const handleMoveUp = useCallback((widgetId: string) => {
    setLayout(prev => {
      const items = [...prev].sort((a, b) => a.order - b.order);
      const idx = items.findIndex(l => l.widgetId === widgetId);
      if (idx <= 0) return prev;
      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
      return items.map((l, i) => ({ ...l, order: i }));
    });
  }, []);

  const handleMoveDown = useCallback((widgetId: string) => {
    setLayout(prev => {
      const items = [...prev].sort((a, b) => a.order - b.order);
      const idx = items.findIndex(l => l.widgetId === widgetId);
      if (idx < 0 || idx >= items.length - 1) return prev;
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
      return items.map((l, i) => ({ ...l, order: i }));
    });
  }, []);

  const handleAdd = useCallback((widgetId: string) => {
    const def = getWidgetById(widgetId);
    if (!def) return;
    setLayout(prev => [
      ...prev,
      { widgetId, order: prev.length, size: def.defaultSize },
    ]);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/dashboard/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      setEditing(false);
    } catch (err) {
      console.error('Error guardando layout:', err);
    } finally {
      setSaving(false);
    }
  }, [layout]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          {editing ? 'Editando Dashboard' : ''}
        </h3>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setLayout(initialLayout); setEditing(false); }}
                className="text-xs px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-md bg-[#71BF44] text-white hover:bg-[#5ea836] transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Personalizar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {sorted.map((item) => {
          const Component = WIDGET_COMPONENTS[item.widgetId];
          if (!Component) return null;

          return (
            <div key={item.widgetId} className={SIZE_CLASSES[item.size] || ''}>
              {editing ? (
                <WidgetWrapper
                  widgetId={item.widgetId}
                  name={getWidgetById(item.widgetId)?.name ?? item.widgetId}
                  onRemove={handleRemove}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                >
                  <Component />
                </WidgetWrapper>
              ) : (
                <Component />
              )}
            </div>
          );
        })}
      </div>

      {editing && availableToAdd.length > 0 && (
        <WidgetPicker widgets={availableToAdd} onAdd={handleAdd} />
      )}
    </div>
  );
}
