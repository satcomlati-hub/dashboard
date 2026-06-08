// ───────────────────────────────────────────────────────────────────────────
// Generador de reportes HTML corporativos (SARA)
// Produce un DOCUMENTO HTML autónomo (con su propio <style>) pensado para:
//   • renderizarse dentro de un <iframe srcDoc> en /chat/r/[token] (aísla estilos)
//   • imprimirse / "Guardar como PDF" con su CSS de impresión
// La generación de HTML es DETERMINISTA (no usa el LLM): el agente solo entrega
// los datos estructurados y aquí se arma la plantilla.
// ───────────────────────────────────────────────────────────────────────────

export type ReportTipo = 'tickets' | 'uso_ia' | 'conversaciones';

export interface ReportMeta {
  tipo: ReportTipo;
  titulo?: string;
  periodo?: string;
  generadoPor?: string;   // nombre del solicitante
  ttlHoras?: number;      // para el sello "Expira en N h"
}

export interface TicketRow {
  numero?: string | number;
  asunto?: string;
  empresa?: string;
  depto?: string;
  prioridad?: string;     // Alta | Media | Baja
  estado?: string;        // Abierto | En proceso | Resuelto | ...
  asignado?: string;
}

export interface TicketsData {
  kpis?: { total?: number; abiertos?: number; resueltos?: number; alta?: number };
  porDepto?: { nombre: string; valor: number }[];
  tickets?: TicketRow[];
}

/** Filas genéricas para reportes uso_ia / conversaciones u otros. */
export interface GenericData {
  kpis?: { label: string; valor: string | number; tono?: 'verde' | 'ambar' | 'rojo' | 'azul' }[];
  barras?: { nombre: string; valor: number }[];
  columnas?: string[];
  filas?: (string | number)[][];
}

export type ReportData = TicketsData | GenericData;

// ─── Utilidades ──────────────────────────────────────────────────────────────

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prioridadPill(p?: string): string {
  const v = (p || '').toLowerCase();
  const cls = v.includes('alta') || v.includes('urg') || v.includes('crit') ? 'p-alta'
    : v.includes('baj') ? 'p-baja' : 'p-media';
  return `<span class="pill ${cls}">${escapeHtml(p || '—')}</span>`;
}

function estadoPill(s?: string): string {
  const v = (s || '').toLowerCase();
  const cls = v.includes('resuel') || v.includes('cerr') ? 's-resuelto'
    : v.includes('proces') || v.includes('progres') ? 's-proceso' : 's-abierto';
  return `<span class="pill ${cls}">${escapeHtml(s || '—')}</span>`;
}

function barras(items: { nombre: string; valor: number }[]): string {
  const max = Math.max(1, ...items.map(i => Number(i.valor) || 0));
  return `<div class="bars">${items.map(i => {
    const pct = Math.round(((Number(i.valor) || 0) / max) * 100);
    return `<div class="bar-row"><span>${escapeHtml(i.nombre)}</span>` +
      `<div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>` +
      `<span class="v">${escapeHtml(i.valor)}</span></div>`;
  }).join('')}</div>`;
}

