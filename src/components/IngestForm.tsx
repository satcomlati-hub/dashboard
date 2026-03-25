'use client';
import React, { useState } from 'react';
import { Send, Link as LinkIcon, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function IngestForm() {
  const [links, setLinks] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const payload = [
        {
          "Links de Zoho Learn": links,
          "Correo del responsable": email,
          "submittedAt": new Date().toISOString(),
          "formMode": "production"
        }
      ];

      const res = await fetch('https://sara.mysatcomla.com/webhook/ingesta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Error en la solicitud: ${res.statusText}`);
      }

      setStatus('success');
      setLinks(''); // limpiar el formulario opcional
      
      // Volver a estado idle despues de 3 segundos
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error enviando ingesta:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Error desconocido');
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-[#71BF44]" />
          Nueva Ingesta de Artículos
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Ingresa los links de Zoho Learn y tu correo para iniciar el proceso en SARA.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-neutral-400" />
            Links de Zoho Learn
          </label>
          <textarea
            required
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="https://learn.zohopublic.com/..., https://learn.zohopublic.com/..."
            className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all h-24 resize-none"
          />
          <p className="text-xs text-neutral-500 mt-1.5 ml-1">Separa los links por comas si son varios artículos.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4 text-neutral-400" />
            Correo del responsable
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu.correo@satcomla.com"
            className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#71BF44]/50 dark:text-white transition-all"
          />
        </div>

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
              <p>La ingesta se ha iniciado correctamente. Puedes ver el progreso en el visor dinámico.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[#71BF44] hover:bg-[#60A339] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(113,191,68,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando a SARA...
              </>
            ) : (
              <>
                Iniciar Ingesta
                <Send className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
