'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type ApiKey = {
  id: string; name: string; token_prefix: string;
  revoked: boolean; last_used_at: string | null; expires_at: string | null; created_at: string;
};

export default function KeysPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<any>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetch(`/api/agentes/v1/keys?agent_id=${id}`).then(r => r.json()).then(setKeys);
  };

  useEffect(() => {
    fetch(`/api/agentes/v1/agents/${id}`).then(r => r.json()).then(setAgent);
    load();
  }, [id]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/agentes/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: id, name }),
    });
    const data = await res.json();
    setNewToken(data.token);
    setName('');
    setCreating(false);
    load();
  };

  const revoke = async (keyId: string) => {
    if (!confirm('¿Revocar esta API key? La acción no se puede deshacer.')) return;
    await fetch(`/api/agentes/v1/keys/${keyId}`, { method: 'DELETE' });
    load();
  };

  const copy = () => {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/projects/agentes/${id}`} className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {agent?.name ?? 'Agente'}
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">API Keys</h2>
      </header>

      {/* Token recién creado */}
      {newToken && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
            Token creado — cópialo ahora, no se mostrará de nuevo
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-white dark:bg-neutral-900 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-800 dark:text-neutral-200 break-all">
              {newToken}
            </code>
            <button
              onClick={copy}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg whitespace-nowrap"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <button onClick={() => setNewToken('')} className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline">
            He guardado el token
          </button>
        </div>
      )}

      {/* Crear nueva key */}
      <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Nueva API key</h3>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
            placeholder="Nombre descriptivo (ej: producción-n8n)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <button
            onClick={create}
            disabled={!name.trim() || creating}
            className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </section>

      {/* Listado */}
      <section className="space-y-3">
        {keys.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">No hay API keys aún.</p>
        )}
        {keys.map((key) => (
          <div
            key={key.id}
            className={`bg-white dark:bg-[#131313] border rounded-xl p-4 flex items-center justify-between ${
              key.revoked
                ? 'border-neutral-200 dark:border-neutral-800 opacity-50'
                : 'border-neutral-200 dark:border-neutral-800'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{key.name}</span>
                {key.revoked && (
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                    Revocada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <code>{key.token_prefix}…</code>
                <span>Creada {new Date(key.created_at).toLocaleDateString('es-MX')}</span>
                {key.last_used_at && (
                  <span>Último uso {new Date(key.last_used_at).toLocaleDateString('es-MX')}</span>
                )}
              </div>
            </div>
            {!key.revoked && (
              <button
                onClick={() => revoke(key.id)}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Revocar
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
