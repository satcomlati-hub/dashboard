---
name: decoding-trama-dto
description: Explica cómo decodificar la variable i_co_trama_dto de los logs de SATCOM, la cual está comprimida en formato GZIP, codificada en Base64 con el prefijo "gzip:", y tiene un offset de cabecera de 4 bytes.
---

# Skill: Decodificación de Trama de Comprobantes (i_co_trama_dto)

Esta habilidad documenta las reglas y la lógica técnica para extraer, decodificar y descomprimir el contenido XML original almacenado en la columna o variable `@i_co_trama_dto` dentro de la base de datos de SATCOM.

## Cuándo usar esta skill
- Al realizar análisis forense de comprobantes con discrepancias en BDD.
- Al depurar errores técnicos en los logs operativos de los microservicios de SATCOM.
- Para verificar el contenido real transmitido al SRI de Ecuador o a las entidades autorizadoras de Panamá a partir de la trama binaria compacta.

## Flujo de Trabajo

1. **Identificación de la Trama**: Localizar el valor del parámetro `@i_co_trama_dto` en los logs del SP o la base de datos.
2. **Remoción de Prefijo**: Quitar la cadena inicial `"gzip:"`.
3. **Decodificación Base64**: Convertir el texto base64 resultante en un buffer de bytes.
4. **Remoción del Offset de Cabecera**: Descartar los primeros **4 bytes** del buffer (estos representan metadatos del tamaño de la trama en la cabecera original).
5. **Descompresión GZIP**: Utilizar el algoritmo GZIP (zlib en Node.js) para descomprimir el buffer restante.
6. **Obtención del XML**: Leer el contenido descomprimido como texto en codificación UTF-8.

---

## Instrucciones y Código de Referencia (Node.js)

Para decodificar y descomprimir la trama de forma programática, utilice el siguiente patrón de código de referencia:

```javascript
const zlib = require('zlib');
const fs = require('fs');

/**
 * Decodifica una trama i_co_trama_dto en formato gzip:base64
 * @param {string} tramaRaw Cadena original que empieza con "gzip:"
 * @returns {string} XML original descomprimido
 */
function decodeTramaDto(tramaRaw) {
  // 1. Validar prefijo
  if (!tramaRaw.startsWith('gzip:')) {
    throw new Error('La trama no tiene el prefijo "gzip:" esperado.');
  }

  // 2. Extraer cadena Base64
  const base64Str = tramaRaw.substring(5).trim();

  // 3. Convertir Base64 a Buffer
  const buf = Buffer.from(base64Str, 'base64');

  // 4. Determinar si es GZIP puro o si cuenta con cabecera custom de tamaño
  let gzipBuf;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    // Es GZIP estándar puro (empieza con 1f 8b / H4sI en Base64)
    gzipBuf = buf;
  } else {
    // Tiene cabecera custom de tamaño de 4 bytes (ej: TjwA en Base64)
    gzipBuf = buf.slice(4);
  }

  // 5. Descomprimir usando GZIP
  const xmlBuffer = zlib.gunzipSync(gzipBuf);

  // 6. Retornar como texto UTF-8
  return xmlBuffer.toString('utf8');
}
```

## Consideraciones Técnicas Críticas

> [!WARNING]
> **Detección Dinámica de Cabecera**: No todas las tramas `@i_co_trama_dto` se almacenan igual. Los logs directos de los microservicios en BDD suelen ser archivos GZIP puros (`H4sI...`), mientras que transmisiones específicas de ciertos gateways empaquetan la trama con una cabecera de tamaño de 4 bytes (`TjwA...`). Intentar descomprimir un GZIP puro recortando 4 bytes o, a la inversa, un GZIP con cabecera sin recortar, generará un error `incorrect header check`. La validación del número mágico `0x1f` y `0x8b` al inicio del buffer soluciona este comportamiento.

> [!TIP]
> **Formato del Log SQL**: El log del motor de base de datos SQL Server suele duplicar las comillas simples internas cuando el texto se extrae de trazas XML. Al utilizar tramas extraídas directamente de bases de datos, verifique si requiere reemplazar comillas simples duplicadas (`''`) por comillas simples normales (`'`) antes del procesamiento.
