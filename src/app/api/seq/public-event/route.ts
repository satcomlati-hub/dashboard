import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Retornar el detalle de un evento específico de Seq sin autenticación
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const origen = searchParams.get('origen');

    if (!id || !origen) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: id y origen son obligatorios.' },
        { status: 400 }
      );
    }

    // 1. Obtener la conexión a Seq correspondiente de la base de datos
    const dbResult = await query(
      `SELECT url, api_key 
       FROM sat_monitoreo.seq_conexiones 
       WHERE LOWER(nombre) = LOWER($1) LIMIT 1`,
      [origen]
    );

    if (dbResult.rows.length === 0) {
      return NextResponse.json(
        { error: `No se encontró la conexión para el origen: ${origen}` },
        { status: 404 }
      );
    }

    const { url: seqUrl, api_key: apiKey } = dbResult.rows[0];

    // 2. Intentar consultar directamente el evento a Seq mediante su ID en la URL /api/events/{id}
    const targetUrl = new URL(`/api/events/${id}`, seqUrl);
    
    const headers: HeadersInit = {
      'Accept': 'application/json'
    };
    if (apiKey && apiKey.trim() !== '') {
      headers['X-Seq-ApiKey'] = apiKey.trim();
    }

    let response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: headers
    });

    // 3. Fallback: Si falla, reintentar usando el query filter de Seq por @Id
    if (!response.ok) {
      const filterUrl = new URL('/api/events', seqUrl);
      filterUrl.searchParams.append('filter', `@Id = '${id}'`);
      filterUrl.searchParams.append('count', '1');

      response = await fetch(filterUrl.toString(), {
        method: 'GET',
        headers: headers
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Error al conectar con Seq: ${response.statusText}`, details: errText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error al obtener evento público de Seq:', error);
    return NextResponse.json(
      { error: 'Error interno al consultar Seq', details: error.message },
      { status: 500 }
    );
  }
}
