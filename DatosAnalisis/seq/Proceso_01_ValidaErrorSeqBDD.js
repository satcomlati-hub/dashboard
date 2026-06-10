// Proceso_01_ValidaErrorSeqBDD.js
const fs = require('fs');
const path = require('path');

const directoryPath = 'c:/@Antigravity/Satcom/DatosAnalisis/seq';
const outputPath = path.join(directoryPath, 'Resultado_01_verificar_comprobantes.sql');

console.log('Iniciando procesamiento de múltiples archivos CSV con Node.js...');

if (!fs.existsSync(directoryPath)) {
  console.error(`Error: El directorio no existe en ${directoryPath}`);
  process.exit(1);
}

// Obtener todos los archivos CSV del directorio
const files = fs.readdirSync(directoryPath);
const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));

if (csvFiles.length === 0) {
  console.error(`Error: No se encontraron archivos CSV en el directorio ${directoryPath}`);
  process.exit(1);
}

console.log(`Se encontraron ${csvFiles.length} archivos CSV en el directorio:`, csvFiles);

// (Se eliminó la lógica de exclusiones locales para analizar todos los comprobantes)

// 2. Función para parsear el CSV contemplando multilíneas entre comillas dobles
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = [];
  let currentRecord = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentRecord += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      records.push(currentRecord);
      currentRecord = '';
    } else {
      currentRecord += char;
    }
  }
  if (currentRecord.trim()) {
    records.push(currentRecord);
  }
  return records;
}

