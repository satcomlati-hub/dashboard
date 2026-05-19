import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  console.log('[ZohoPhotoProxy] === Nueva petición a /api/user/photo ===');
  
  const session = await auth();
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    console.error('[ZohoPhotoProxy] Error: No se encontró accessToken en la sesión');
    return NextResponse.json({
      error: 'Unauthorized',
      message: 'No se encontró accessToken en la sesión actual de NextAuth. Intenta cerrar sesión y volver a loguearte con Zoho.'
    }, { status: 401 });
  }

  console.log(`[ZohoPhotoProxy] AccessToken obtenido: ${accessToken.substring(0, 10)}...`);

  try {
    // 1. Obtener información del usuario para sacar la URL de la foto y el ZUID
    const userInfoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log(`[ZohoPhotoProxy] Petición a userinfo finalizada. Estatus: ${userInfoRes.status} ${userInfoRes.statusText}`);

    if (!userInfoRes.ok) {
      const errorText = await userInfoRes.text();
      console.error(`[ZohoPhotoProxy] Error al obtener info del usuario. Código ${userInfoRes.status}. Respuesta: `, errorText);
      return NextResponse.json({
        error: 'Failed to fetch user info from Zoho',
        status: userInfoRes.status,
        response: errorText
      }, { status: userInfoRes.status });
    }

    const userInfo = await userInfoRes.json();
    console.log(`[ZohoPhotoProxy] Información de usuario obtenida: `, JSON.stringify(userInfo));
    
    const photoUrl = userInfo.photo;
    const zuid = userInfo.ZUID;

    // Si no hay URL de foto ni ZUID, no podemos hacer más, pero devolvemos userInfo para debuguear
    if (!photoUrl && !zuid) {
      console.error('[ZohoPhotoProxy] Error: No se encontró photoUrl ni ZUID en la respuesta de userinfo');
      return NextResponse.json({
        error: 'No photo found',
        message: 'No se encontró photoUrl ni ZUID en los datos devueltos por Zoho.',
        debugUserInfoReceived: userInfo // Esto nos mostrará el JSON completo en el navegador del usuario
      }, { status: 404 });
    }

    // Usar la URL devuelta por Zoho, o el fallback clásico usando el ZUID
    const targetUrl = photoUrl || `https://contacts.zoho.com/file?fs=thumb&ID=${zuid}`;
    console.log(`[ZohoPhotoProxy] Descargando foto desde: ${targetUrl}`);

    // 2. Descargar la imagen desde Zoho
    // Probamos con la cabecera estándar de Zoho
    console.log('[ZohoPhotoProxy] Intentando descarga con Zoho-oauthtoken...');
    let photoRes = await fetch(targetUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    console.log(`[ZohoPhotoProxy] Respuesta descarga 1 (Zoho-oauthtoken): ${photoRes.status} ${photoRes.statusText}`);

    if (!photoRes.ok) {
      // Intentar con Bearer por si acaso
      console.log('[ZohoPhotoProxy] Intentando descarga alternativa con Bearer...');
      const photoResAlt = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log(`[ZohoPhotoProxy] Respuesta descarga 2 (Bearer): ${photoResAlt.status} ${photoResAlt.statusText}`);

      if (!photoResAlt.ok) {
        // Fallback final: intentar fetch simple por si es pública
        console.log('[ZohoPhotoProxy] Intentando descarga pública sin cabeceras...');
        const photoResPublic = await fetch(targetUrl);
        
        console.log(`[ZohoPhotoProxy] Respuesta descarga 3 (Pública): ${photoResPublic.status} ${photoResPublic.statusText}`);
        
        if (!photoResPublic.ok) {
          console.error('[ZohoPhotoProxy] Error: Todas las descargas de la foto fallaron');
          return NextResponse.json({
            error: 'Failed to download photo from Zoho',
            status: photoResPublic.status,
            message: 'No se pudo descargar el archivo de imagen de Zoho con ningún método.',
            debugUserInfoReceived: userInfo
          }, { status: photoResPublic.status });
        }
        console.log('[ZohoPhotoProxy] Descarga pública exitosa');
        return responseFromFetch(photoResPublic);
      }
      console.log('[ZohoPhotoProxy] Descarga alternativa (Bearer) exitosa');
      return responseFromFetch(photoResAlt);
    }

    console.log('[ZohoPhotoProxy] Descarga inicial (Zoho-oauthtoken) exitosa');
    return responseFromFetch(photoRes);

  } catch (error: any) {
    console.error(`[ZohoPhotoProxy] Excepción en el proxy de fotos: `, error);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error?.message || String(error)
    }, { status: 500 });
  }
}

async function responseFromFetch(fetchRes: Response) {
  const blob = await fetchRes.blob();
  const headers = new Headers();
  headers.set('Content-Type', fetchRes.headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
  
  console.log(`[ZohoPhotoProxy] Retornando imagen de tamaño ${blob.size} bytes y tipo ${headers.get('Content-Type')}`);
  
  return new NextResponse(blob, {
    status: 200,
    headers,
  });
}
