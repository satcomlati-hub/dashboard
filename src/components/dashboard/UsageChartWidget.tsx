'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendItem {
  day: string;
  tokens: number;
  costUsd: number;
  calls: number;
}

interface UsageData {
  ai?: {
    trend: TrendItem[];
    summary: {
      totalCostUsd: number;
      totalTokens: number;
      totalCalls: number;
    };
  };
}

function fmt$(n: number) {
  if (n === 0) return '$0.00';
  if (n < 0.001) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function UsageChartWidget() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage?range=30d')
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs p-6 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#71BF44]/20 border-t-[#71BF44] rounded-full animate-spin" />
      </div>
    );
  }

  const ai = data?.ai;
  const totalCost = ai?.summary.totalCostUsd ?? 0;
  const totalTokens = ai?.summary.totalTokens ?? 0;
  const totalCalls = ai?.summary.totalCalls ?? 0;
  const trend = ai?.trend ?? [];

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px] relative group overflow-hidden">
      {/* Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#71BF44]/5 rounded-full blur-2xl opacity-75 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-start mb-3 shrink-0 relative z-10">
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
            Consumo e Inversión IA (30d)
          </h3>
          <p className="text-2xl font-bold text-[#71BF44] mt-0.5">{fmt$(totalCost)}</p>
        </div>
        <div className="text-right text-[10px] text-neutral-400 dark:text-neutral-500">
          <p className="font-semibold text-neutral-700 dark:text-neutral-300">{fmtK(totalTokens)} tokens</p>
          <p className="mt-0.5">{totalCalls} peticiones</p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 w-full relative z-10">
        {trend.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg">
            Sin datos de uso de IA registrados en este periodo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#71BF44" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#71BF44" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" opacity={0.1} />
              <XAxis
                dataKey="day"
                tickFormatter={fmtDate}
                tick={{ fill: '#737373', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => fmtK(v)}
                tick={{ fill: '#737373', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as TrendItem;
                  return (
                    <div className="bg-neutral-950 text-white rounded-lg p-2 text-[10px] shadow-lg border border-neutral-800">
                      <p className="font-semibold">{fmtDate(item.day)}</p>
                      <p className="text-[#71BF44] mt-0.5">Costo: {fmt$(item.costUsd)}</p>
                      <p className="text-blue-400">Tokens: {item.tokens.toLocaleString()}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#71BF44"
                strokeWidth={2}
                fill="url(#usageGrad)"
                name="Tokens"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