try {
  const numComprobanteRegex = /@i_co_num_comprobante\s*=\s*('[^']*'|Null|[^\s,]+)/i;
  const idEmisorRegex = /@i_co_id_emisor\s*=\s*('[^']*'|Null|[^\s,]+)/i;
  const tipoDocRegex = /@i_co_codigo_tipo_documento\s*=\s*('[^']*'|Null|[^\s,]+)/i;
  const idComprobanteRegex = /@i_co_id_comprobante\s*=\s*('[^']*'|Null|[^\s,]+)/i;
  const estatusRegex = /@i_co_estatus\s*=\s*('[^']*'|Null|[^\s,]+)/i;
  
  const sqlActive4 = [];
  const sqlCommented = [];
  const sqlOthers = [];
  
  let totalProcessedRecords = 0;
  let sampleCSVKeys = [];
  
  // Set global para controlar duplicados de comprobantes vistos con estado 4 o 14 a lo largo de todos los archivos
  const seenComprobantes = new Set();
  
  // Procesar cada archivo CSV encontrado
  for (const csvFile of csvFiles) {
    const csvFilePath = path.join(directoryPath, csvFile);
    console.log(`Procesando archivo: ${csvFile}...`);
    
    const records = parseCSV(csvFilePath);
    console.log(`- Leídos ${records.length} registros del archivo ${csvFile}.`);
    
    // Omitimos la primera línea de cada archivo (cabecera "SP")
    for (let i = 1; i < records.length; i++) {
      const record = records[i];
      if (!record.trim()) continue;
      
      const numComprobanteMatch = record.match(numComprobanteRegex);
      const idEmisorMatch = record.match(idEmisorRegex);
      const tipoDocMatch = record.match(tipoDocRegex);
      const idComprobanteMatch = record.match(idComprobanteRegex);
      const estatusMatch = record.match(estatusRegex);
      
      if (numComprobanteMatch && idEmisorMatch && tipoDocMatch) {
        const numComprobante = numComprobanteMatch[1];
        const idEmisor = idEmisorMatch[1];
        const tipoDoc = tipoDocMatch[1];
        const idComprobante = idComprobanteMatch ? idComprobanteMatch[1] : 'Null';
        const estatus = estatusMatch ? estatusMatch[1] : 'Null';
        
        // Limpiar comillas simples y espacios para la comparación
        const cleanEmisor = idEmisor.replace(/'/g, '').trim();
        const cleanNum = numComprobante.replace(/'/g, '').trim();
        const cleanTipo = tipoDoc.replace(/'/g, '').trim();
        const cleanEstatus = estatus.replace(/'/g, '').trim();
        
        const key = `${cleanEmisor}|${cleanNum}|${cleanTipo}`.toLowerCase();
        
        if (sampleCSVKeys.length < 5) {
          sampleCSVKeys.push(key);
        }
        
        // (Filtrado de exclusiones deshabilitado)
        
        // Control de prioridad y comentarios
        let shouldComment = false;
        
        // Si el estado es 14, se incluye comentado
        if (cleanEstatus === '14') {
          shouldComment = true;
        }
        
        // Si ya existe una línea con estado 4 o 14 previamente procesada en cualquiera de los CSV
        if (seenComprobantes.has(key)) {
          shouldComment = true;
        }
        
        // Registrar que hemos visto este comprobante con estado 4 o 14
        if (cleanEstatus === '4' || cleanEstatus === '14') {
          seenComprobantes.add(key);
        }
        
        // Construir la sentencia SQL usando select directo de valores
        let sqlLine = '';
        if (shouldComment) {
          sqlLine = `--insert into #TempExiste (co_id_comprobante, co_estatus, co_id_emisor, co_num_comprobante, co_codigo_tipo_documento)\n--select ${idComprobante}, ${estatus}, ${idEmisor}, ${numComprobante}, ${tipoDoc};`;
          sqlCommented.push(sqlLine);
        } else {
          sqlLine = `insert into #TempExiste (co_id_comprobante, co_estatus, co_id_emisor, co_num_comprobante, co_codigo_tipo_documento)\nselect ${idComprobante}, ${estatus}, ${idEmisor}, ${numComprobante}, ${tipoDoc};`;
          if (cleanEstatus === '4') {
            sqlActive4.push(sqlLine);
          } else {
            sqlOthers.push(sqlLine);
          }
        }
        totalProcessedRecords++;
      }
    }
  }
  
  console.log('Muestra de las primeras 5 claves procesadas de los CSV:', sampleCSVKeys);
  
  // Unir todas las líneas del script respetando la prioridad
  const sqlLines = [];
  
  // 1. Cabecera con la tabla temporal ajustada
  sqlLines.push(`if object_id('tempdb..#TempExiste') is not null drop table #TempExiste;\n\nselect top 0 co_id_comprobante, co_estatus, co_id_emisor, co_num_comprobante, co_codigo_tipo_documento into #TempExiste from sat_comprobante.dbo.com_log_comprobante_xml with(nolock);`);
  
  // 2. Inserts activos de estado 4 (van primero / arriba)
  if (sqlActive4.length > 0) {
    sqlLines.push(...sqlActive4);
  }
  
  // 3. Otros inserts activos (si los hubiera)
  if (sqlOthers.length > 0) {
    sqlLines.push(...sqlOthers);
  }
  
  // 4. Inserts comentados (estado 14 o duplicados)
  if (sqlCommented.length > 0) {
    sqlLines.push(...sqlCommented);
  }
  
  // 5. Bloque final de depuración y comprobación de faltantes reales
  sqlLines.push(`-- ======================================================
-- DEPURACIÓN Y VERIFICACIÓN DE COMPROBANTES FALTANTES
-- ======================================================

-- 1. Estado inicial de la tabla temporal
select top 1 * from #TempExiste;
select count(1) as CantidadInicial from #TempExiste;

-- 2. Eliminar de #TempExiste los comprobantes que ya existen físicamente en la tabla real
delete t
from #TempExiste t
inner join sat_comprobante.dbo.com_log_comprobante_xml x with(nolock)
  on t.co_id_emisor = x.co_id_emisor
  and t.co_num_comprobante = x.co_num_comprobante
  and t.co_codigo_tipo_documento = x.co_codigo_tipo_documento;

-- 3. Estado final (estos son los comprobantes que realmente faltan)
select count(1) as CantidadFaltantesRealmente from #TempExiste;
select * from #TempExiste;


select count(1), co_estatus, DescripcionEstatus
from #TempExiste inner join sat_catalogo.dbo.sc_vista_estados_documentos on CodigoEstatus=co_estatus
group by co_estatus, DescripcionEstatus 
order by 1 desc

select count(1), co_estatus, DescripcionEstatus, em_nemonico, em_pais
from #TempExiste inner join sat_catalogo.dbo.sc_vista_estados_documentos on CodigoEstatus=co_estatus
inner join sat_catalogo..sc_emisor on em_id_emisor = co_id_emisor
group by co_estatus, DescripcionEstatus , em_nemonico, em_pais
order by 1 desc`);
  
  fs.writeFileSync(outputPath, sqlLines.join('\n\n'), 'utf-8');
  
  console.log(`\n======================================================`);
  console.log(`PROCESAMIENTO GLOBAL COMPLETADO CON ÉXITO.`);
  console.log(`Archivos CSV procesados: ${csvFiles.length}`);
  console.log(`Registros analizados en total: ${totalProcessedRecords}`);
  console.log(`Sentencias SQL generadas: ${sqlLines.length - 1}`);
  console.log(`  - Activos Estado 4 (Arriba): ${sqlActive4.length}`);
  console.log(`  - Otros Activos: ${sqlOthers.length}`);
  console.log(`  - Comentados (Estado 14 o Duplicados): ${sqlCommented.length}`);
  console.log(`Resultado guardado en: ${outputPath}`);
  console.log(`======================================================`);
  
} catch (err) {
  console.error('Error durante el procesamiento:', err);
}
