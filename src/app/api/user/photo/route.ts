import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co';
const BUCKET = 'chat-uploads';
const AVATAR_FOLDER = 'avatars';

// Lazy-loaded para evitar errores en build sin variables de entorno
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!key) throw new Error('SUPABASE_SERVICE_KEY no definida');
    supabaseAdminInstance = createClient(SUPABASE_URL, key);
  }
  return supabaseAdminInstance;
}

// SVG de iniciales como fallback (nunca devuelve error a un <img>)
function initialsAvatar(initial: string): NextResponse {
  const letter = initial.toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="#71BF44"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="white">${letter}</text>
</svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return initialsAvatar('?');
  }

  const avatarPath = `${AVATAR_FOLDER}/${email}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${avatarPath}`;

  try {
    // Verificar si el avatar ya está cacheado en Supabase
    const { data: files, error: listError } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .list(AVATAR_FOLDER, { search: email });

    if (listError) {
      console.warn('[photo] Error al listar en Storage:', listError.message);
    }

    const fileExists = files?.some(file => file.name === email);

    if (fileExists) {
      // Redirigir directamente al archivo público de Supabase
      return NextResponse.redirect(publicUrl, {
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // Avatar aún no cacheado — el login lo cachea en el próximo inicio de sesión
    // Devolver iniciales como fallback hasta que se cachee
    const initial = email.charAt(0);
    return initialsAvatar(initial);
  } catch (error) {
    console.error('[photo] Error en ruta de foto:', error);
    return initialsAvatar(email?.charAt(0) || '?');
  }
}
