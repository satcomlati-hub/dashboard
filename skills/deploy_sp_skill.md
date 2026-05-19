# Estándar de Logueo SQL (SATCOM)

## Descripción General
Esta habilidad define el patrón estándar para implementar logs detallados y asegurar la limpieza absoluta de los scripts en los Procedimientos Almacenados (SPs) dentro del proyecto SATCOM. Asegura un seguimiento consistente y scripts listos para ejecución inmediata.

## 0. Limpieza y Preparación de Código (OBLIGATORIO)
Antes de realizar cualquier modificación, el código debe ser saneado de metadatos provenientes de herramientas como `sp_helptext` o capturas de consola:
- **Limpieza de Encabezados**: Eliminar la palabra `Text` y las líneas de guiones separadores (`-------`) que aparecen al inicio.
- **Limpieza de Pie de Página**: Eliminar marcas de tiempo de finalización (`Completion time: ...`).
- **Contexto de Base de Datos**: Es **OBLIGATORIO** incluir la instrucción `USE [Nombre_BDD]` al inicio del archivo. El nombre de la base de datos se debe inferir del nombre del archivo (ej: si el archivo es `sat_comprobante.sp_ejemplo.sql`, la instrucción debe ser `USE [sat_comprobante]`).
- **Scripts Listos**: El resultado final debe ser un script SQL válido y limpio, listo para ser ejecutado en una ventana de comandos de SQL Server Management Studio.

## Filosofía de Modificación: Cambios Sutiles
Al interactuar con Procedimientos Almacenados existentes, se debe priorizar la **intervención mínima**:
- **Sutileza**: Los cambios deben integrarse de forma natural y respetar la estructura original del código del usuario.
- **Refactorización Restringida**: No se debe reestructurar el código, cambiar convenciones de nombres o alterar la lógica de flujo principal a menos que se solicite explícitamente una **refactorización**.
- **Impacto Mínimo**: El objetivo es cumplir con los estándares (como la adición de logs) afectando lo menos posible la legibilidad y el estilo original del autor.

## Patrón de Implementación

### 1. Estructura de Despliegue e Idempotencia (Backup)
Antes de crear o modificar cualquier procedimiento, se debe asegurar que el script preserve una copia de la versión original del día en el motor de base de datos.

```sql
IF OBJECT_ID('[dbo].[NombreSP]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'NombreSP_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy (preservamos la primera versión del día)
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'NombreSP', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[NombreSP];
    END
END
GO
CREATE PROCEDURE [dbo].[NombreSP]
...
```

### 1. Encabezado y Declaración de Variables
Al inicio del procedimiento (después de `SET NOCOUNT ON`), declare las variables necesarias para el seguimiento del tiempo y el logueo.

```sql
    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX); -- Para conteo de filas o errores

    -- LOG EJECUTIVO: Construir la cadena para poder replicar la ejecución exacta
    -- Para parámetros numéricos: ISNULL(CAST(@P AS VARCHAR), 'NULL')
    -- Para parámetros de texto: ISNULL('''' + @P + '''', 'NULL')
    SET @params = 'EXEC [dbo].[' + @NombreSP + '] ' +
                  '@i_id_emisor = ' + ISNULL(CAST(@i_id_emisor AS VARCHAR), 'NULL') + ', ' +
                  '@i_punto = ' + ISNULL('''' + @i_punto + '''', 'NULL');

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';
```

### 2. Seguimiento de Progreso (PRINT)
Utilice sentencias `PRINT` con indentación y marcas de tiempo para los bloques lógicos principales.

```sql
    PRINT '1. [Nombre del Paso] - Procesamiento iniciado...';
    -- ... Lógica ...
    PRINT '   Registros procesados: ' + CAST(@@ROWCOUNT AS VARCHAR);
```

### 3. Logueo de Iteraciones (Dentro de Bucles)
Si procesa múltiples entidades (ej. países o emisores), registre el inicio y fin de cada iteración.

