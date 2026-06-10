const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Configuración de rutas
const seqDir = 'c:/@Antigravity/Satcom/DatosAnalisis/seq';
const inputFile = path.join(seqDir, 'Resultado_02_Comprobantes_Faltantes.txt');
const outputFile = path.join(seqDir, 'Resultado_03_ScriptFixInsert.sql');

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('es-EC')}] ${msg}`);
}

function decompressTrama(tramaRaw) {
  if (!tramaRaw.startsWith('gzip:')) {
    return tramaRaw;
  }
  const base64Str = tramaRaw.substring(5).trim();
  const buf = Buffer.from(base64Str, 'base64');
  
  // Detectar si empieza con el número mágico de GZIP: 1f 8b
  let gzipBuf;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    gzipBuf = buf;
  } else {
    gzipBuf = buf.slice(4);
  }
  
  const xmlBuffer = zlib.gunzipSync(gzipBuf);
  return xmlBuffer.toString('utf8');
}

function main() {
  log('Iniciando proceso de regeneración de scripts...');

  if (!fs.existsSync(inputFile)) {
    log(`ERROR: El archivo de entrada no existe: ${inputFile}`);
    process.exit(1);
  }

  // 1. Leer y parsear el archivo ProcesarScriptsphis_crear_comprobante.txt
  const inputContent = fs.readFileSync(inputFile, 'utf8');
  const lines = inputContent.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    log('ERROR: El archivo de entrada está vacío.');
    process.exit(1);
  }

  // Parsear cabecera para identificar columnas
  const header = lines[0].split('\t');
  const idColIdx = header.indexOf('co_id_comprobante');
  const statusColIdx = header.indexOf('co_estatus');

  if (idColIdx === -1 || statusColIdx === -1) {
    log('ERROR: No se encontraron las columnas necesarias en la cabecera (co_id_comprobante, co_estatus).');
    process.exit(1);
  }

  // Extraer comprobantes con co_estatus = 4
  const targetIds = new Set();
  const idMetadataMap = new Map(); // Para rastrear detalles de los comprobantes

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length <= Math.max(idColIdx, statusColIdx)) continue;

    const id = cols[idColIdx].trim();
    const status = cols[statusColIdx].trim();

    if (status === '4') {
      targetIds.add(id);
      idMetadataMap.set(id, {
        id,
        num: cols[header.indexOf('co_num_comprobante')] || 'Desconocido',
        emisor: cols[header.indexOf('co_id_emisor')] || 'Desconocido',
        nemonico: cols[header.indexOf('em_nemonico')] || 'Desconocido'
      });
    }
  }

  log(`Comprobantes con estado 4 a procesar: ${targetIds.size}`);
  if (targetIds.size === 0) {
    log('No hay comprobantes con estado 4 para procesar. Fin del proceso.');
    process.exit(0);
  }

  // 2. Obtener lista de archivos .csv en el directorio
  const files = fs.readdirSync(seqDir);
  const csvFiles = files
    .filter(file => file.toLowerCase().endsWith('.csv'))
    .map(file => path.join(seqDir, file));

  log(`Archivos CSV de logs encontrados para buscar: ${csvFiles.length}`);

  const results = new Map(); // Mapa de co_id_comprobante -> script SQL modificado

  // 3. Buscar logs de SP en cada archivo CSV
  for (const csvPath of csvFiles) {
    if (targetIds.size === results.size) {
      log('Se han encontrado todos los comprobantes. Deteniendo la búsqueda.');
      break;
    }

    const baseName = path.basename(csvPath);
    log(`Buscando en: ${baseName} (Tamaño: ${(fs.statSync(csvPath).size / 1024 / 1024).toFixed(2)} MB)...`);

    const fileContent = fs.readFileSync(csvPath, 'utf8');

    for (const targetId of targetIds) {
      if (results.has(targetId)) continue; // Ya lo encontramos antes

      // Buscar el ID del comprobante en la llamada
      const searchStr = `@i_co_id_comprobante='${targetId}'`;
      const posId = fileContent.indexOf(searchStr);

      if (posId !== -1) {
        log(`  -> Encontrado comprobante ${targetId} en ${baseName}`);

        // Encontrar el inicio de la llamada al SP (sphis_crear_comprobante)
        const spName = 'sphis_crear_comprobante';
        let startIdx = fileContent.lastIndexOf(spName, posId);

        if (startIdx === -1) {
          log(`  [ADVERTENCIA] No se pudo encontrar el inicio del SP para ${targetId}`);
          continue;
        }

        // Si hay un prefijo como "sat_comprobante..", incluirlo
        const prefixCheck = fileContent.substring(startIdx - 16, startIdx);
        if (prefixCheck.includes('sat_comprobante..')) {
          startIdx = startIdx - (prefixCheck.length - prefixCheck.indexOf('sat_comprobante..'));
        }

        // Buscar el final de la llamada al SP.
        // La llamada termina donde termina la trama_dto, que es el último parámetro.
        // Buscamos "@i_co_trama_dto='gzip:" después de la posición del ID
        const tramaDtoIdx = fileContent.indexOf("@i_co_trama_dto='gzip:", posId);
        if (tramaDtoIdx === -1) {
          log(`  [ADVERTENCIA] No se pudo encontrar la trama_dto para ${targetId}`);
          continue;
        }

        // El final del parámetro es la comilla simple que cierra el base64 de la trama.
        // Dado que la trama contiene caracteres base64 seguros, buscamos la primera comilla simple después de "gzip:"
        const closingQuoteIdx = fileContent.indexOf("'", tramaDtoIdx + "@i_co_trama_dto='gzip:".length);
        if (closingQuoteIdx === -1) {
          log(`  [ADVERTENCIA] No se pudo encontrar el cierre de trama_dto para ${targetId}`);
          continue;
        }

        // Extraer la llamada completa
        let spCall = fileContent.substring(startIdx, closingQuoteIdx + 1);

        // Limpiar comillas dobles duplicadas al inicio y al final si las hay
        if (spCall.startsWith('"')) spCall = spCall.substring(1);
        if (spCall.endsWith('"')) spCall = spCall.substring(0, spCall.length - 1);

        // 4. Modificar parámetros:
        // - Reemplazar @i_co_trama_entrada y @i_co_trama_autorizado por Null
        // - Descomprimir y escapar la @i_co_trama_dto
        let modifiedCall = spCall;
        
        // Reemplazar trama de entrada de forma no codiciosa hasta el siguiente parámetro
        modifiedCall = modifiedCall.replace(
          /@i_co_trama_entrada\s*=\s*[\s\S]*?(?=,\s*@i_|$)/gi,
          '@i_co_trama_entrada=Null'
        );

        // Reemplazar trama autorizada de forma no codiciosa hasta el siguiente parámetro
        modifiedCall = modifiedCall.replace(
          /@i_co_trama_autorizado\s*=\s*[\s\S]*?(?=,\s*@i_|$)/gi,
          '@i_co_trama_autorizado=Null'
        );

        // Descomprimir la trama_dto y colocarla como XML plano (con comillas simples escapadas para T-SQL)
        const tramaDtoRegex = /@i_co_trama_dto\s*=\s*'+gzip:([^']+)'+/i;
        const match = modifiedCall.match(tramaDtoRegex);
        if (match) {
          const tramaGzip = 'gzip:' + match[1];
          try {
            let decompressedXml = decompressTrama(tramaGzip).trim();
            // Si la trama descomprimida inicia y termina con comilla simple, removerlas
            if (decompressedXml.startsWith("'") && decompressedXml.endsWith("'")) {
              decompressedXml = decompressedXml.substring(1, decompressedXml.length - 1).trim();
            }
            // Escapar comillas simples duplicándolas (' -> '') para que sea un string SQL válido
            const escapedXml = decompressedXml.replace(/'/g, "''");
            modifiedCall = modifiedCall.replace(
              tramaDtoRegex,
              `@i_co_trama_dto='${escapedXml}'`
            );
          } catch (err) {
            log(`  [ERROR] No se pudo descomprimir la trama_dto para ${targetId}: ${err.message}`);
          }
        }

        // Reemplazar @i_co_estatus por '20' sin importar el valor original
        modifiedCall = modifiedCall.replace(
          /@i_co_estatus\s*=\s*('[^']+'|Null)/gi,
          "@i_co_estatus='20'"
        );

        // Agregar prefijo EXEC si no lo tiene
        if (!/^\s*EXEC\s+/i.test(modifiedCall)) {
          // Si comienza con un nombre de base de datos o esquema, o directamente con sat_comprobante
          modifiedCall = `EXEC ${modifiedCall.trim()}`;
        }

        results.set(targetId, modifiedCall);
      }
    }
  }

  // 5. Escribir resultados en ScriptFixInsert.sql
  log('Generando archivo SQL con resultados...');
  
  const sqlLines = [];
  sqlLines.push('-- ==========================================================================');
  sqlLines.push('-- SCRIPT DE REGENERACIÓN DE COMPROBANTES CON ESTADO 4 (sphis_crear_comprobante)');
  sqlLines.push(`-- Generado el: ${new Date().toLocaleString('es-EC')}`);
  sqlLines.push(`-- Origen de datos: ${path.basename(inputFile)}`);
  sqlLines.push('-- ==========================================================================\n');
  sqlLines.push('USE [sat_comprobante];\nGO\n');

  let foundCount = 0;
  let missingCount = 0;

  for (const targetId of targetIds) {
    const meta = idMetadataMap.get(targetId);
    if (results.has(targetId)) {
      sqlLines.push(`-- Comprobante ID: ${targetId} | Emisor: ${meta.emisor} (${meta.nemonico}) | Secuencia: ${meta.num}`);
      sqlLines.push(`IF NOT EXISTS (SELECT 1 FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK) WHERE co_id_comprobante = '${targetId}')`);
      sqlLines.push('BEGIN');
      
      // Tabular el comando SQL para mejorar la legibilidad y estética
      const tabulatedCall = results.get(targetId)
        .split('\n')
        .map(line => '    ' + line)
        .join('\n');
        
      sqlLines.push(tabulatedCall);
      sqlLines.push('END');
      sqlLines.push('ELSE');
      sqlLines.push('BEGIN');
      sqlLines.push(`    PRINT '>>> El comprobante ${targetId} ya existe en com_log_comprobante_xml. Se omite insercion.'`);
      sqlLines.push('END');
      sqlLines.push('GO\n');
      foundCount++;
    } else {
      sqlLines.push(`-- [ERROR] NO ENCONTRADO EN LOGS: Comprobante ID: ${targetId} | Emisor: ${meta.emisor} (${meta.nemonico}) | Secuencia: ${meta.num}\n`);
      missingCount++;
    }
  }

  // Generar listado final con los co_id_comprobante encontrados
  sqlLines.push('-- ==========================================================================');
  sqlLines.push('-- LISTADO DE COMPROBANTES PROCESADOS (co_id_comprobante)');
  sqlLines.push(`-- Total encontrados: ${foundCount}`);
  sqlLines.push('-- ==========================================================================');
  
  const processedIds = [];
  for (const targetId of targetIds) {
    if (results.has(targetId)) {
      processedIds.push(`'${targetId}'`);
    }
  }
  if (processedIds.length > 0) {
    const joinedIds = processedIds.join(', ');
    sqlLines.push(`select * from sat_comprobante.dbo.com_log_comprobante_xml  where co_id_comprobante in  (${joinedIds})`);
    sqlLines.push(`--delete sat_comprobante.dbo.com_log_comprobante_xml  where co_id_comprobante in  (${joinedIds})`);
  }
  
  sqlLines.push('-- ==========================================================================\n');

  fs.writeFileSync(outputFile, sqlLines.join('\n'), 'utf8');

  // Eliminar archivo temporal en scratch si existe
  const tempFile = 'c:/@Antigravity/Satcom/scratch/decode_trama.js';
  if (fs.existsSync(tempFile)) {
    try {
      fs.unlinkSync(tempFile);
      log(`Archivo temporal eliminado: ${tempFile}`);
    } catch (e) {
      log(`[ADVERTENCIA] No se pudo eliminar el archivo temporal: ${e.message}`);
    }
  }

  log(`Proceso finalizado.`);
  log(`  -> Encontrados y regenerados: ${foundCount}`);
  log(`  -> No encontrados en logs: ${missingCount}`);
  log(`  -> Archivo generado en: ${outputFile}`);
}

main();
