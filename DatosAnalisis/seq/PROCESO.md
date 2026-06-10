# Proceso de Auditoría y Regeneración de Comprobantes en mySatcom

Este documento describe el flujo de trabajo secuencial diseñado para identificar, verificar y regenerar comprobantes electrónicos que presentan estado de error o inconsistencias (específicamente aquellos en estado `4`) y que no han sido registrados correctamente en la base de datos de producción de **SATCOM**.

---

## 📁 Organización del Directorio (`seq/`)

Para mantener el orden y facilitar el entendimiento, los archivos del directorio `c:\@Antigravity\Satcom\DatosAnalisis\seq` se han clasificado y renombrado bajo una nomenclatura lógica estricta que diferencia los procesos de los resultados:

*   **`Proceso_`**: Scripts ejecutables que realizan tareas lógicas.
*   **`Resultado_`**: Archivos de datos o consultas generados al finalizar alguna etapa del flujo.

### Listado de Archivos Organizados (Secuencia de Flujo)

| Nombre del Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| **[Proceso_01_ValidaErrorSeqBDD.js](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Proceso_01_ValidaErrorSeqBDD.js)** | Proceso | Script de Node.js que procesa los archivos CSV de logs para identificar los comprobantes candidatos y generar el script de validación SQL. |
| **[Resultado_01_verificar_comprobantes.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_01_verificar_comprobantes.sql)** | Resultado / Insumo | Script SQL de verificación generado por el *Proceso 1*. Contiene la tabla temporal `#TempExiste` con los candidatos para depurar en la base de datos real. |
| **[Resultado_02_Comprobantes_Faltantes.txt](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_02_Comprobantes_Faltantes.txt)** | Resultado / Insumo | Listado depurado de comprobantes que realmente no existen en la BDD. Se copia desde SSMS en el *Paso 4* y sirve de entrada para el *Paso 6*. |
| **[Proceso_02_generar_fix_inserts.js](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Proceso_02_generar_fix_inserts.js)** | Proceso | Script de Node.js que lee los comprobantes faltantes del *Resultado 2*, extrae los logs del SP en los CSV de logs, descomprime las tramas GZIP y genera el script SQL correctivo. |
| **[Resultado_03_ScriptFixInsert.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_03_ScriptFixInsert.sql)** | Resultado | Script SQL correctivo final generado con las sentencias `EXEC` listas con las tramas XML descomprimidas para producción. |
| **`*.csv` (Logs Operativos)** | Insumo | Archivos de logs de transacciones extraídos en rangos horarios específicos (ej. `0930-1030.csv`, etc.). |

> [!NOTE]
> Los archivos obsoletos `ValidaErrorSeqBDD.ps1` y `decode_trama.js` han sido eliminados de la carpeta para evitar confusiones y mantener el entorno limpio.

---

## 🔄 Flujo de Trabajo Paso a Paso (6 Pasos)

Siga este orden estricto de pasos para llevar a cabo la auditoría y regularización de comprobantes:

### Paso 1: Limpieza del Script de Verificación SQL
**Borrar por completo el contenido** del archivo **[Resultado_01_verificar_comprobantes.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_01_verificar_comprobantes.sql)** para garantizar que no existan sentencias residuales de ejecuciones previas.

---

### Paso 2: Escaneo de Logs y Generación de Sentencias SQL
Abra una consola o terminal en su sistema y ejecute el script de Node.js:
```bash
node c:\@Antigravity\Satcom\DatosAnalisis\seq\Proceso_01_ValidaErrorSeqBDD.js
```
*   **Resultado:** Este script lee todos los archivos `.csv` de logs de errores del directorio, extrae los comprobantes candidatos y vuelve a llenar el archivo **[Resultado_01_verificar_comprobantes.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_01_verificar_comprobantes.sql)** con las cargas y consultas necesarias.

---

### Paso 3: Carga de Comprobantes candidatos en SQL Server
1. Abra el archivo generado **[Resultado_01_verificar_comprobantes.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_01_verificar_comprobantes.sql)** en su cliente SQL Server Management Studio (SSMS).
2. Conéctese a la base de datos de producción de **SATCOM** y ejecute el script completo.
3. El script creará la tabla temporal `#TempExiste`, cargará los candidatos y eliminará los registros que ya existan físicamente en producción.

---

### Paso 4: Extracción y Validación de Faltantes Reales
En la **misma sesión** de SSMS donde ejecutó el Paso 3, ejecute la siguiente consulta para obtener el listado final detallado:
```sql
select T.*, DescripcionEstatus, em_nemonico, em_pais
from #TempExiste T 
inner join sat_catalogo.dbo.sc_vista_estados_documentos on CodigoEstatus=co_estatus
inner join sat_catalogo..sc_emisor on em_id_emisor = co_id_emisor;
--where em_pais <> 507;
```

---

### Paso 5: Registro de Datos de Entrada (Insumo)
1. Copie el resultado de la cuadrícula de SSMS (haciendo clic derecho y seleccionando **Copy with Headers** / *Copiar con encabezados*).
2. Pegue el contenido íntegro (incluyendo la cabecera de las columnas) dentro del archivo **[Resultado_02_Comprobantes_Faltantes.txt](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_02_Comprobantes_Faltantes.txt)** y guarde el archivo.

---

### Paso 6: Generación del Script de Regularización Correctivo
Vuelva a su terminal y ejecute el script de generación final:
```bash
node c:\@Antigravity\Satcom\DatosAnalisis\seq\Proceso_02_generar_fix_inserts.js
```
*   **Resultado:** Este script lee la lista de faltantes de `Resultado_02_Comprobantes_Faltantes.txt`, busca sus llamadas en los logs CSV, descomprime las tramas binarias GZIP, reemplaza el estatus de error por `20`, anula las tramas binarias innecesarias, aplica control de idempotencia `IF NOT EXISTS` y escribe el script final de regularización en **[Resultado_03_ScriptFixInsert.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_03_ScriptFixInsert.sql)**.

---

## 🚀 Ejecución en Producción
Una vez generado el archivo **[Resultado_03_ScriptFixInsert.sql](file:///c:/@Antigravity/Satcom/DatosAnalisis/seq/Resultado_03_ScriptFixInsert.sql)**, revise que las tramas XML estén en texto plano legible, y ejecute el script en producción para regularizar las transacciones.
