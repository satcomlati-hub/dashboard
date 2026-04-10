'use client';

interface WidgetWrapperProps {
  widgetId: string;
  name: string;
  children: React.ReactNode;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

export default function WidgetWrapper({ widgetId, name, children, onRemove, onMoveUp, onMoveDown }: WidgetWrapperProps) {
  return (
    <div className="relative group">
      {/* Barra de controles */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-neutral-900 dark:bg-neutral-700 rounded-full px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[0.625rem] text-neutral-300 px-1 truncate max-w-[120px]">{name}</span>
        <button
          onClick={() => onMoveUp(widgetId)}
          className="p-0.5 text-neutral-400 hover:text-white transition-colors"
          title="Mover arriba"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => onMoveDown(widgetId)}
          className="p-0.5 text-neutral-400 hover:text-white transition-colors"
          title="Mover abajo"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={() => onRemove(widgetId)}
          className="p-0.5 text-red-400 hover:text-red-300 transition-colors"
          title="Quitar widget"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Borde de edición */}
      <div className="ring-2 ring-dashed ring-[#71BF44]/30 rounded-xl">
        {children}
      </div>
    </div>
  );
}
