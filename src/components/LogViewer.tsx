'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Info, Terminal, RefreshCw, XCircle, BrainCircuit, FileText, Database, Sparkles, Search } from 'lucide-react';

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
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [workflowId, isPaused]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Formateador de mensajes para el usuario final
  const formatMessage = (msg: string) => {
    // 1. Limpiar URLs largas por el nombre del artículo si es posible
    if (msg.includes('https://')) {
       const parts = msg.split('/');
       const lastPart = parts[parts.length - 1].split('?')[0];
       msg = msg.replace(/https:\/\/\S+/g, `[${lastPart || 'Documento'}]`);
    }
    // 2. Limpiar nombres de archivos temporales
    msg = msg.replace(/zoho_temp_\w+\.pdf/g, 'Documento PDF');
    // 3. Quitar emojis duplicados si ya los pone el visor
    msg = msg.replace(/^[📖💾✅📊▶️⚙️⏳📈]\s*/, '');
    
    return msg;
  };

  // Determinar el estado actual del "Agente"
  const currentStatus = useMemo(() => {
    if (logs.length === 0) return { label: 'Esperando instrucciones...', icon: <BrainCircuit className="w-5 h-5" />, color: 'text-neutral-400' };
    
    const lastMsg = logs[logs.length - 1].message;
    if (lastMsg.includes('Procesando artículo')) return { label: 'Estudiando nuevos manuales...', icon: <Search className="w-5 h-5 animate-pulse" />, color: 'text-[#71BF44]' };
    if (lastMsg.includes('Descargando')) return { label: 'Recuperando información de Zoho...', icon: <FileText className="w-5 h-5 animate-bounce" />, color: 'text-blue-500' };
    if (lastMsg.includes('Embeddings') || lastMsg.includes('vectores')) return { label: 'Generando conocimientos vectoriales...', icon: <Sparkles className="w-5 h-5 animate-spin" />, color: 'text-purple-500' };
    if (lastMsg.includes('Insertando') || lastMsg.includes('exitosamente')) return { label: 'Guardando en memoria a largo plazo...', icon: <Database className="w-5 h-5" />, color: 'text-[#71BF44]' };
    
    return { label: 'Analizando información...', icon: <BrainCircuit className="w-5 h-5 animate-pulse" />, color: 'text-[#71BF44]' };
  }, [logs]);

  const clearLogs = async () => {
    await fetch(`/api/logs/${workflowId}`, { method: 'DELETE' });
    setLogs([]);
  };

  const getIconForLevel = (level: string, message: string) => {
    if (message.includes('✅')) return <CheckCircle className="w-5 h-5 text-[#71BF44]" />;
    if (message.includes('📊') || message.includes('Procesando artículo')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (message.includes('⚙️') || message.includes('embeddings')) return <Sparkles className="w-5 h-5 text-purple-500" />;
    
    switch (level.toLowerCase()) {
      case 'success': return <CheckCircle className="w-5 h-5 text-[#71BF44]" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 m-1.5" />;
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl flex flex-col h-full ring-1 ring-black/5 dark:ring-white/5">
      {/* Cabecera con el Agente de IA */}
      <div className="bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-200 dark:border-neutral-800 px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-white dark:bg-[#131313] shadow-inner border border-neutral-200 dark:border-neutral-800 ${currentStatus.color}`}>
                {currentStatus.icon}
              </div>
              <div>
                <h3 className="text-base font-bold dark:text-white flex items-center gap-2">
                  SARA Knowledge Agent
                  <span className="px-2 py-0.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] text-[10px] font-bold uppercase tracking-wider">Activo</span>
                </h3>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {currentStatus.label}
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsPaused(!isPaused)} 
                className={`p-2.5 rounded-xl border transition-all ${isPaused ? 'border-yellow-500/30 text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10' : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-[#71BF44] hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
              >
                <RefreshCw className={`w-4 h-4 ${isPaused ? '' : 'animate-[spin_4s_linear_infinite]'}`} />
              </button>
              <button 
                onClick={clearLogs} 
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all border border-transparent"
              >
                Limpiar Historial
              </button>
           </div>
        </div>
      </div>
      
      {/* Timeline de Logs */}
      <div 
        ref={scrollRef}
        className="p-6 h-[500px] overflow-y-auto scroll-smooth flex-1 relative bg-[#FAFAFA] dark:bg-[#0D0D0D]/50"
      >
        {logs.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-neutral-500">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-[#71BF44]/20 blur-2xl rounded-full"></div>
                <div className="relative w-20 h-20 rounded-3xl bg-white dark:bg-[#1A1A1A] flex items-center justify-center border border-neutral-200 dark:border-neutral-800 shadow-xl">
                   <BrainCircuit className="w-10 h-10 text-[#71BF44] opacity-50" />
                </div>
             </div>
             <p className="font-bold text-neutral-800 dark:text-neutral-200 text-lg">Cerebro en reposo</p>
             <p className="text-sm mt-1 max-w-[280px] text-center opacity-60">
                Inicia una ingesta para despertar al agente y procesar nuevos manuales.
             </p>
           </div>
        ) : (
           <div className="space-y-6 relative ml-2">
              {/* Línea lateral del Timeline */}
              <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-neutral-200 dark:bg-neutral-800" />
              
              {logs.map((log, index) => (
                <div key={index} className="flex gap-6 relative group">
                  <div className="relative z-10 flex flex-col items-center py-1">
                    <div className="bg-white dark:bg-[#131313] p-1.5 rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-110 transition-transform">
                      {getIconForLevel(log.level, log.message)}
                    </div>
                  </div>
                  
                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-600 uppercase tracking-widest bg-white dark:bg-[#1A1A1A] px-2 py-0.5 rounded-full border border-neutral-100 dark:border-neutral-800">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                       </span>
                    </div>
                    <div className={`p-4 rounded-2xl border transition-all shadow-sm ${log.level === 'success' ? 'bg-[#71BF44]/5 border-[#71BF44]/20' : 'bg-white dark:bg-[#1A1A1A] border-neutral-100 dark:border-neutral-800'} group-hover:shadow-md group-hover:border-neutral-300 dark:group-hover:border-neutral-600`}>
                       <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed">
                          {formatMessage(log.message)}
                       </p>
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