const STYLES = `
  :root{--verde:#71BF44;--verde-d:#5a9c33;--tinta:#1b2a17;--gris:#5b6b57;--linea:#e6ece2;--bg:#f6f8f4;--card:#fff;--rojo:#e5484d;--ambar:#e6a700;--azul:#3b82f6}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tinta);line-height:1.5;padding:28px 14px}
  .doc{max-width:980px;margin:0 auto;background:var(--card);border:1px solid var(--linea);border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(27,42,23,.06)}
  header{background:linear-gradient(135deg,var(--verde),var(--verde-d));color:#fff;padding:26px 34px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .brand{display:flex;align-items:center;gap:14px}
  .logo{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;border:1px solid rgba(255,255,255,.25)}
  .brand h1{font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.9;font-weight:700}
  .brand h2{font-size:21px;font-weight:800;margin-top:2px}
  .meta{text-align:right;font-size:12px;opacity:.95}.meta b{font-weight:700}
  .expira{display:inline-block;margin-top:8px;background:rgba(0,0,0,.18);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
  .body{padding:26px 34px 34px}
  .sub{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:20px;color:var(--gris);font-size:13px}
  .sub .periodo{font-size:15px;color:var(--tinta);font-weight:700}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px}
  .kpi{background:var(--bg);border:1px solid var(--linea);border-radius:14px;padding:16px 18px}
  .kpi .n{font-size:28px;font-weight:800;letter-spacing:-.02em}
  .kpi .l{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--gris);font-weight:700;margin-top:2px}
  .kpi.alta .n,.kpi.rojo .n{color:var(--rojo)}.kpi.abiertos .n,.kpi.ambar .n{color:var(--ambar)}
  .kpi.resueltos .n,.kpi.verde .n{color:var(--verde-d)}.kpi.azul .n{color:var(--azul)}
  h3.section{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--verde-d);font-weight:800;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--linea)}
  .bars{display:flex;flex-direction:column;gap:10px}
  .bar-row{display:grid;grid-template-columns:190px 1fr 46px;align-items:center;gap:12px;font-size:13px}
  .bar-track{background:var(--bg);border:1px solid var(--linea);border-radius:999px;height:14px;overflow:hidden}
  .bar-fill{height:100%;background:linear-gradient(90deg,var(--verde),var(--verde-d));border-radius:999px}
  .bar-row .v{text-align:right;font-weight:700;color:var(--gris)}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}
  thead th{text-align:left;background:var(--bg);color:var(--gris);text-transform:uppercase;font-size:10.5px;letter-spacing:.07em;padding:10px 12px;border-bottom:2px solid var(--linea)}
  tbody td{padding:11px 12px;border-bottom:1px solid var(--linea);vertical-align:middle}
  .tk{font-weight:800;color:var(--verde-d)}
  .pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
  .p-alta{background:#fde8e8;color:#b3262a}.p-media{background:#fff4d6;color:#8a6500}.p-baja{background:#e8f5e0;color:#3f7a23}
  .s-abierto{background:#fff4d6;color:#8a6500}.s-proceso{background:#e0edff;color:#1f5fc0}.s-resuelto{background:#e8f5e0;color:#3f7a23}
  .empty{padding:24px;text-align:center;color:var(--gris);font-size:13px;background:var(--bg);border-radius:12px}
  footer{padding:18px 34px;border-top:1px solid var(--linea);color:var(--gris);font-size:11px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  @media print{body{background:#fff;padding:0}.doc{border:none;box-shadow:none;border-radius:0;max-width:none}}
  @media(max-width:680px){.kpis{grid-template-columns:repeat(2,1fr)}.bar-row{grid-template-columns:120px 1fr 40px}}
`;

function shell(meta: ReportMeta, bodyHtml: string, fechaTexto: string): string {
  const titulo = meta.titulo || (meta.tipo === 'tickets' ? 'Reporte de Tickets'
    : meta.tipo === 'uso_ia' ? 'Reporte de Uso de IA' : 'Reporte de Conversaciones');
  const ttl = meta.ttlHoras ?? 72;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1.0"/>` +
    `<title>${escapeHtml(titulo)} · SARA</title><style>${STYLES}</style></head><body>` +
    `<div class="doc">` +
    `<header><div class="brand"><div class="logo">S</div>` +
    `<div><h1>Satcom · SARA</h1><h2>${escapeHtml(titulo)}</h2></div></div>` +
    `<div class="meta">Generado por <b>SARA</b><br/>${escapeHtml(fechaTexto)}` +
    (meta.generadoPor ? `<br/>Solicitado por <b>${escapeHtml(meta.generadoPor)}</b>` : '') +
    `<div class="expira">⏱ Expira en ${escapeHtml(ttl)} h</div></div></header>` +
    `<div class="body">${bodyHtml}</div>` +
    `<footer><span>SARA · Reporte generado automáticamente — verifica datos críticos en la fuente.</span>` +
    `<span>Satcom Latin America</span></footer>` +
    `</div></body></html>`;
}

