'use client';
import { useState, useEffect } from 'react';
import SatcomSystemDiagram from './SatcomSystemDiagram';
import { Network, Database, Bot, Search, Loader2, ChevronRight } from 'lucide-react';

export default function SystemsTab() {
  const [localFiles, setLocalFiles] = useState<{name: string, fileName: string}[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // List available local files
    fetch('/api/workflows/local')
      .then(res => res.json())
      .then(data => {
        if (data.files) {
          setLocalFiles(data.files);
          // Auto-select first file if available and no file selected
          if (data.files.length > 0 && !selectedFile) {
            setSelectedFile(data.files[0].fileName);
          }
        }
      });
  }, []);

  useEffect(() => {
    if (selectedFile) {
      setLoading(true);
      fetch(`/api/workflows/local?file=${selectedFile}`)
        .then(res => res.json())
        .then(data => {
          setWorkflowData(data);
          setLoading(false);
        });
    }
  }, [selectedFile]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Cards de información arriba */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold dark:text-white flex items-center gap-2 mb-4">
            <Network size={16} className="text-[#71BF44]" />
            Sistemas Disponibles
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <SystemCard 
              title="Chatbot Satcom" 
              status="Producción" 
              active 
              icon={<Bot size={18}/>}
            />
            <SystemCard 
              title="RAG Pipeline" 
              status="Desarrollo" 
              icon={<Database size={18}/>}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#71BF44]/5 to-transparent border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold dark:text-white mb-2 flex items-center gap-2">
            <Database size={16} className="text-blue-500" />
            Información de Conectividad
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
            Diagrama dinámico de los flujos de n8n. Mostrando procesos orquestados por el núcleo Satcom.
          </p>
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
             <div className="flex flex-col">
               <span className="text-[10px] text-neutral-400 font-mono uppercase">Directorio</span>
               <span className="text-xs font-bold dark:text-white">Produccion_Satcom</span>
             </div>
             <div className="flex flex-col text-right">
               <span className="text-[10px] text-neutral-400 font-mono uppercase">Total Flujos</span>
               <span className="text-xs font-bold dark:text-white">{localFiles.length}</span>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold dark:text-white mb-4 flex items-center gap-2">
            <Search size={16} className="text-[#71BF44]" />
            Selector de Flujo
          </h3>
          <div className="relative group">
            <select 
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 appearance-none dark:text-white cursor-pointer"
            >
              {localFiles.map(file => (
                <option key={file.fileName} value={file.fileName}>
                  {file.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <ChevronRight size={16} className="rotate-90" />
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 mt-3 italic">
            Visualiza la arquitectura lógica de cada componente de forma independiente.
          </p>
        </div>
      </div>

      {/* Diagrama abajo ocupando todo el ancho */}
      <div className="relative group">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-[#71BF44]" size={32} />
              <span className="text-sm font-bold dark:text-white">Cargando arquitectura...</span>
            </div>
          </div>
        )}
        <SatcomSystemDiagram data={workflowData} />
      </div>
    </div>
  );
}

function SystemCard({ title, status, active, icon }: { title: string, status: string, active?: boolean, icon: React.ReactNode }) {
  return (
    <div className={`
      p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between
      ${active 
        ? 'border-[#71BF44] bg-[#71BF44]/5 shadow-[0_4px_12px_rgba(113,191,68,0.1)]' 
        : 'border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700'}
    `}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${active ? 'bg-[#71BF44] text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-medium dark:text-white">{title}</h4>
          <span className="text-[10px] text-neutral-500 font-medium">{status}</span>
        </div>
      </div>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-[#71BF44] animate-pulse" />}
    </div>
  )
}
