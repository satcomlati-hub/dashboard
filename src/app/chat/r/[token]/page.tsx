import Link from 'next/link';
import { query } from '@/lib/db';
import DownloadButton from './DownloadButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReportRow {
  titulo: string | null;
  periodo: string | null;
  tipo: string;
  html: string;
  expires_at: string;
  created_at: string;
}

export default async function ReporteEfimeroPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let row: ReportRow | null = null;
  try {
    const res = await query(
      `select titulo, periodo, tipo, html, expires_at, created_at
         from public.ag_reports
        where token = $1
        limit 1`,
      [token],
    );
    row = (res.rows[0] as ReportRow | undefined) ?? null;
  } catch {
    row = null;
  }

  const expired = row ? new Date(row.expires_at).getTime() < Date.now() : false;

  // ── No existe / expirado ───────────────────────────────────────────────────
  if (!row || expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-[#131313] px-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-200 dark:bg-[#2a2a2a] flex items-center justify-center mx-auto mb-5 text-2xl">
            ⏱
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Este reporte ya no está disponible
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {expired
              ? 'El enlace expiró. Los reportes se eliminan automáticamente tras su periodo de vigencia. Pídele a SARA que lo genere de nuevo.'
              : 'No encontramos un reporte con este enlace. Es posible que haya expirado o que el enlace sea incorrecto.'}
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#71BF44] text-white text-sm font-bold hover:bg-[#5a9c33] transition-colors shadow-md shadow-[#71BF44]/25"
          >
            ← Volver al chat de SARA
          </Link>
        </div>
      </div>
    );
  }

  // ── Render del reporte ──────────────────────────────────────────────────────
  const venceTxt = new Date(row.expires_at).toLocaleString('es-EC', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil',
  });

  return (
    <div className="flex flex-col h-screen bg-[#fafafa] dark:bg-[#131313]">
      {/* Toolbar (no se imprime) */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#1b1b1b]/70 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/chat"
            className="shrink-0 text-xs font-bold text-neutral-500 hover:text-[#71BF44] transition-colors"
          >
            ← Chat
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {row.titulo || 'Reporte'}
            </h1>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
              {row.periodo ? `${row.periodo} · ` : ''}Disponible hasta {venceTxt}
            </p>
          </div>
        </div>
        <DownloadButton />
      </div>

      {/* Documento en iframe (aísla estilos del dashboard) */}
      <iframe
        id="reporte-frame"
        title={row.titulo || 'Reporte'}
        srcDoc={row.html}
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
