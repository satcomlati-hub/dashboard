'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X, User } from 'lucide-react';

export default function PdfUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [user, setUser] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      setErrorMessage('Solo se permiten archivos PDF.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setStatus('idle');
      setErrorMessage('');
    } else if (selected) {
      setErrorMessage('Solo se permiten archivos PDF.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('data', file, file.name);
      formData.append('user', user || 'dashboard');

      const res = await fetch('https://sara.mysatcomla.com/webhook/ingesta-documentos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Error en la solicitud: ${res.statusText}`);
      }

      setStatus('success');
      setFile(null);
      setUser('');
      if (inputRef.current) inputRef.current.value = '';

      setTimeout(() => {
        setStatus('idle');
      }, 4000);
    } catch (error: any) {
      console.error('Error subiendo PDF:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Error desconocido al subir el archivo');
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#71BF44]" />
          Subir Documento PDF
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Sube un archivo PDF para procesarlo e ingestarlo en la base vectorial.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
            ${dragActive
              ? 'border-[#71BF44] bg-[#71BF44]/10'
              : file
                ? 'border-[#71BF44]/40 bg-[#71BF44]/5'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-[#71BF44]/50 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(); }}
                className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          ) : (
            <div className="py-4">
              <div className="w-12 h-12 rounded-full bg-[#71BF44]/10 flex items-center justify-center mx-auto mb-3">
                <Upload className={`w-6 h-6 ${dragActive ? 'text-[#71BF44]' : 'text-neutral-400'} transition-colors`} />
              </div>
              <p className="text-sm font-medium dark:text-neutral-300 mb-1">
                {dragActive ? 'Suelta el archivo aquí' : 'Arrastra un PDF o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-neutral-500">Solo archivos .pdf</p>
            </div>
          )}
        </div>

        {/* User field */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-neutral-400" />
            Usuario (opcional)
          </label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="tu.nombre@satcomla.com"
            className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all"
          />
        </div>

        {/* Status messages & submit */}
        <div className="pt-2">
          {status === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mb-4 p-3 bg-[#71BF44]/10 border border-[#71BF44]/20 rounded-lg flex items-center gap-3 text-[#71BF44] text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <p>El PDF se ha enviado correctamente a SARA para procesamiento.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !file}
            className="w-full bg-[#71BF44] hover:bg-[#60A339] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(113,191,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Subiendo a SARA...
              </>
            ) : (
              <>
                Subir PDF
                <Upload className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