```sql
    DECLARE @inicio_iter DATETIME = GETDATE();
    PRINT '--- Inicio Sub-proceso: ' + @IdEntity + ' [' + CONVERT(VARCHAR, @inicio_iter, 120) + '] ---';

    -- ... Lógica de Iteración ...

    DECLARE @fin_iter DATETIME = GETDATE();
    PRINT '--- Fin Sub-proceso: ' + @IdEntity + ' [Duración: ' + CAST(DATEDIFF(SECOND, @inicio_iter, @fin_iter) AS VARCHAR) + 's] ---';
```

### 4. Manejo de Errores y Alertas (OBLIGATORIO para SPs)
**Nota:** Este paso es obligatorio para todos los Procedimientos Almacenados. Los scripts directos (.sql de ejecución única) no requieren esta estructura a menos que sea necesario.

Todo SP debe incluir un bloque `TRY...CATCH` que invoque a `spct_insertar_alerta_postgres` en caso de fallo para asegurar la trazabilidad en el dashboard de monitoreo.

```sql
BEGIN TRY
    -- ... Toda la lógica del SP va aquí ...

    -- 1. Capturar el número de filas del proceso principal (inmediatamente después del SELECT/UPDATE/INSERT)
    SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
        
END TRY
BEGIN CATCH
    DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
    
    -- Formatear error para el log de auditoría
    SET @error_msg = 'rows:Error - ' + @ErrorMessage;

    -- ALERTA OBLIGATORIA A POSTGRES EN CASO DE ERROR (Dashboard de Monitoreo)
    EXEC [master].[dbo].[spct_insertar_alerta_postgres]
        @severity = 'Error',
        @process = @NombreSP,
        @message = @ErrorMessage;

    PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
    THROW; 
END CATCH

    -- Log de Auditoría Final
    SET @fin = GETDATE();
    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'BATCH',
        @i_lc_emisor    = @i_id_emisor,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;
```

### 5. Integración de Log de Auditoría (spco_crear_log_consulta)
Invoque el procedimiento de logueo central al finalizar el proceso o después de unidades de trabajo significativas.

```sql
    EXEC sat_comprobante.dbo.spco_crear_log_consulta 
        @NombreSP,    -- Nombre del Procedimiento
        'BDD',        -- Origen
        'BATCH',      -- Categoría
        @Identifier,  -- ID Relevante
        @params,      -- Parámetros capturados
        null,         -- Contexto Adicional/JSON
        @inicio,      -- Inicio
        @fin,         -- Fin
        0,            -- Estado (0: Éxito, 1: Error)
        null;         -- Info Extra
```

### 6. Conclusión del Proceso
```sql
    SET @fin = GETDATE();
    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
```

## Restricciones Técnicas Críticas (T-SQL)

Para evitar errores de sintaxis comunes (**Msg 102**):

> [!CAUTION]
> **ERROR FATAL (Msg 102) - Funciones en Parámetros**: T-SQL prohíbe pasar funciones directamente como valores de parámetros en una instrucción `EXEC`. Esto generará un error de sintaxis inmediato.
> - **INCORRECTO**: `EXEC sp_log @fin = GETDATE();` -> ❌ **ERROR**
> - **CORRECTO**: 
>   ```sql
>   DECLARE @fin DATETIME = GETDATE();
>   EXEC sp_log @fin = @fin; -- ✅ FUNCIONA
>   ```

> [!TIP]
> **Concatenación de Parámetros**: Utilice siempre `CONCAT()` para armar la variable `@params`. Esto evita que la cadena completa se convierta en `NULL` si alguno de los parámetros de entrada es nulo.

## 7. Estética y Legibilidad de Consultas (NUEVO)
Para facilitar las comparaciones en Git y mejorar la legibilidad, todas las consultas `SELECT` e `INSERT` deben listar sus columnas **una por línea**:
- **Correcto**:
  ```sql
  INSERT INTO Tabla (
      ColumnaA,
      ColumnaB,
      ColumnaC
  )
  SELECT
      ValorA,
      ValorB,
      ValorC
  FROM Origen;
  ```
- **Incorrecto**:
  ```sql
  INSERT INTO Tabla (ColumnaA, ColumnaB, ColumnaC) SELECT ValorA, ValorB, ValorC FROM Origen;
  ```
