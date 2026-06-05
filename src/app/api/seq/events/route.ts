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
    const debug = searchParams.get('debug') === 'true';

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
    let clientSideLevels: string[] | null = null;

    if (filterToSend && !isSqlQuery) {
      filterToSend = replaceNowWithAbsolute(filterToSend);
    }

    if (isColombia && filterToSend && !isSqlQuery) {
      filterToSend = translateLikeToContains(filterToSend);
      clientSideLevels = extractAllowedLevels(filterToSend);
      const stripped = stripLevelFilter(filterToSend);
      filterToSend = stripped === '' ? null : stripped;
    }

    // Si es Colombia y filtramos por nivel, pedir más logs de Seq para compensar el filtrado en memoria
    let countToSend = count;
    if (isColombia && clientSideLevels && count) {
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
          details: errorText || 'Error sin descripción de Seq.',
          debugInfo: debug ? {
            targetUrl: targetUrl.toString(),
            filterToSend,
            headers
          } : undefined
        },
        { status: response.status }
      );
    }

    let data = await response.json();

    if (debug) {
      return NextResponse.json({
        debug: true,
        targetUrl: targetUrl.toString(),
        filterToSend,
        isColombia,
        clientSideLevels,
        rawResponseSnippet: Array.isArray(data) ? data.slice(0, 3) : (data.Events ? data.Events.slice(0, 3) : data)
      });
    }

    // Aplicar filtrado del lado del cliente proxy si se removió el filtro de nivel para Colombia
    if (isColombia && clientSideLevels) {
      const events = Array.isArray(data) ? data : (data.Events || []);
      const filteredEvents = events.filter((event: any) => {
        const eventLevel = (event.Level || '').toLowerCase();
        return clientSideLevels!.includes(eventLevel);
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

// Funciones de apoyo para limpiar filtros y evadir bloqueos de WAF
function stripLevelFilter(filter: string): string {
  let res = filter;
  // 1. Reemplazar condiciones de nivel (ej. @Level = 'Fatal', @Level in ['Error'])
  res = res.replace(/@Level\s*(==|!=|=)\s*['"][^'"]+['"]/gi, '');
  res = res.replace(/@Level\s+in\s+\[\s*([^\]]+)\s*\]/gi, '');
  
  // 2. Limpiar operadores lógicos redundantes o huérfanos
  res = res.replace(/\s+/g, ' ');
  
  let prev;
  do {
    prev = res;
    res = res
      .replace(/\(\s*\)/g, '') // Paréntesis vacíos
      .replace(/\(\s*and\b/gi, '(')
      .replace(/\(\s*or\b/gi, '(')
      .replace(/\band\s*\)/gi, ')')
      .replace(/\bor\s*\)/gi, ')')
      .replace(/\band\s+and\b/gi, 'and')
      .replace(/\bor\s+or\b/gi, 'or')
      .replace(/\band\s+or\b/gi, 'or')
      .replace(/\bor\s+and\b/gi, 'and')
      .trim();
  } while (res !== prev);
  
  res = res
    .replace(/^(and|or)\b/gi, '')
    .replace(/\b(and|or)$/gi, '')
    .trim();
    
  return res;
}

function extractAllowedLevels(filter: string): string[] | null {
  const allowedLevels = new Set<string>();
  
  const singleMatches = filter.matchAll(/@Level\s*(==|=)\s*['"]([^'"]+)['"]/gi);
  for (const match of singleMatches) {
    allowedLevels.add(match[2].toLowerCase());
  }
  
  const inMatches = filter.matchAll(/@Level\s+in\s+\[\s*([^\]]+)\s*\]/gi);
  for (const match of inMatches) {
    const levels = match[1].split(',').map((l: string) => l.replace(/['"\s]/g, '').toLowerCase());
    levels.forEach(l => allowedLevels.add(l));
  }
  
  return allowedLevels.size > 0 ? Array.from(allowedLevels) : null;
}

function replaceNowWithAbsolute(filter: string): string {
  if (!filter) return filter;
  
  // 1. Primero reemplazar Now() - X o Now - X
  let res = filter.replace(/\bNow(?:\(\))?\s*([-+])\s*(\d+)\s*([dhms])\b/gi, (match, operator, valueStr, unit) => {
    const value = parseInt(valueStr, 10);
    const date = new Date();
    let offsetMs = 0;
    
    switch (unit.toLowerCase()) {
      case 'd':
        offsetMs = value * 24 * 60 * 60 * 1000;
        break;
      case 'h':
        offsetMs = value * 60 * 60 * 1000;
        break;
      case 'm':
        offsetMs = value * 60 * 1000;
        break;
      case 's':
        offsetMs = value * 1000;
        break;
    }
    
    if (operator === '-') {
      date.setTime(date.getTime() - offsetMs);
    } else {
      date.setTime(date.getTime() + offsetMs);
    }
    
    return `DateTime('${date.toISOString()}')`;
  });
  
  // 2. Luego reemplazar cualquier Now() o Now huérfano
  res = res.replace(/\bNow(?:\(\))?\b/gi, () => {
    return `DateTime('${new Date().toISOString()}')`;
  });
  
  return res;
}

function translateLikeToContains(filter: string): string {
  if (!filter) return filter;
  // Reemplazar: Propiedad like '%valor%' -> Contains(Propiedad, 'valor')
  let res = filter.replace(/([@\w\d_]+)\s+like\s+['"]%([^'"]+)%['"]/gi, "Contains($1, '$2')");
  // Reemplazar: Propiedad like 'valor%' -> StartsWith(Propiedad, 'valor')
  res = res.replace(/([@\w\d_]+)\s+like\s+['"]([^'"]+)%['"]/gi, "StartsWith($1, '$2')");
  // Reemplazar: Propiedad like '%valor' -> EndsWith(Propiedad, 'valor')
  res = res.replace(/([@\w\d_]+)\s+like\s+['"]%([^'"]+)['"]/gi, "EndsWith($1, '$2')");
  // Reemplazar: Propiedad like 'valor' -> Propiedad = 'valor'
  res = res.replace(/([@\w\d_]+)\s+like\s+['"]([^'"]+)['"]/gi, "$1 = '$2'");
  return res;
}
