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

    const isColombia = seqUrl && seqUrl.includes('logs-colombia.mysatcomla.com');
    const isSqlQuery = !!(filter && filter.trim().toLowerCase().startsWith('select '));
    let filterToSend = filter;
    let clientSideLevelFilter: string | null = null;
    let clientSideLevelList: string[] | null = null;

    if (isColombia && filter && !isSqlQuery) {
      // Detectar filtros de nivel simple: @Level == 'Warning' o @Level = 'Warning'
      const levelPattern = /@Level\s*(==|=)\s*'([^']+)'/i;
      const match = filter.match(levelPattern);
      if (match) {
        clientSideLevelFilter = match[2].toLowerCase();
        filterToSend = filter.replace(levelPattern, '').trim();
      } else {
        // Detectar filtros IN: @Level in ['Warning', 'Error']
        const inPattern = /@Level\s+in\s+\[\s*([^\]]+)\s*\]/i;
        const inMatch = filter.match(inPattern);
        if (inMatch) {
          clientSideLevelList = inMatch[1].split(',').map((l: string) => l.replace(/['"\s]/g, '').toLowerCase());
          filterToSend = filter.replace(inPattern, '').trim();
        }
      }

      if ((clientSideLevelFilter || clientSideLevelList) && filterToSend) {
        // Limpiar operadores residuales
        filterToSend = filterToSend.replace(/\(\s*\)/g, '').trim();
        filterToSend = filterToSend.replace(/\band\s+and\b/gi, 'and').trim();
        filterToSend = filterToSend.replace(/^\s*and\s+/gi, '').replace(/\s+and\s*$/gi, '').trim();
        if (filterToSend === '') {
          filterToSend = null;
        }
      }
    }

    // Si es Colombia, pedir más logs de Seq para compensar el filtrado en memoria
    let countToSend = count;
    if (isColombia && (clientSideLevelFilter || clientSideLevelList) && count) {
      const requestedCount = parseInt(count, 10);
      if (!isNaN(requestedCount)) {
        countToSend = Math.min(1000, requestedCount * 3).toString();
      }
    }

    // Construir la URL final de Seq
    // Seq usa el endpoint /api/events para consultar eventos, y /api/data para consultas SQL (select ...)
    const targetUrl = new URL(isSqlQuery ? '/api/data' : '/api/events', seqUrl);
    
    if (isSqlQuery) {
      targetUrl.searchParams.append('q', filterToSend || '');
    } else {
      if (filterToSend) targetUrl.searchParams.append('filter', filterToSend);
      if (countToSend) targetUrl.searchParams.append('count', countToSend);
      if (render) targetUrl.searchParams.append('render', render);
      if (afterId) targetUrl.searchParams.append('afterId', afterId);
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
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

    let data = await response.json();

    // Aplicar filtrado del lado del cliente proxy si se removió el filtro de nivel para Colombia
    if (isColombia && (clientSideLevelFilter || clientSideLevelList)) {
      const events = Array.isArray(data) ? data : (data.Events || []);
      const filteredEvents = events.filter((event: any) => {
        const eventLevel = (event.Level || '').toLowerCase();
        if (clientSideLevelFilter) {
          return eventLevel === clientSideLevelFilter;
        }
        if (clientSideLevelList) {
          return clientSideLevelList.includes(eventLevel);
        }
        return true;
      });

      if (Array.isArray(data)) {
        data = filteredEvents.slice(0, count ? parseInt(count, 10) : 100);
      } else {
        data.Events = filteredEvents.slice(0, count ? parseInt(count, 10) : 100);
      }
    }

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
