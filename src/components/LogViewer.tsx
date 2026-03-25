'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Info, Terminal, RefreshCw, XCircle } from 'lucide-react';

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
      if (!res.ok) return;
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

  const getIconForLevel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'success': return <CheckCircle className="w-5 h-5 text-[#71BF44]" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Info className="w-5 h-5 text-[#71BF44]/50" />;
    }
  };

  const getBorderColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'success': return 'border-l-[#71BF44]';
      case 'error': return 'border-l-red-500';
      case 'warning': return 'border-l-yellow-500';
      default: return 'border-l-neutral-300 dark:border-l-neutral-700';
    }
  };

  const getBgColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'success': return 'bg-[#71BF44]/5 dark:bg-[#71BF44]/10';
      case 'error': return 'bg-red-500/5 dark:bg-red-500/10';
      case 'warning': return 'bg-yellow-500/5 dark:bg-yellow-500/10';
      default: return 'bg-neutral-50 dark:bg-neutral-800/20';
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
           <div className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded-lg">
             <Terminal className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
           </div>
           <div>
             <h3 className="text-sm font-bold dark:text-white">Progreso de Ingesta SARA</h3>
             <p className="text-xs tracking-tight text-neutral-500 dark:text-neutral-500 flex items-center gap-1.5 mt-0.5 font-medium">
                {isPaused ? (
                  <span className="text-yellow-500 flex items-center gap-1">Suspendido</span>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#71BF44] opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-[#71BF44]"></span>
                    </span>
                    Monitoreando logs...
                  </>
                )}
             </p>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsPaused(!isPaused)} 
             title={isPaused ? 'Reanudar actualización' : 'Pausar actualización'}
             className={`p-2 rounded-lg border transition-all ${isPaused ? 'border-yellow-500/30 text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
           >
             <RefreshCw className={`w-4 h-4 ${isPaused ? '' : 'animate-[spin_4s_linear_infinite]'}`} />
           </button>
           <button 
             onClick={clearLogs} 
             className="text-xs font-bold px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-red-500 hover:border-red-500/30 hover:bg-white dark:hover:bg-[#1A1A1A] transition-all"
           >
             Limpiar Historial
           </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="p-6 h-[500px] overflow-y-auto scroll-smooth relative"
      >
        {logs.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-neutral-500">
             <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 dark:bg-[#1A1A1A] flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
                <Loader2 className="w-8 h-8 animate-spin opacity-50" />
             </div>
             <p className="font-semibold text-neutral-700 dark:text-neutral-300">En espera de eventos</p>
             <p className="text-sm mt-1 mb-8 max-w-[280px] text-center opacity-70">
                Inicia una ingesta o webhook para ver el estado en tiempo real.
             </p>
           </div>
        ) : (
           <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center justify-start py-1">
                    <div className="bg-white dark:bg-[#131313] p-0.5 rounded-full z-10 shadow-sm border border-neutral-100 dark:border-neutral-800">
                      {getIconForLevel(log.level)}
                    </div>
                    {/* Línea conectora */}
                    {index !== logs.length - 1 && (
                      <div className="w-px h-full bg-neutral-200 dark:bg-neutral-800 mt-1 mb-1" />
                    )}
                  </div>
                  <div className={`flex-1 border-l-4 rounded-r-xl border-t border-b border-r border-t-neutral-100 border-b-neutral-100 border-r-neutral-100 dark:border-t-neutral-800 dark:border-b-neutral-800 dark:border-r-neutral-800 p-4 shadow-sm mb-1 ${getBorderColor(log.level)} ${getBgColor(log.level)}`}>
                     <div className="flex items-start justify-between">
                       <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {log.message}
                       </p>
                       <span className="text-[10px] uppercase font-bold text-neutral-400 mt-1 shrink-0 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-neutral-100 dark:border-neutral-800">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                       </span>
                     </div>
                  </div>
                </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
}

