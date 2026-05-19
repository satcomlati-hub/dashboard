import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Obtener información del usuario para sacar la URL de la foto y el ZUID
    const userInfoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userInfoRes.ok) {
      return new NextResponse('Failed to fetch user info from Zoho', { status: userInfoRes.status });
    }

    const userInfo = await userInfoRes.json();
    const photoUrl = userInfo.photo;
    const zuid = userInfo.ZUID;

    // Si no hay URL de foto ni ZUID, no podemos hacer más
    if (!photoUrl && !zuid) {
      return new NextResponse('No photo found', { status: 404 });
    }

    // Usar la URL devuelta por Zoho, o el fallback clásico usando el ZUID
    const targetUrl = photoUrl || `https://contacts.zoho.com/file?fs=thumb&ID=${zuid}`;

    // 2. Descargar la imagen desde Zoho
    const photoRes = await fetch(targetUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!photoRes.ok) {
      // Intentar con Bearer por si acaso
      const photoResAlt = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!photoResAlt.ok) {
        // Fallback final: intentar fetch simple por si es pública
        const photoResPublic = await fetch(targetUrl);
        if (!photoResPublic.ok) {
          return new NextResponse('Failed to download photo from Zoho', { status: photoResPublic.status });
        }
        return responseFromFetch(photoResPublic);
      }
      return responseFromFetch(photoResAlt);
    }

    return responseFromFetch(photoRes);

  } catch (error) {
    console.error('Error fetching Zoho profile photo:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function responseFromFetch(fetchRes: Response) {
  const blob = await fetchRes.blob();
  const headers = new Headers();
  headers.set('Content-Type', fetchRes.headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
  return new NextResponse(blob, {
    status: 200,
    headers,
  });
}
