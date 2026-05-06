USE [master]
GO

IF OBJECT_ID('[dbo].[sp_busca]') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[sp_busca];
    PRINT '>>> Procedimiento [sp_busca] eliminado para actualización.';
END
GO

CREATE PROCEDURE [dbo].[sp_busca]
(
    @i_cadena  VARCHAR(100),
    @i_cadena2 VARCHAR(100) = NULL,
    @i_cadena3 VARCHAR(100) = NULL
)
AS
/*************************************************************************************************************************************************
    PROCESO: sp_busca (Global Server Search)
    DESCRIPCIÓN: Busca una o hasta tres cadenas de texto en todos los objetos de todas las bases de datos y en los pasos de SQL Agent Jobs.
    
    HISTORIAL DE CAMBIOS:
    FECHA           AUTOR           DESCRIPCIÓN
    -----------     ------------    ---------------------------------------------------------------------------------------------------------
    06-MAY-2026     Antigravity     Versión Global: Multi-DB + SQL Agent Jobs.
*************************************************************************************************************************************************/
BEGIN
    SET NOCOUNT ON;

    DECLARE @sql NVARCHAR(MAX);
    DECLARE @db_name NVARCHAR(128);
    
    -- Tabla temporal para consolidar resultados
    IF OBJECT_ID('tempdb..#ResultadosGlobales') IS NOT NULL DROP TABLE #ResultadosGlobales;
    CREATE TABLE #ResultadosGlobales (
        Origen NVARCHAR(255),
        Tipo NVARCHAR(50),
        Objeto NVARCHAR(255),
        FechaCreacion DATETIME,
        FechaModificacion DATETIME
    );

    -- 1. BÚSQUEDA EN TODAS LAS BASES DE DATOS
    PRINT '--- Iniciando búsqueda en todas las Bases de Datos... ---';
    
    DECLARE cur_db CURSOR LOCAL FAST_FORWARD FOR 
    SELECT name FROM sys.databases 
    WHERE state = 0 
      AND name NOT IN ('tempdb', 'model', 'msdb') -- msdb se procesa aparte para los Jobs
      AND HAS_DBACCESS(name) = 1; -- Asegurar que tenemos acceso

    OPEN cur_db;
    FETCH NEXT FROM cur_db INTO @db_name;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT '   > Buscando en: ' + @db_name;

        SET @sql = '
        INSERT INTO #ResultadosGlobales (Origen, Tipo, Objeto, FechaCreacion, FechaModificacion)
        -- Fase 1: Por Nombre de Objeto (Metadatos - Rápido)
        SELECT ''' + @db_name + ''' as Origen, type_desc, name, create_date, modify_date
        FROM [' + @db_name + '].sys.objects
        WHERE (name LIKE ''%' + @i_cadena + '%'')
          ' + ISNULL('AND (name LIKE ''%' + @i_cadena2 + '%'')', '') + '
          ' + ISNULL('AND (name LIKE ''%' + @i_cadena3 + '%'')', '') + '
        
        UNION -- Evita duplicados si coincide nombre y contenido
        
        -- Fase 2: Por Contenido (Solo en objetos con código - SPs, Vistas, FNs)
        SELECT ''' + @db_name + ''' as Origen, o.type_desc, o.name, o.create_date, o.modify_date
        FROM [' + @db_name + '].sys.sql_modules m
        INNER JOIN [' + @db_name + '].sys.objects o ON m.object_id = o.object_id
        WHERE (m.definition LIKE ''%' + @i_cadena + '%'')
          ' + ISNULL('AND (m.definition LIKE ''%' + @i_cadena2 + '%'')', '') + '
          ' + ISNULL('AND (m.definition LIKE ''%' + @i_cadena3 + '%'')', '') + '
        ';

        BEGIN TRY
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT '      !! Error en DB ' + @db_name + ': ' + ERROR_MESSAGE();
        END CATCH

        FETCH NEXT FROM cur_db INTO @db_name;
    END
    CLOSE cur_db; DEALLOCATE cur_db;

    -- 2. BÚSQUEDA EN SQL AGENT JOBS
    PRINT '--- Buscando en SQL Agent Jobs... ---';
    
    INSERT INTO #ResultadosGlobales (Origen, Tipo, Objeto, FechaCreacion, FechaModificacion)
    SELECT DISTINCT 
        'MSDB (SQL Agent Job)' as Origen,
        'JOB_STEP' as Tipo,
        J.name + ' (Step: ' + S.step_name + ')' as Objeto,
        J.date_created,
        J.date_modified
    FROM msdb.dbo.sysjobs J
    INNER JOIN msdb.dbo.sysjobsteps S ON J.job_id = S.job_id
    WHERE (S.command LIKE '%' + @i_cadena + '%')
      AND (@i_cadena2 IS NULL OR S.command LIKE '%' + @i_cadena2 + '%')
      AND (@i_cadena3 IS NULL OR S.command LIKE '%' + @i_cadena3 + '%');

    -- 3. RESULTADO FINAL
    SELECT * 
    FROM #ResultadosGlobales 
    ORDER BY Origen, Tipo, Objeto;

    PRINT '--- Búsqueda finalizada. ---';
END
GO
