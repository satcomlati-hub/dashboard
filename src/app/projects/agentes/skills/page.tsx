'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';

type Skill = {
  id: string; name: string; slug: string; description: string | null;
  content: string; created_at: string;
};

const empty = (): Partial<Skill> => ({
  name: '', slug: '', description: '', content: '# SKILL: \n\n## Description\n\n## Instructions\n',
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editing, setEditing] = useState<Partial<Skill> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetch('/api/agentes/v1/skills').then(r => r.json()).then(setSkills).catch(() => {});

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const isNew = !editing?.id;
      const url = isNew ? '/api/agentes/v1/skills' : `/api/agentes/v1/skills/${editing!.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setEditing(null);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta skill?')) return;
    setDeleting(id);
    await fetch(`/api/agentes/v1/skills/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const nameFromFile = file.name.replace(/\.md$/i, '');
      setEditing(ed => ({
        ...ed,
        content,
        name: ed?.name || nameFromFile,
        slug: ed?.slug || slugify(nameFromFile),
      }));
    };
    reader.readAsText(file);
    e.target.value = '';
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
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Gestiona las skills disponibles para tus agentes.</p>
          </div>
          <button
            onClick={() => setEditing(empty())}
            className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva skill
          </button>
        </div>
      </header>

      <AgentesNav />

      {/* Modal editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {editing.id ? 'Editar skill' : 'Nueva skill'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Nombre *</label>
                  <input
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                    value={editing.name ?? ''}
                    onChange={e => setEditing(ed => ({
                      ...ed!, name: e.target.value,
                      slug: ed?.slug || slugify(e.target.value),
                    }))}
                    placeholder="Mi skill"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Slug *</label>
                  <input
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                    value={editing.slug ?? ''}
                    onChange={e => setEditing(ed => ({ ...ed!, slug: e.target.value }))}
                    placeholder="mi-skill"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Descripción</label>
                <input
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                  value={editing.description ?? ''}
                  onChange={e => setEditing(ed => ({ ...ed!, description: e.target.value }))}
                  placeholder="¿Qué hace esta skill?"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-neutral-500">Contenido SKILL.md *</label>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-[#71BF44] hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importar .md
                  </button>
                  <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFile} />
                </div>
                <textarea
                  rows={16}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-900 dark:text-white font-mono resize-none"
                  value={editing.content ?? ''}
                  onChange={e => setEditing(ed => ({ ...ed!, content: e.target.value }))}
                  placeholder="# SKILL: nombre&#10;&#10;## Description&#10;..."
                  spellCheck={false}
                />
              </div>
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
      {skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No hay skills creadas aún.</p>
          <button onClick={() => setEditing(empty())} className="mt-3 text-sm text-[#71BF44] hover:underline">
            Crear la primera →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map(sk => (
            <div
              key={sk.id}
              className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-5 py-4 flex items-center justify-between group hover:border-[#71BF44]/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[#71BF44]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{sk.name}</span>
                  <span className="text-xs text-neutral-400 font-mono ml-2">{sk.slug}</span>
                  {sk.description && <p className="text-xs text-neutral-500 mt-0.5">{sk.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing({ ...sk })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => del(sk.id)}
                  disabled={deleting === sk.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {deleting === sk.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
