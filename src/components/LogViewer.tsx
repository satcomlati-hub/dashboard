'use client';
import React, { useState, useEffect, useRef } from 'react';

interface Log {
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  metadata?: any;
}

export default function LogViewer({ workflowId }: { workflowId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    if (isPaused) return;
    try {
      const res = await fetch(`/api/logs/${workflowId}`);
      const data = await res.json();
      if (data.logs) {
         setLogs(data.logs);
      }
    } catch (error) {
       console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Polling cada 5s
    return () => clearInterval(interval);
  }, [workflowId, isPaused]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = async () => {
    await fetch(`/api/logs/${workflowId}`, { method: 'DELETE' });
    setLogs([]);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-[#71BF44]';
      default: return 'text-neutral-300';
    }
  };

  return (
    <div className="mt-8 bg-[#0D0D0D] border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="bg-[#1A1A1A] border-b border-neutral-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className="flex gap-1.5 mr-2">
              <div className="w-3 h-3 rounded-full bg-red-500/30"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/30"></div>
              <div className="w-3 h-3 rounded-full bg-[#71BF44]/30"></div>
           </div>
           <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">SARA Log System</span>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setIsPaused(!isPaused)} 
             className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isPaused ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : 'border-neutral-700 text-neutral-500 hover:text-[#71BF44] hover:border-[#71BF44]/50'}`}
           >
             {isPaused ? 'REANUDAR' : 'PAUSAR'}
           </button>
           <button 
             onClick={clearLogs} 
             className="text-[10px] font-bold px-2 py-0.5 rounded border border-neutral-700 text-neutral-500 hover:text-red-400 hover:border-red-400/50"
           >
             LIMPIAR
           </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="p-6 h-[400px] overflow-y-auto font-mono text-[13px] leading-relaxed scroll-smooth bg-black/40"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
             <span className="animate-pulse">Esperando logs...</span>
             <p className="text-[10px] max-w-[200px] text-center opacity-50">Confirma que el nodo Redis Push esté enviando logs a logs:rag:{workflowId}</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-2 group flex gap-3 hover:bg-white/[0.03] p-1 rounded transition-colors">
              <span className="text-neutral-600 shrink-0 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className={`shrink-0 font-bold ${getLevelColor(log.level)} select-none w-12`}>{log.level.toUpperCase()}</span>
              <span className="text-white break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
