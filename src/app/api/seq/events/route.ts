import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seqUrl = searchParams.get('seqUrl');
    const filter = searchParams.get('filter');
    const count = searchParams.get('count');
    const render = searchParams.get('render');
    const afterId = searchParams.get('afterId');

    const apiKey = request.headers.get('x-seq-apikey');

    if (!seqUrl) {
      return NextResponse.json(
        { error: 'Falta parámetro requerido: seqUrl es obligatorio.' },
        { status: 400 }
      );
    }

    // Construir la URL final de Seq
    // Seq usa el endpoint /api/events para consultar eventos
    const targetUrl = new URL('/api/events', seqUrl);
    if (filter) targetUrl.searchParams.append('filter', filter);
    if (count) targetUrl.searchParams.append('count', count);
    if (render) targetUrl.searchParams.append('render', render);
    if (afterId) targetUrl.searchParams.append('afterId', afterId);

    const headers: HeadersInit = {
      'Accept': 'application/json'
    };

    if (apiKey && apiKey.trim() !== '') {
      headers['X-Seq-ApiKey'] = apiKey.trim();
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Error de Seq (Status ${response.status})`,
          details: errorText || 'Error sin descripción de Seq.'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error al conectar con Seq en el proxy:', error);
    return NextResponse.json(
      {
        error: 'Imposible conectar con Seq',
        details: `No se pudo establecer conexión. Asegúrate de que Seq esté corriendo y la URL sea correcta. Error: ${error.message}`
      },
      { status: 502 }
    );
  }
}
