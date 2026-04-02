'use client';
import React from 'react';
import Link from 'next/link';
import LogViewer from '@/components/LogViewer';
import IngestForm from '@/components/IngestForm';
import PdfUploadForm from '@/components/PdfUploadForm';
import RAGCollectionsTable from '@/components/RAGCollectionsTable';

export default function RAGProjectPage() {
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

      {/* Ingesta + Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <IngestForm />
          <PdfUploadForm />
          
          <div className="p-6 rounded-2xl bg-[#71BF44]/5 border border-[#71BF44]/10">
            <h3 className="text-lg font-bold text-[#71BF44] mb-2">Instrucciones de Ingesta</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
              1. Ingresa enlaces de Zoho Learn <strong>o</strong> sube un archivo PDF directamente.
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
              2. El sistema filtrará duplicados, procesará con PDF extraction u HTML scraper, dividirá en chunks, y calculará los embeddings.
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-0">
              3. Los eventos de cada etapa se emitirán mediante el log-webhook y aparecerán en la ventana derecha en tiempo real.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 h-[calc(100vh-280px)] min-h-[600px]">
          <LogViewer workflowId={workflowId} />
        </div>
      </div>

      {/* Tabla de colecciones en la base de conocimiento */}
      <div className="mb-8">
        <RAGCollectionsTable />
      </div>
    </div>
  );
}
