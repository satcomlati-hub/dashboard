import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente admin de Supabase con clave de servicio para evadir RLS en subidas
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const BUCKET_NAME = 'chat-uploads';
const AVATAR_FOLDER = 'avatars';

export async function GET() {
  console.log('[ZohoPhotoProxy] === Nueva petición a /api/user/photo ===');
  
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    console.error('[ZohoPhotoProxy] Error: No se encontró correo en la sesión activa');
    return NextResponse.json({
      error: 'Unauthorized',
      message: 'No se encontró una sesión activa o el correo del usuario. Intenta iniciar sesión de nuevo.'
    }, { status: 401 });
  }

  const avatarPath = `${AVATAR_FOLDER}/${email}`;
  const publicUrl = `${process.env.SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co'}/storage/v1/object/public/${BUCKET_NAME}/${avatarPath}`;

  try {
    // 1. Comprobar si ya existe la imagen en Supabase Storage
    console.log(`[ZohoPhotoProxy] Buscando foto en Supabase Storage para: ${email}`);
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(AVATAR_FOLDER, {
        search: email
      });

    if (listError) {
      console.warn('[ZohoPhotoProxy] Advertencia al buscar en Storage:', listError.message);
    }

    const fileExists = files && files.some(file => file.name === email);

    if (fileExists) {
      console.log(`[ZohoPhotoProxy] Imagen encontrada en Supabase. Redirigiendo a url pública: ${publicUrl}`);
      
      // Creamos una respuesta de redirección (307)
      const response = NextResponse.redirect(publicUrl);
      
      // Forzar que el navegador no comparta caché del proxy pero sí use la imagen directamente
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return response;
    }

    // 2. Si no existe en Supabase, descargar desde Zoho
    const accessToken = (session as any)?.accessToken;
    if (!accessToken) {
      console.error('[ZohoPhotoProxy] Error: Imagen no en Supabase y no hay accessToken en la sesión');
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'La foto de perfil no se ha descargado de Zoho todavía y el token de acceso actual ha expirado. Por favor, cierra sesión e inicia sesión de nuevo para sincronizarla.'
      }, { status: 401 });
    }

    console.log(`[ZohoPhotoProxy] Imagen no encontrada en Supabase. Intentando descargar de Zoho para: ${email}`);

    // Petición a userinfo de Zoho
    const userInfoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userInfoRes.ok) {
      const errorText = await userInfoRes.text();
      console.error(`[ZohoPhotoProxy] Error al obtener info del usuario Zoho. Código ${userInfoRes.status}: `, errorText);
      return NextResponse.json({
        error: 'Failed to fetch user info from Zoho',
        status: userInfoRes.status,
        message: 'No se pudo validar la sesión con Zoho para descargar la foto de perfil.'
      }, { status: userInfoRes.status });
    }

    const userInfo = await userInfoRes.json();
    const photoUrl = userInfo.picture || userInfo.photo;
    const zuid = userInfo.sub || userInfo.ZUID;

    if (!photoUrl && !zuid) {
      console.error('[ZohoPhotoProxy] Error: No se encontró photoUrl ni ZUID en la respuesta de userinfo de Zoho');
      return NextResponse.json({ 
        error: 'No photo found',
        message: 'Zoho no devolvió una foto de perfil válida para esta cuenta.'
      }, { status: 404 });
    }

    const targetUrl = photoUrl || `https://contacts.zoho.com/file?fs=thumb&ID=${zuid}`;
    console.log(`[ZohoPhotoProxy] Descargando foto desde Zoho: ${targetUrl}`);

    // Intentamos descargar la foto de Zoho con distintos métodos de autenticación
    let photoRes = await fetch(targetUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!photoRes.ok) {
      console.log('[ZohoPhotoProxy] Falló descarga primaria. Intentando descarga alternativa con Bearer...');
      photoRes = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }

    if (!photoRes.ok) {
      console.log('[ZohoPhotoProxy] Falló descarga con cabeceras. Intentando descarga pública sin cabeceras...');
      photoRes = await fetch(targetUrl);
    }

    if (!photoRes.ok) {
      console.error('[ZohoPhotoProxy] Error: Todas las descargas de la foto fallaron de Zoho');
      return NextResponse.json({
        error: 'Failed to download photo from Zoho',
        status: photoRes.status,
        message: 'No se pudo descargar el archivo físico de la imagen de perfil desde Zoho.'
      }, { status: photoRes.status });
    }

    // 3. Obtener el Buffer de la imagen
    const contentType = photoRes.headers.get('Content-Type') || 'image/jpeg';
    const arrayBuffer = await photoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[ZohoPhotoProxy] Subiendo foto a Supabase en ruta: ${avatarPath} (${buffer.length} bytes, type: ${contentType})`);
    
    // Subir la imagen a Supabase Storage (usando upsert para reemplazar si es necesario)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(avatarPath, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error('[ZohoPhotoProxy] Error al subir la imagen a Supabase Storage:', uploadError);
      
      // Fallback: Si por alguna razón la subida a Supabase falla, al menos servimos el buffer
      // directamente en esta petición para no romper la UI del usuario en este instante.
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return new NextResponse(buffer, {
        status: 200,
        headers,
      });
    }

    console.log(`[ZohoPhotoProxy] Foto subida exitosamente a Supabase. Redirigiendo a url pública.`);
    
    const response = NextResponse.redirect(publicUrl);
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return response;

  } catch (error: any) {
    console.error(`[ZohoPhotoProxy] Excepción en el proxy de fotos: `, error);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error?.message || String(error)
    }, { status: 500 });
  }
}
