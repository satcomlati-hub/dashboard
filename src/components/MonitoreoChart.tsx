'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState } from 'react';

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

/* Custom tooltip that renders with full info */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1a1a1a] border border-neutral-700 rounded-xl px-4 py-3 shadow-2xl text-white text-xs leading-relaxed min-w-[200px]">
      <p className="text-neutral-400 mb-1 font-medium">{d.date}</p>
      <div className="flex justify-between items-center">
        <span className="text-neutral-300">Eventos</span>
        <span className="text-[#71BF44] font-bold text-sm">{d.eventos}</span>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-neutral-300">Key</span>
        <span className="text-white font-semibold">{d.key}</span>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-neutral-300">País</span>
        <span className="text-white">{d.pais}</span>
      </div>
      <p className="text-[10px] text-neutral-500 mt-2 border-t border-neutral-700 pt-2">Clic para filtrar en la tabla ↓</p>
    </div>
  );
}

export default function MonitoreoChart({ data, onPointClick, selectedDate }: MonitoreoChartProps) {
  const chartData = [...data].reverse().map(item => ({
    time: item.fecha_ecuador.split(' ')[1]?.substring(0, 5) || item.fecha_ecuador,
    date: item.fecha_ecuador,
    eventos: Number(item.num_eventos) || 0,
    pais: item.pais,
    key: item.key,
    detalle: item.detalle_evento,
  }));

  const handleBarClick = (barData: any) => {
    if (onPointClick && barData && barData.date) {
      onPointClick(barData.date);
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 mb-8 h-[420px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Volumen de Eventos</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Cada barra es un registro exacto. Haz clic en una barra para filtrar la tabla.</p>
        </div>
        {selectedDate && (
          <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg font-semibold border border-blue-200 dark:border-blue-800">
            Seleccionado: {selectedDate}
          </span>
        )}
      </div>
      
      <div className="w-full h-[310px] cursor-pointer">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">Cargando gráfica...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barCategoryGap={0}
              barGap={0}
            >
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#71BF44" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#71BF44" stopOpacity={0.4}/>
                </linearGradient>
                <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.2} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#888', fontSize: 9 }}
                interval={Math.max(Math.floor(chartData.length / 12), 0)}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#888', fontSize: 10 }}
                width={40}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(113, 191, 68, 0.08)' }}
                isAnimationActive={false}
              />
              <Bar 
                dataKey="eventos" 
                radius={[2, 2, 0, 0]}
                onClick={handleBarClick}
                style={{ cursor: 'pointer' }}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.date === selectedDate ? 'url(#barGradActive)' : 'url(#barGrad)'}
                    stroke={entry.date === selectedDate ? '#3b82f6' : 'none'}
                    strokeWidth={entry.date === selectedDate ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
