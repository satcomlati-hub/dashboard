import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co';
const BUCKET = 'chat-uploads';
const AVATAR_FOLDER = 'avatars';

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!key) throw new Error('SUPABASE_SERVICE_KEY no definida');
    supabaseAdminInstance = createClient(SUPABASE_URL, key);
  }
  return supabaseAdminInstance;
}

function initialsAvatar(initial: string): NextResponse {
  const letter = initial.toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="#71BF44"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="white">${letter}</text>
</svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  });
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) return initialsAvatar('?');

  const avatarPath = `${AVATAR_FOLDER}/${email}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${avatarPath}`;

  try {
    // 1. Buscar en Supabase Storage
    const { data: files, error: listError } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .list(AVATAR_FOLDER, { search: email });

    if (listError) console.warn('[photo] Error al listar Storage:', listError.message);

    if (files?.some(f => f.name === email)) {
      return NextResponse.redirect(publicUrl, {
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // 2. No está en Supabase → intentar descargar de Zoho si hay token activo
    const accessToken = (session as any)?.accessToken as string | undefined;
    if (!accessToken) {
      // Token expirado o no disponible → mostrar inicial
      return initialsAvatar(email.charAt(0));
    }

    // Obtener URL de foto desde userinfo de Zoho
    let photoUrl: string | null = null;
    const userInfoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userInfoRes.ok) {
      const info = await userInfoRes.json();
      photoUrl = info.picture || info.photo || null;
      if (!photoUrl && (info.sub || info.ZUID)) {
        photoUrl = `https://contacts.zoho.com/file?fs=thumb&ID=${info.sub || info.ZUID}`;
      }
    }

    if (!photoUrl) return initialsAvatar(email.charAt(0));

    // Descargar imagen (3 métodos de autenticación)
    let photoRes = await fetch(photoUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    if (!photoRes.ok) {
      photoRes = await fetch(photoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    }
    if (!photoRes.ok) photoRes = await fetch(photoUrl);
    if (!photoRes.ok) return initialsAvatar(email.charAt(0));

    // 3. Subir a Supabase Storage y redirigir
    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg';
    const buffer = Buffer.from(await photoRes.arrayBuffer());

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .upload(avatarPath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error('[photo] Error al subir a Supabase:', uploadError.message);
      // Servir imagen directamente como fallback si falla la subida
      return new NextResponse(buffer, {
        status: 200,
        headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' },
      });
    }

    return NextResponse.redirect(publicUrl, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (error) {
    console.error('[photo] Error inesperado:', error);
    return initialsAvatar(email?.charAt(0) || '?');
  }
}
