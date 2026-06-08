import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { buildReportHtml, type ReportTipo, type ReportData } from '@/lib/reportes';

// Node runtime: usa pg (pool) y crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS: ReportTipo[] = ['tickets', 'uso_ia', 'conversaciones'];

/**
 * POST /api/reportes/generar
 * Server-to-server (lo llama el agente SARA como HTTP tool). Protegido por secreto.
 * Body: { tipo, titulo?, periodo?, generadoPor?, ttlHoras?, datos }
 * Respuesta: { token, url, marker }
 *   - url    → página efímera /chat/r/{token}
 *   - marker → texto "[[REPORT]]:{...}" que el agente debe incluir al final de su
 *              respuesta para que el chat muestre la tarjeta dinámica.
 */
export async function POST(req: NextRequest) {
  // 1. Autenticación server-to-server por secreto compartido.
  const expected = process.env.SARA_REPORT_KEY;
  const got = req.headers.get('x-sara-report-key');
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // 2. Parseo y validación.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const tipo = String(body.tipo || '') as ReportTipo;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: `tipo inválido. Use uno de: ${TIPOS_VALIDOS.join(', ')}` },
      { status: 400 },
    );
  }

  const titulo = body.titulo ? String(body.titulo) : undefined;
  const periodo = body.periodo ? String(body.periodo) : undefined;
  const generadoPor = body.generadoPor ? String(body.generadoPor) : undefined;
  const ttlHoras = Number.isFinite(Number(body.ttlHoras)) && Number(body.ttlHoras) > 0
    ? Math.min(Number(body.ttlHoras), 720)   // tope 30 días
    : 72;
  const datos = (body.datos ?? {}) as ReportData;

  // 3. Render determinista del HTML.
  let html: string;
  try {
    html = buildReportHtml({ tipo, titulo, periodo, generadoPor, ttlHoras }, datos);
  } catch (e) {
    return NextResponse.json(
      { error: 'Error al construir el reporte', detalle: String(e) },
      { status: 500 },
    );
  }

  // 4. Persistir en ag_reports.
  const token = randomBytes(12).toString('base64url'); // URL-safe, no adivinable
  const resumen = body.resumen ? String(body.resumen) : null;
  try {
    await query(
      `insert into public.ag_reports
         (token, tipo, titulo, periodo, params, resumen, html, created_by, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8, now() + ($9 || ' hours')::interval)`,
      [
        token, tipo, titulo ?? null, periodo ?? null,
        JSON.stringify({ datos }), resumen, html, generadoPor ?? null,
        String(ttlHoras),
      ],
    );
  } catch (e) {
    return NextResponse.json(
      { error: 'Error al guardar el reporte', detalle: String(e) },
      { status: 500 },
    );
  }

  // 5. Respuesta para el agente.
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard-one-ivory-58.vercel.app';
  const url = `${base.replace(/\/$/, '')}/chat/r/${token}`;
  const marker = `[[REPORT]]:${JSON.stringify({ token, titulo: titulo || 'Reporte', periodo: periodo || '', tipo })}`;

  return NextResponse.json({ token, url, marker });
}
