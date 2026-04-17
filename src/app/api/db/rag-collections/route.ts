import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Construye el query según las columnas opcionales que existan en la tabla.
 * Nivel 1 (ideal):  is_active + allowed_editors
 * Nivel 2 (actual): is_active sin allowed_editors
 * Nivel 3 (legacy): sin ninguna columna opcional
 */
async function queryCollections(userEmail: string, isAdmin: boolean) {
  const params = isAdmin ? [] : [userEmail];

  // ── Nivel 1: is_active + allowed_editors ──────────────────────────
  try {
    const canEdit = isAdmin
      ? 'true'
      : `(created_by = $1 OR $1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))`;
    return await pool.query(`
      SELECT
        manual, articulo, source_url, created_at, created_by,
        modified_at, modified_by, is_public,
        COALESCE(is_active, true) AS is_active,
        COALESCE(allowed_editors, ARRAY[]::text[]) AS allowed_editors,
        ${canEdit} AS can_edit
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `, params);
  } catch { /* allowed_editors inexistente — probar sin ella */ }

  // ── Nivel 2: is_active sin allowed_editors ────────────────────────
  try {
    const canEdit = isAdmin ? 'true' : '(created_by = $1)';
    return await pool.query(`
      SELECT
        manual, articulo, source_url, created_at, created_by,
        modified_at, modified_by, is_public,
        COALESCE(is_active, true) AS is_active,
        ARRAY[]::text[] AS allowed_editors,
        ${canEdit} AS can_edit
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `, params);
  } catch { /* is_active también inexistente — usar fallback total */ }

  // ── Nivel 3: sin ninguna columna opcional (legacy) ─────────────────
  const canEdit = isAdmin ? 'true' : '(created_by = $1)';
  return await pool.query(`
    SELECT
      manual, articulo, source_url, created_at, created_by,
      modified_at, modified_by, is_public,
      true AS is_active,
      ARRAY[]::text[] AS allowed_editors,
      ${canEdit} AS can_edit
    FROM mm_collections_v2
    WHERE manual IS NOT NULL
    ORDER BY manual ASC, articulo ASC;
  `, params);
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email ?? '';
  const isAdmin   = session?.user?.role === 'admin';

  try {
    const result = await queryCollections(userEmail, isAdmin);

    const grouped: Record<string, {
      articulos: Array<{
        articulo: string; source_url: string; created_at: string;
        created_by: string | null; modified_at: string | null;
        modified_by: string | null; is_public: boolean; is_active: boolean;
        can_edit: boolean; allowed_editors: string[];
      }>
    }> = {};

    for (const row of result.rows) {
      if (!grouped[row.manual]) grouped[row.manual] = { articulos: [] };
      grouped[row.manual].articulos.push({
        articulo:         row.articulo,
        source_url:       row.source_url,
        created_at:       row.created_at,
        created_by:       row.created_by,
        modified_at:      row.modified_at,
        modified_by:      row.modified_by,
        is_public:        row.is_public        ?? false,
        is_active:        row.is_active        ?? true,
        can_edit:         row.can_edit         ?? false,
        allowed_editors:  row.allowed_editors  ?? [],
      });
    }

    const data = Object.entries(grouped).map(([manual, info]) => ({
      manual,
      total:    info.articulos.length,
      articulos: info.articulos,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching RAG collections:', error);
    return NextResponse.json({ error: 'Failed to fetch RAG collections' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_url, manual } = body;

    if (typeof manual === 'string' && manual) {
      await pool.query(
        `DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(
        `DELETE FROM mm_base_publica WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(`DELETE FROM mm_collections_v2 WHERE manual = $1`, [manual]);
    } else if (typeof source_url === 'string' && source_url) {
      await pool.query(`DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' = $1`, [source_url]);
      await pool.query(`DELETE FROM mm_base_publica WHERE metadata->>'source_url' = $1`, [source_url]);
      await pool.query(`DELETE FROM mm_collections_v2 WHERE source_url = $1`, [source_url]);
    } else {
      return NextResponse.json({ error: 'source_url o manual requerido' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth();

  try {
    const body = await req.json();

    // ── Gestión de editores permitidos (solo admin) ────────────────
    if ('editor_email' in body) {
      if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden gestionar editores' }, { status: 403 });
      }

      const { source_url, manual, editor_email, editors_action } = body as {
        source_url?: string; manual?: string;
        editor_email: string; editors_action: 'add' | 'remove';
      };

      if (!editor_email || !['add', 'remove'].includes(editors_action)) {
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
      }

      if (manual) {
        // ── Nivel manual: aplica solo a artículos Zoho del manual ──
        if (editors_action === 'add') {
          await pool.query(`
            UPDATE mm_collections_v2
            SET allowed_editors = array_append(COALESCE(allowed_editors, ARRAY[]::text[]), $1)
            WHERE manual = $2
              AND source_url LIKE '%zohopublic%'
              AND NOT ($1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))
          `, [editor_email, manual]);
        } else {
          await pool.query(`
            UPDATE mm_collections_v2
            SET allowed_editors = array_remove(allowed_editors, $1)
            WHERE manual = $2
              AND source_url LIKE '%zohopublic%'
          `, [editor_email, manual]);
        }
      } else if (source_url) {
        // ── Nivel artículo individual ──────────────────────────────
        if (editors_action === 'add') {
          await pool.query(`
            UPDATE mm_collections_v2
            SET allowed_editors = array_append(COALESCE(allowed_editors, ARRAY[]::text[]), $1)
            WHERE source_url = $2
              AND NOT ($1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))
          `, [editor_email, source_url]);
        } else {
          await pool.query(`
            UPDATE mm_collections_v2
            SET allowed_editors = array_remove(allowed_editors, $1)
            WHERE source_url = $2
          `, [editor_email, source_url]);
        }
      } else {
        return NextResponse.json({ error: 'Se requiere source_url o manual' }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Cambio de responsable (created_by) (solo admin) ────────────
    if ('new_creator_email' in body) {
      if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden cambiar el responsable' }, { status: 403 });
      }

      const { source_url, manual, new_creator_email } = body;

      if (!new_creator_email || typeof new_creator_email !== 'string' || !new_creator_email.includes('@')) {
        return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
      }

      if (typeof manual === 'string' && manual) {
        await pool.query('UPDATE mm_collections_v2 SET created_by = $1 WHERE manual = $2', [new_creator_email, manual]);
      } else if (typeof source_url === 'string' && source_url) {
        await pool.query('UPDATE mm_collections_v2 SET created_by = $1 WHERE source_url = $2', [new_creator_email, source_url]);
      } else {
        return NextResponse.json({ error: 'Se requiere source_url o manual' }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Estado activo (is_active) ─────────────────────────────────
    if ('is_active' in body) {
      const { source_url, manual, is_active } = body as {
        source_url?: string; manual?: string; is_active: boolean;
      };

      if (typeof is_active !== 'boolean') {
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
      }

      const userEmail = session?.user?.email ?? '';
      const isAdmin   = session?.user?.role === 'admin';

      if (typeof manual === 'string' && manual) {
        // Nivel manual: solo admins
        if (!isAdmin) {
          return NextResponse.json({ error: 'Solo administradores pueden cambiar el estado del manual completo' }, { status: 403 });
        }
        await pool.query('UPDATE mm_collections_v2 SET is_active = $1 WHERE manual = $2', [is_active, manual]);
      } else if (typeof source_url === 'string' && source_url) {
        // Nivel artículo: admin o can_edit
        if (!isAdmin) {
          const check = await pool.query(
            `SELECT 1 FROM mm_collections_v2
             WHERE source_url = $1
               AND (created_by = $2 OR $2 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))`,
            [source_url, userEmail]
          );
          if (check.rowCount === 0) {
            return NextResponse.json({ error: 'Sin permisos para modificar este artículo' }, { status: 403 });
          }
        }
        await pool.query('UPDATE mm_collections_v2 SET is_active = $1 WHERE source_url = $2', [is_active, source_url]);
      } else {
        return NextResponse.json({ error: 'Se requiere source_url o manual' }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Visibilidad (is_public) ────────────────────────────────────
    const { source_url, manual, is_public } = body;

    if (typeof is_public !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    if (typeof manual === 'string' && manual) {
      await pool.query('UPDATE mm_collections_v2 SET is_public = $1 WHERE manual = $2', [is_public, manual]);
      await pool.query('SELECT sync_manual_visibility($1, $2)', [manual, is_public]);
    } else if (typeof source_url === 'string' && source_url) {
      await pool.query('UPDATE mm_collections_v2 SET is_public = $1 WHERE source_url = $2', [is_public, source_url]);
      await pool.query('SELECT sync_article_visibility($1, $2)', [source_url, is_public]);
    } else {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en PATCH:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
