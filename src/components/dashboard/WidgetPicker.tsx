'use client';

import type { WidgetDefinition } from '@/lib/widgets';

interface WidgetPickerProps {
  widgets: WidgetDefinition[];
  onAdd: (widgetId: string) => void;
}

export default function WidgetPicker({ widgets, onAdd }: WidgetPickerProps) {
  return (
    <div className="mt-6 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-4">
      <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
        Widgets disponibles
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {widgets.map(w => (
          <button
            key={w.id}
            onClick={() => onAdd(w.id)}
            className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-[#71BF44] hover:bg-[#71BF44]/5 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 group-hover:bg-[#71BF44]/10 transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-neutral-400 group-hover:text-[#71BF44] transition-colors">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{w.name}</p>
              <p className="text-[0.6875rem] text-neutral-500 dark:text-neutral-500">{w.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
