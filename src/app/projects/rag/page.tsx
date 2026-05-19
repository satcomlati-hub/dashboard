'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import LogViewer from '@/components/LogViewer';
import IngestTabs from '@/components/IngestTabs';
import RAGCollectionsTable from '@/components/RAGCollectionsTable';
import { Database, UploadCloud, Activity } from 'lucide-react';

export default function RAGProjectPage() {
  const [activeTab, setActiveTab] = useState<'manage' | 'upload'>('manage');
  const [progress, setProgress] = useState(0); // Progress state for the progress bar
  const workflowId = '9SUpGm5FL4xSDkNN'; // ID de MAIN_registra_logs_rag

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/projects" className="text-neutral-500 hover:text-[#71BF44] transition-colors">
              Proyectos 
            </Link>
            <span className="text-neutral-700">/</span>
            <h1 className="text-3xl font-bold dark:text-white">RAG Knowledge Base</h1>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400">
            Monitoreo en tiempo real de la carga de archivos a la base de datos vectorial y procesamiento de embeddings.
          </p>
        </div>
        
        <div className="flex gap-4">
          <Link 
             href={`/workflows/${workflowId}?source=SARA`}
             className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-all"
          >
             Ver Workflow en SARA
          </Link>
        </div>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
         <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 mb-1 uppercase tracking-tight">Estado de Red</h3>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#71BF44] animate-pulse"></div>
               <p className="text-xl font-bold dark:text-white">Redis Activo</p>
            </div>
         </div>
         <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 mb-1 uppercase tracking-tight">Motor de Vectorización</h3>
            <p className="text-xl font-bold dark:text-white">Gemini + Supabase</p>
         </div>
         <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 mb-1 uppercase tracking-tight">Webhook de Logs</h3>
            <p className="text-xl font-bold dark:text-white">Disponible</p>
         </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-8">
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all relative
            ${activeTab === 'manage'
              ? 'text-[#71BF44]'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
        >
          <Database className="w-4 h-4" />
          Gestionar Conocimiento
          {activeTab === 'manage' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71BF44] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all relative
            ${activeTab === 'upload'
              ? 'text-[#71BF44]'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
        >
          <UploadCloud className="w-4 h-4" />
          Carga de Documentos
          {activeTab === 'upload' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71BF44] rounded-t-full" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'manage' && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <RAGCollectionsTable />
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Barra de Progreso */}
          <div className="mb-8 bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#71BF44]" />
                Progreso de Procesamiento
              </h3>
              <span className="text-xs font-semibold text-[#71BF44]">{progress}%</span>
            </div>
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-[#71BF44] h-2.5 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                {/* Indicador de animación si está en progreso */}
                {progress > 0 && progress < 100 && (
                  <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-pulse" />
                )}
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {progress === 0 ? 'Esperando inicio de carga...' : progress < 100 ? 'Procesando e ingiriendo documentos...' : 'Procesamiento completado.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <IngestTabs />
              
              <div className="p-5 rounded-xl bg-[#71BF44]/5 border border-[#71BF44]/10">
                <h3 className="text-sm font-bold text-[#71BF44] mb-2 uppercase tracking-tight">Instrucciones</h3>
                <ol className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed space-y-1.5 list-decimal list-inside">
                  <li>Usa la pestaña <strong>Zoho Learn</strong> para links o <strong>Subir PDF</strong> para archivos.</li>
                  <li>SARA procesará, dividirá en chunks y calculará embeddings automáticamente.</li>
                  <li>Los eventos aparecerán en el visor de logs en tiempo real.</li>
                </ol>
              </div>
            </div>

            <div className="lg:col-span-7 h-[calc(100vh-280px)] min-h-[600px]">
              <LogViewer workflowId={workflowId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

