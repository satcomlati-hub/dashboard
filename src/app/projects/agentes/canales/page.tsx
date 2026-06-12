'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';

type Channel = {
  id: string;
  type: 'telegram' | 'zoho_cliq' | 'whatsapp';
  name: string;
  agent_id: string;
  enabled: boolean;
  bot_token_set: boolean;
  bot_token_preview: string | null;
  webhook_secret: string;
  webhook_url: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type Agent = { id: string; name: string; enabled?: boolean };

type ChannelDraft = {
  id?: string;
  type: 'telegram' | 'zoho_cliq' | 'whatsapp';
  name: string;
  agent_id: string;
  enabled: boolean;
  bot_token: string;       // vacío en edición = sin cambios (whatsapp: API Key de YCloud)
  bot_token_set?: boolean;
  from_number: string;      // solo whatsapp: número del negocio (E.164)
  signing_secret: string;   // solo whatsapp: Endpoint Secret de YCloud
  config?: Record<string, unknown>; // config existente (para preservar claves al editar)
};

type WebhookInfo = {
  // telegram
  connected?: boolean;
  expected_url: string;
  me?: { username?: string; first_name?: string };
  webhook?: { url?: string; pending_update_count?: number; ip_address?: string };
  // whatsapp (YCloud)
  from_number?: string;
  from_number_found?: boolean;
  signing_secret_set?: boolean;
  numbers?: { phoneNumber?: string; displayName?: string; status?: string; qualityRating?: string }[];
};

const TYPES: { value: Channel['type']; label: string; icon: string; ready: boolean }[] = [
  { value: 'telegram', label: 'Telegram', icon: '✈️', ready: true },
  { value: 'whatsapp', label: 'WhatsApp', icon: '🟢', ready: true },
  { value: 'zoho_cliq', label: 'Zoho Cliq', icon: '💬', ready: false },
];

const emptyDraft = (): ChannelDraft => ({
  type: 'telegram', name: '', agent_id: '', enabled: true, bot_token: '',
  from_number: '', signing_secret: '',
});

export default function CanalesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editing, setEditing] = useState<ChannelDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, WebhookInfo>>({});

  const load = () =>
    fetch('/api/agentes/v1/channels').then(r => (r.ok ? r.json() : [])).then(setChannels).catch(() => {});
  const loadAgents = () =>
    fetch('/api/agentes/v1/agents').then(r => (r.ok ? r.json() : [])).then(setAgents).catch(() => {});

  useEffect(() => { load(); loadAgents(); }, []);

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? id.slice(0, 8) + '…';

  const openEditor = (c?: Channel) => {
    if (c) {
      setEditing({
        id: c.id, type: c.type, name: c.name, agent_id: c.agent_id,
        enabled: c.enabled, bot_token: '', bot_token_set: c.bot_token_set,
        from_number: String(c.config?.from_number ?? ''),
        signing_secret: '', // nunca se trae del backend; vacío = sin cambios
        config: c.config,
      });
    } else {
      setEditing(emptyDraft());
    }
    setError('');
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.agent_id) { setError('Nombre y agente son obligatorios.'); return; }
    setSaving(true); setError('');
    try {
      const isNew = !editing.id;
      const payload: Record<string, unknown> = {
        type: editing.type, name: editing.name, agent_id: editing.agent_id, enabled: editing.enabled,
      };
      // El token solo se envía si el usuario escribió uno (en edición, vacío = sin cambios)
      if (editing.bot_token.trim()) payload.bot_token = editing.bot_token.trim();
      if (isNew && !editing.bot_token.trim() && editing.type === 'telegram') {
        setError('El bot_token de Telegram es obligatorio.'); setSaving(false); return;
      }
      if (editing.type === 'whatsapp') {
        if (isNew && !editing.bot_token.trim()) {
          setError('La API Key de YCloud es obligatoria.'); setSaving(false); return;
        }
        if (!editing.from_number.trim()) {
          setError('El número de WhatsApp (from) es obligatorio.'); setSaving(false); return;
        }
        const config: Record<string, unknown> = { ...(editing.config ?? {}) };
        config.from_number = editing.from_number.trim();
        if (editing.signing_secret.trim()) config.webhook_signing_secret = editing.signing_secret.trim();
        payload.config = config;
      }
      const url = isNew ? '/api/agentes/v1/channels' : `/api/agentes/v1/channels/${editing.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este canal? Se quitará también el webhook de Telegram.')) return;
    setDeleting(id);
    await fetch(`/api/agentes/v1/channels/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  };

  const connect = async (c: Channel) => {
    setBusy(c.id); setError('');
    try {
      const res = await fetch(`/api/agentes/v1/channels/${c.id}/telegram/set-webhook`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? 'No se pudo conectar el webhook');
      await refreshInfo(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const disconnect = async (c: Channel) => {
    if (!confirm('¿Desconectar el webhook? El bot dejará de responder por este canal.')) return;
    setBusy(c.id); setError('');
    try {
      await fetch(`/api/agentes/v1/channels/${c.id}/telegram/delete-webhook`, { method: 'POST' });
      await refreshInfo(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const refreshInfo = async (c: Channel) => {
    setBusy(c.id);
    try {
      const kind = c.type === 'whatsapp' ? 'whatsapp' : 'telegram';
      const res = await fetch(`/api/agentes/v1/channels/${c.id}/${kind}/info`);
      const data = await res.json().catch(() => null);
      if (res.ok && data) setInfo(prev => ({ ...prev, [c.id]: data }));
      else if (data?.detail) setError(String(data.detail));
    } finally { setBusy(null); }
  };

  const copyWebhook = async (c: Channel) => {
    if (!c.webhook_url) return;
    try { await navigator.clipboard.writeText(c.webhook_url); } catch { /* sin clipboard */ }
  };

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/projects" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Proyectos
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Agentes IA</h2>
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
              Conecta bots de mensajería (Telegram, WhatsApp vía YCloud, Zoho Cliq) directamente a un agente, sin n8n.
            </p>
          </div>
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo canal
          </button>
        </div>
      </header>

      <AgentesNav />

      {error && !editing && (
        <p className="mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Modal editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {editing.id ? 'Editar canal' : 'Nuevo canal'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Tipo */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Tipo de canal *</label>
                <div className="flex gap-2">
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      disabled={!!editing.id}
                      onClick={() => setEditing(ed => ed && ({ ...ed, type: t.value }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                        editing.type === t.value
                          ? 'bg-[#71BF44] border-[#71BF44] text-white'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-[#71BF44]/50'
                      }`}
                    >
                      {t.icon} {t.label}{!t.ready && ' (pronto)'}
                    </button>
                  ))}
                </div>
                {editing.type === 'zoho_cliq' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    El conector de Zoho Cliq aún no está implementado. Puedes guardar el canal, pero todavía no responderá.
                  </p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Nombre *</label>
                <input
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                  value={editing.name}
                  onChange={e => setEditing(ed => ed && ({ ...ed, name: e.target.value }))}
                  placeholder="Bot soporte clientes"
                />
              </div>

              {/* Agente */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Agente conectado *</label>
                <select
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                  value={editing.agent_id}
                  onChange={e => setEditing(ed => ed && ({ ...ed, agent_id: e.target.value }))}
                >
                  <option value="">— Selecciona un agente —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Bot token / API Key */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  {editing.type === 'telegram' ? 'Bot token de Telegram'
                    : editing.type === 'whatsapp' ? 'API Key de YCloud'
                    : 'Token / credencial'}
                  {!editing.id && (editing.type === 'telegram' || editing.type === 'whatsapp') && ' *'}
                </label>
                <input
                  type="password"
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                  value={editing.bot_token}
                  onChange={e => setEditing(ed => ed && ({ ...ed, bot_token: e.target.value }))}
                  placeholder={editing.bot_token_set ? '•••••• (dejar vacío = sin cambios)'
                    : editing.type === 'whatsapp' ? 'API Key del dashboard de YCloud' : '123456789:AA...'}
                />
                <p className="text-xs text-neutral-400 mt-1">Se almacena como secreto y nunca se muestra completo.</p>
              </div>

              {/* Campos específicos de WhatsApp (YCloud) */}
              {editing.type === 'whatsapp' && (
                <>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Número de WhatsApp (from) *</label>
                    <input
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                      value={editing.from_number}
                      onChange={e => setEditing(ed => ed && ({ ...ed, from_number: e.target.value }))}
                      placeholder="+5939XXXXXXXX"
                    />
                    <p className="text-xs text-neutral-400 mt-1">El número del negocio aprobado en YCloud, en formato E.164.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Endpoint Secret de YCloud (firma del webhook)</label>
                    <input
                      type="password"
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                      value={editing.signing_secret}
                      onChange={e => setEditing(ed => ed && ({ ...ed, signing_secret: e.target.value }))}
                      placeholder={editing.config?.webhook_signing_secret ? '•••••• (dejar vacío = sin cambios)' : 'whsec_… (Developer → Webhooks)'}
                    />
                    <p className="text-xs text-neutral-400 mt-1">
                      Se usa para verificar la firma <span className="font-mono">YCloud-Signature</span>. Recomendado; si se omite, solo protege la URL secreta.
                    </p>
                  </div>
                </>
              )}

              {/* Habilitado */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#71BF44]"
                  checked={editing.enabled}
                  onChange={e => setEditing(ed => ed && ({ ...ed, enabled: e.target.checked }))}
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Canal activo</span>
              </label>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
              <button onClick={() => setEditing(null)} className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-4 text-2xl">
            ✈️
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No hay canales configurados.</p>
          <button onClick={() => openEditor()} className="mt-3 text-sm text-[#71BF44] hover:underline">
            Configurar el primero →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map(c => {
            const t = TYPES.find(x => x.value === c.type);
            const wi = info[c.id];
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-5 py-4 group hover:border-[#71BF44]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#71BF44]/10 flex items-center justify-center flex-shrink-0 text-base">
                      {t?.icon ?? '🔌'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{c.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          c.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                        }`}>
                          {t?.label ?? c.type}
                        </span>
                        {wi && c.type === 'telegram' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            wi.connected
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          }`}>
                            {wi.connected ? '● webhook conectado' : '○ sin conectar'}
                          </span>
                        )}
                        {wi && c.type === 'whatsapp' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            wi.from_number_found
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          }`}>
                            {wi.from_number_found ? '● número verificado' : '○ número no encontrado'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Agente: <span className="text-neutral-500 dark:text-neutral-300">{agentName(c.agent_id)}</span>
                        {c.bot_token_preview && <span className="font-mono ml-2">{c.bot_token_preview}</span>}
                        {wi?.me?.username && <span className="ml-2">@{wi.me.username}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.type === 'whatsapp' && (
                      <>
                        <button
                          onClick={() => refreshInfo(c)}
                          disabled={busy === c.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                        >
                          {busy === c.id ? '…' : 'Estado'}
                        </button>
                        <button
                          onClick={() => copyWebhook(c)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[#71BF44] text-[#71BF44] hover:bg-[#71BF44]/10 transition-colors"
                          title="Copiar la URL para registrarla en YCloud → Developer → Webhooks"
                        >
                          Copiar webhook
                        </button>
                      </>
                    )}
                    {c.type === 'telegram' && (
                      <>
                        <button
                          onClick={() => refreshInfo(c)}
                          disabled={busy === c.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                        >
                          {busy === c.id ? '…' : 'Estado'}
                        </button>
                        <button
                          onClick={() => connect(c)}
                          disabled={busy === c.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[#71BF44] text-[#71BF44] hover:bg-[#71BF44]/10 transition-colors disabled:opacity-50"
                        >
                          Conectar webhook
                        </button>
                        <button
                          onClick={() => disconnect(c)}
                          disabled={busy === c.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                        >
                          Desconectar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openEditor(c)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => del(c.id)}
                      disabled={deleting === c.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === c.id ? '…' : 'Eliminar'}
                    </button>
                  </div>
                </div>

                {/* Detalle del webhook */}
                {wi && c.type === 'telegram' && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-400 space-y-1">
                    <p>URL esperada: <span className="font-mono text-neutral-500 dark:text-neutral-300 break-all">{wi.expected_url}</span></p>
                    <p>URL en Telegram: <span className="font-mono text-neutral-500 dark:text-neutral-300 break-all">{wi.webhook?.url || '(ninguna)'}</span></p>
                    {typeof wi.webhook?.pending_update_count === 'number' && (
                      <p>Updates pendientes: {wi.webhook.pending_update_count}</p>
                    )}
                  </div>
                )}
                {wi && c.type === 'whatsapp' && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-400 space-y-1">
                    <p>
                      Webhook (regístralo en YCloud → Developer → Webhooks, evento{' '}
                      <span className="font-mono">whatsapp.inbound_message.received</span>):{' '}
                      <span className="font-mono text-neutral-500 dark:text-neutral-300 break-all">{wi.expected_url}</span>
                    </p>
                    <p>
                      Firma del webhook: {wi.signing_secret_set
                        ? <span className="text-green-600 dark:text-green-400">configurada ✓</span>
                        : <span className="text-amber-600 dark:text-amber-400">sin configurar (recomendado agregar el Endpoint Secret)</span>}
                    </p>
                    {(wi.numbers ?? []).map((n, i) => (
                      <p key={i}>
                        Número en YCloud: <span className="font-mono text-neutral-500 dark:text-neutral-300">{n.phoneNumber}</span>
                        {n.displayName && <span className="ml-2">{n.displayName}</span>}
                        {n.status && <span className="ml-2">({n.status}{n.qualityRating ? `, calidad ${n.qualityRating}` : ''})</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
