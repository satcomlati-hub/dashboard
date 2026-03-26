'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Evento {
  fecha_ecuador: string;
  key: string;
  num_eventos: number | string;
  pais: string;
  detalle_evento: string;
}

interface MonitoreoChartProps {
  data: Evento[];
  onPointClick?: (date: string) => void;
  selectedDate?: string | null;
}

/* Custom tooltip ensures data is accessed correctly via the payload */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null;
  
  // Directly access the underlying data point
  const d = payload[0].payload;
  
  return (
    <div className="bg-[#1a1a1a] border border-neutral-700/50 rounded-2xl px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white text-xs leading-relaxed min-w-[280px] backdrop-blur-xl animate-in fade-in zoom-in duration-200">
      <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
        <div className="w-2 h-2 rounded-full bg-[#71BF44] animate-pulse" />
        <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">{d.date}</p>
      </div>
      
      <div className="space-y-2.5">
        <div className="flex justify-between items-center group">
          <span className="text-neutral-400 font-medium">Eventos</span>
          <span className="text-[#71BF44] text-2xl font-black">{d.eventos.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 rounded-lg px-2 py-1.5">
          <span className="text-neutral-400">Identificador</span>
          <span className="text-white font-bold truncate max-w-[150px]" title={d.key}>{d.key}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-neutral-400">Origen</span>
          <span className="text-white font-medium bg-[#71BF44]/20 px-2 rounded-full text-[10px]">{d.pais}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-[#71BF44] font-bold text-[10px] opacity-80">
        <Activity className="w-3 h-3" />
        CLIC PARA FILTRAR TABLA
      </div>
    </div>
  );
}

// Simple Activity icon for tooltip
const Activity = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function MonitoreoChart({ data, onPointClick, selectedDate }: MonitoreoChartProps) {
  const chartData = [...data].reverse().map(item => {
    const d = new Date(item.fecha_ecuador);
    let timeLabel = '';
    
    if (!isNaN(d.getTime())) {
      // Format as HH:mm
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      timeLabel = `${hours}:${minutes}`;
    } else {
      // Fallback for DD-MM-YYYY HH:mm:ss
      timeLabel = item.fecha_ecuador.split(' ')[1]?.substring(0, 5) || item.fecha_ecuador;
    }

    return {
      timeLabel,
      date: item.fecha_ecuador, // Full unique key
      eventos: Number(item.num_eventos) || 0,
      pais: item.pais,
      key: item.key,
    };
  });

  const handleBarClick = (barData: any) => {
    if (onPointClick && barData && barData.date) {
      onPointClick(barData.date);
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl p-4 lg:p-8 mb-8 h-[350px] lg:h-[450px] relative group overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#71BF44]/5 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-50" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 lg:mb-8 gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">Actividad Técnica</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Volumen de eventos por punto de control.</p>
          </div>
          {selectedDate && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">Enfoque:</span>
              <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-blue-600/20">
                {selectedDate}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-h-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-neutral-400 text-sm italic">Sin datos para mostrar en este rango</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                barCategoryGap={1}
              >
                <defs>
                  <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#71BF44" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#71BF44" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="barGSelected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E5E5E5" opacity={0.2} />
                <XAxis 
                  dataKey="date" // UNIQUE KEY
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#999', fontSize: 10, fontWeight: 500 }}
                  interval={Math.max(Math.floor(chartData.length / 10), 0)}
                  // Format label to show only time
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      const h = String(d.getHours()).padStart(2, '0');
                      const m = String(d.getMinutes()).padStart(2, '0');
                      return `${h}:${m}`;
                    }
                    return val.split(' ')[1]?.substring(0, 5) || val;
                  }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#999', fontSize: 10, fontWeight: 500 }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: '#71BF44', fillOpacity: 0.05, radius: 10 }}
                  // Coordinate sync fix
                  isAnimationActive={false}
                />
                <Bar 
                  dataKey="eventos" 
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  animationDuration={1000}
                  onClick={(data: any) => handleBarClick(data)}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.date === selectedDate ? 'url(#barGSelected)' : 'url(#barG)'}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