// ─── Cuerpos por tipo ────────────────────────────────────────────────────────

function bodyTickets(meta: ReportMeta, d: TicketsData): string {
  const k = d.kpis || {};
  const kpis = `<div class="kpis">` +
    `<div class="kpi"><div class="n">${escapeHtml(k.total ?? 0)}</div><div class="l">Total tickets</div></div>` +
    `<div class="kpi abiertos"><div class="n">${escapeHtml(k.abiertos ?? 0)}</div><div class="l">Abiertos</div></div>` +
    `<div class="kpi resueltos"><div class="n">${escapeHtml(k.resueltos ?? 0)}</div><div class="l">Resueltos</div></div>` +
    `<div class="kpi alta"><div class="n">${escapeHtml(k.alta ?? 0)}</div><div class="l">Prioridad alta</div></div>` +
    `</div>`;

  const deptos = (d.porDepto && d.porDepto.length)
    ? `<h3 class="section">Tickets por departamento</h3>${barras(d.porDepto)}` : '';

  const rows = (d.tickets || []).map(t =>
    `<tr><td class="tk">${escapeHtml(t.numero ?? '—')}</td>` +
    `<td>${escapeHtml(t.asunto ?? '')}</td>` +
    `<td>${escapeHtml(t.empresa ?? '')}</td>` +
    `<td>${escapeHtml(t.depto ?? '')}</td>` +
    `<td>${prioridadPill(t.prioridad)}</td>` +
    `<td>${estadoPill(t.estado)}</td>` +
    `<td>${escapeHtml(t.asignado ?? '—')}</td></tr>`).join('');

  const tabla = (d.tickets && d.tickets.length)
    ? `<h3 class="section">Detalle de tickets</h3><table><thead><tr>` +
      `<th>Ticket</th><th>Asunto</th><th>Empresa</th><th>Depto.</th><th>Prioridad</th><th>Estado</th><th>Asignado</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty">Sin tickets para el periodo seleccionado.</div>`;

  const sub = `<div class="sub"><span class="periodo">Periodo: ${escapeHtml(meta.periodo || 'No especificado')}</span></div>`;
  return sub + kpis + deptos + tabla;
}

function bodyGeneric(meta: ReportMeta, d: GenericData): string {
  const sub = `<div class="sub"><span class="periodo">Periodo: ${escapeHtml(meta.periodo || 'No especificado')}</span></div>`;
  const kpis = (d.kpis && d.kpis.length)
    ? `<div class="kpis">${d.kpis.map(x =>
        `<div class="kpi ${x.tono || ''}"><div class="n">${escapeHtml(x.valor)}</div><div class="l">${escapeHtml(x.label)}</div></div>`
      ).join('')}</div>` : '';
  const bars = (d.barras && d.barras.length)
    ? `<h3 class="section">Distribución</h3>${barras(d.barras)}` : '';
  let tabla = '';
  if (d.columnas && d.columnas.length && d.filas) {
    const head = d.columnas.map(c => `<th>${escapeHtml(c)}</th>`).join('');
    const body = d.filas.map(f => `<tr>${f.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
    tabla = `<h3 class="section">Detalle</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  const cuerpo = kpis + bars + tabla;
  return sub + (cuerpo || `<div class="empty">Sin datos para mostrar.</div>`);
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function buildReportHtml(
  meta: ReportMeta,
  data: ReportData,
  now: Date = new Date(),
): string {
  const fechaTexto = now.toLocaleString('es-EC', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil',
  });
  const body = meta.tipo === 'tickets'
    ? bodyTickets(meta, data as TicketsData)
    : bodyGeneric(meta, data as GenericData);
  return shell(meta, body, fechaTexto);
}
