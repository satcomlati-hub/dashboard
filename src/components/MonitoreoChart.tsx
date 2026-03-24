'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

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
}

export default function MonitoreoChart({ data, onPointClick }: MonitoreoChartProps) {
  // We'll prepare data for the chart by mapping the date and count
  // We'll reverse it so it goes chronologically (the query is DESC)
  const chartData = [...data].reverse().map(item => ({
    time: item.fecha_ecuador.split(' ')[1] || item.fecha_ecuador,
    date: item.fecha_ecuador,
    eventos: Number(item.num_eventos) || 0,
    pais: item.pais
  }));

  const handleClick = (point: any) => {
    if (point && point.activePayload && point.activePayload[0] && onPointClick) {
      onPointClick(point.activePayload[0].payload.date);
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 mb-8 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Volumen de Eventos</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Distribución de activaciones. Haz clic en un punto para filtrar la tabla.</p>
        </div>
      </div>
      
      <div className="w-full h-[300px] cursor-pointer">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">Cargando gráfica...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData} 
              onClick={handleClick}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEventos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#71BF44" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#71BF44" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#888', fontSize: 10}}
                // We space out ticks to avoid clutter
                interval={Math.floor(chartData.length / 10)}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#888', fontSize: 10}}
              />
              <Tooltip 
                trigger="hover"
                // Precision: we ensure tooltip is on the nearest data point
                isAnimationActive={false}
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  borderColor: '#333', 
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                }}
                itemStyle={{ color: '#71BF44', fontWeight: 'bold' }}
                cursor={{ stroke: '#71BF44', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={(value: any, name: any, props: any) => [value, 'Eventos']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) return `Fecha: ${payload[0].payload.date}`;
                  return label;
                }}
              />
              <Area 
                type="linear" // Changed from monotone to linear for precision (avoids curve artifacts)
                dataKey="eventos" 
                stroke="#71BF44" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEventos)" 
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#71BF44' }}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
