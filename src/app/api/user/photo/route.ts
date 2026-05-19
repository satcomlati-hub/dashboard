import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

function writeLog(message: string) {
  const logDir = 'C:\\Users\\jesus\\.gemini\\antigravity\\scratch';
  const logPath = path.join(logDir, 'proxy_debug.log');
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Error writing to debug log:', err);
  }
}

export async function GET() {
  writeLog('=== Nueva petición a /api/user/photo ===');
  
  const session = await auth();
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    writeLog('Error: No se encontró accessToken en la sesión');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  writeLog(`AccessToken obtenido exitosamente: ${accessToken.substring(0, 10)}...`);

  try {
    // 1. Obtener información del usuario para sacar la URL de la foto y el ZUID
    const userInfoRes = await fetch('https://accounts.zoho.com/oauth/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    writeLog(`Petición a userinfo finalizada. Estatus: ${userInfoRes.status} ${userInfoRes.statusText}`);

    if (!userInfoRes.ok) {
      const errorText = await userInfoRes.text();
      writeLog(`Error al obtener info del usuario de Zoho. Respuesta: ${errorText}`);
      return new NextResponse('Failed to fetch user info from Zoho', { status: userInfoRes.status });
    }

    const userInfo = await userInfoRes.json();
    writeLog(`Información de usuario obtenida: ${JSON.stringify(userInfo)}`);
    
    const photoUrl = userInfo.photo;
    const zuid = userInfo.ZUID;

    // Si no hay URL de foto ni ZUID, no podemos hacer más
    if (!photoUrl && !zuid) {
      writeLog('Error: No se encontró photoUrl ni ZUID en la respuesta de userinfo');
      return new NextResponse('No photo found', { status: 404 });
    }

    // Usar la URL devuelta por Zoho, o el fallback clásico usando el ZUID
    const targetUrl = photoUrl || `https://contacts.zoho.com/file?fs=thumb&ID=${zuid}`;
    writeLog(`Descargando foto desde: ${targetUrl}`);

    // 2. Descargar la imagen desde Zoho
    // Probamos con la cabecera estándar de Zoho
    writeLog('Intentando descarga con Zoho-oauthtoken...');
    let photoRes = await fetch(targetUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    writeLog(`Respuesta descarga 1 (Zoho-oauthtoken): ${photoRes.status} ${photoRes.statusText}`);

    if (!photoRes.ok) {
      // Intentar con Bearer por si acaso
      writeLog('Intentando descarga alternativa con Bearer...');
      const photoResAlt = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      writeLog(`Respuesta descarga 2 (Bearer): ${photoResAlt.status} ${photoResAlt.statusText}`);

      if (!photoResAlt.ok) {
        // Fallback final: intentar fetch simple por si es pública
        writeLog('Intentando descarga pública sin cabeceras...');
        const photoResPublic = await fetch(targetUrl);
        
        writeLog(`Respuesta descarga 3 (Pública): ${photoResPublic.status} ${photoResPublic.statusText}`);
        
        if (!photoResPublic.ok) {
          writeLog('Error: Todas las descargas de la foto fallaron');
          return new NextResponse('Failed to download photo from Zoho', { status: photoResPublic.status });
        }
        writeLog('Descarga pública exitosa');
        return responseFromFetch(photoResPublic);
      }
      writeLog('Descarga alternativa (Bearer) exitosa');
      return responseFromFetch(photoResAlt);
    }

    writeLog('Descarga inicial (Zoho-oauthtoken) exitosa');
    return responseFromFetch(photoRes);

  } catch (error: any) {
    writeLog(`Excepción en el proxy de fotos: ${error?.message || error}`);
    if (error?.stack) {
      writeLog(`Stack trace: ${error.stack}`);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function responseFromFetch(fetchRes: Response) {
  const blob = await fetchRes.blob();
  const headers = new Headers();
  headers.set('Content-Type', fetchRes.headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
  
  writeLog(`Retornando imagen de tamaño ${blob.size} bytes y tipo ${headers.get('Content-Type')}`);
  
  return new NextResponse(blob, {
    status: 200,
    headers,
  });
}
