USE [sat_comprobante]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =====================================================================
-- 1. ESTRUCTURA DE DESPLIEGUE E IDEMPOTENCIA (BACKUP)
-- =====================================================================
IF OBJECT_ID('[dbo].[spco_get_comprobantes_full]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spco_get_comprobantes_full_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spco_get_comprobantes_full', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spco_get_comprobantes_full];
    END
END
GO

-- =====================================================================
-- 2. DEFINICIÓN DEL PROCEDIMIENTO
-- =====================================================================
CREATE PROCEDURE [dbo].[spco_get_comprobantes_full]             
    @i_estatus varchar(500),          -- Estados para consulta                  
    @i_max_consulta int = 100,        -- Numero de filas a retornar                  
    @i_pais smallint = null,                  
    @i_id_emisor varchar(max) = null,                   
    @i_ids_comprobantes varchar(max) = null,                  
    @i_horas_x_reproceso int = 1,     -- Horas antes de un nuevo reproceso                  
    @i_dias_x_reproceso int = 20,     -- Dias para seguir re procesando                  
    @i_procesos varchar(200) = 'Consulta',                  
    @i_trama_dto bit = 0,                  
    @i_trama_in bit = 0,                  
    @i_fecha_inicio datetime = null,                  
    @i_fecha_fin datetime = null,                  
    @i_num_reprocesos int = 10,
    @i_control_ejecucion bit = 1                
AS
BEGIN                    
    SET NOCOUNT ON;

    -- CONTROL DE EMERGENCIA BDD
    DECLARE @aux_emergencia_1 VARCHAR(100), @aux_emergencia_2 VARCHAR(100);
    EXEC sat_catalogo.dbo.sp_get_valor_variable_app 'emergencia_bdd', @aux_emergencia_1 OUT, @aux_emergencia_2 OUT, 'false';
    IF UPPER(LTRIM(RTRIM(ISNULL(@aux_emergencia_1, '')))) IN ('SI', 'TRUE')
    BEGIN
        PRINT '>>> CONTROL DE EMERGENCIA BDD ACTIVO: Se cancela la ejecucion de spco_get_comprobantes_full.';
        RETURN 0;
    END

    -- AISLAMIENTO: READ UNCOMMITTED para evitar bloqueos y mejorar throughput (No transaccional para lectura)
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX); 
    DECLARE @id_ejecucion VARCHAR(50) = CAST(NEWID() AS VARCHAR(50));
    DECLARE @res_lock INT; -- Resultado del AppLock

    -- 1. CONSTRUCCIÓN DE PARÁMETROS PARA AUDITORÍA
    SET @params = 'EXEC [dbo].[spco_get_comprobantes_full] ';
    SET @params = @params + '@i_estatus=' + ISNULL('''' + @i_estatus + '''', 'NULL') + ', ';
    SET @params = @params + '@i_max_consulta=' + ISNULL(CAST(@i_max_consulta AS VARCHAR(20)), '100') + ', ';
    SET @params = @params + '@i_pais=' + ISNULL(CAST(@i_pais AS VARCHAR(20)), 'NULL') + ', ';
    SET @params = @params + '@i_id_emisor=' + ISNULL('''' + @i_id_emisor + '''', 'NULL') + ', ';
    SET @params = @params + '@i_horas_x_reproceso=' + ISNULL(CAST(@i_horas_x_reproceso AS VARCHAR(20)), '1') + ', ';
    SET @params = @params + '@i_procesos=' + ISNULL('''' + @i_procesos + '''', 'NULL') + ', ';
    SET @params = @params + '@i_num_reprocesos=' + ISNULL(CAST(@i_num_reprocesos AS VARCHAR(20)), '10') + ', ';
    SET @params = @params + '@i_control_ejecucion=' + ISNULL(CAST(@i_control_ejecucion AS VARCHAR(20)), '1');

    -- 2. LOG DE INICIO (Auditoría previa)
    -- Nota: @i_lc_emisor es INT en spco_crear_log_consulta
    DECLARE @idEmisorLog INT = CASE WHEN ISNUMERIC(@i_id_emisor) = 1 THEN CAST(@i_id_emisor AS INT) ELSE NULL END;

    EXEC sat_comprobante.dbo.spco_crear_log_consulta 
        @i_lc_nombre_sp = @NombreSP, 
        @i_lc_appname = 'BATCH-START', 
        @i_lc_emisor = @idEmisorLog, 
        @i_lc_parametros = @params, 
        @i_lc_origen = 'BDD', 
        @i_lc_inicio = @inicio, 
        @i_lc_fin = @inicio, 
        @i_lc_error = @id_ejecucion;

    -- LOG EJECUTIVO (Consola)
    PRINT '--- INICIO PROCESO: ' + ISNULL(@NombreSP, 'spco_get_comprobantes_full') + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';
    PRINT 'Parámetros: ' + ISNULL(@params, 'Error al construir params');

    BEGIN TRY                
        -- 1. Verificación de Variables de Control y Mutex
        DECLARE @aux varchar(100);
        exec sat_catalogo.dbo.sp_get_valor_variable_app 'StopComprobantesFull' ,@aux out ,null,'1';

        IF(@aux = '0')                 
        BEGIN                
            PRINT '   [AVISO]: Deshabilitado por variable StopComprobantesFull';
            SET @error_msg = ISNULL(@id_ejecucion, 'N/A') + ' | SALIDA: Deshabilitado por StopComprobantesFull';
            EXEC sat_comprobante.dbo.spco_crear_log_consulta @i_lc_nombre_sp = @NombreSP, @i_lc_appname = 'BATCH-END', @i_lc_emisor = @idEmisorLog, @i_lc_parametros = @params, @i_lc_origen = 'BDD', @i_lc_inicio = @inicio, @i_lc_fin = @inicio, @i_lc_error = @error_msg;
            RETURN 0;                
        END                

        IF (@i_control_ejecucion = 1)
        BEGIN
            -- A. INTENTO DE BLOQUEO DE SESIÓN (AUTO-LIBERABLE)
            EXEC @res_lock = sp_getapplock @Resource = @NombreSP, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0;

            IF (@res_lock < 0)
            BEGIN
                DECLARE @FechaB DATETIME, @UserB VARCHAR(100);
                SELECT @FechaB = FechaInicio, @UserB = Usuario FROM sat_comprobante.dbo.com_control_ejecucion WITH(NOLOCK) WHERE Procedimiento = @NombreSP;

                PRINT '   [AVISO]: Bloqueado por Mutex (sp_getapplock). Proceso activo de ' + ISNULL(@UserB, 'Desconocido') + ' desde ' + ISNULL(CONVERT(VARCHAR, @FechaB, 120), 'N/A');
                SET @error_msg = ISNULL(@id_ejecucion, 'N/A') + ' | SALIDA: Bloqueado por AppLock (Inició: ' + ISNULL(CONVERT(VARCHAR, @FechaB, 120), 'N/A') + ')';
                EXEC sat_comprobante.dbo.spco_crear_log_consulta @i_lc_nombre_sp = @NombreSP, @i_lc_appname = 'BATCH-END', @i_lc_emisor = @idEmisorLog, @i_lc_parametros = @params, @i_lc_origen = 'BDD', @i_lc_inicio = @inicio, @i_lc_fin = @inicio, @i_lc_error = @error_msg;
                RETURN 0;
            END

            -- B. LIMPIEZA DE TABLA DE VISIBILIDAD (Por si quedó rastro de versiones anteriores)
            DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @NombreSP;

            -- C. REGISTRO DE VISIBILIDAD
            INSERT INTO sat_comprobante.dbo.com_control_ejecucion (Procedimiento, FechaInicio, Usuario)
            VALUES (@NombreSP, @inicio, SYSTEM_USER);                
            PRINT '   [INFO]: AppLock obtenido y visibilidad registrada.';
        END ELSE PRINT '   [INFO]: Control de ejecución omitido (@i_control_ejecucion = 0)';

        -- 2. Organización de Fechas y Filtros SARGables
        DECLARE @FechaInicio datetime, @FechaFin datetime;
        DECLARE @FechaLimiteReproceso datetime = DATEADD(HOUR, -@i_horas_x_reproceso, @inicio);

        IF(@i_fecha_inicio is null)                 
            SET @FechaInicio = DATEADD(day, - @i_dias_x_reproceso, @inicio);                 
        ELSE SET @FechaInicio = @i_fecha_inicio;                     
                   
        IF(@i_fecha_fin is null)                 
            SET @FechaFin = DATEADD(day, 1, @inicio);                 
        ELSE SET @FechaFin = @i_fecha_fin;                
        
        PRINT '   Filtros: FechaInicio: ' + CONVERT(VARCHAR, @FechaInicio, 120) + 
              ' | FechaFin: ' + CONVERT(VARCHAR, @FechaFin, 120) + 
              ' | LimiteReproceso: ' + CONVERT(VARCHAR, @FechaLimiteReproceso, 120);

        -- 3. Preparación de Tablas Temporales
        CREATE TABLE #estado (Codigo INT, Descripcion VARCHAR(200));
        INSERT INTO #estado (Codigo, Descripcion)
        SELECT Codigo, Descripcion 
        FROM sat_catalogo.dbo.sc_vista_estados_documentos WITH(NOLOCK)                 
        WHERE Descripcion IN (SELECT valor FROM sat_catalogo.dbo.fn_split_string(@i_estatus, ','));
        CREATE CLUSTERED INDEX IX_temp_estado ON #estado(Codigo);

        SELECT 0 AS Pais INTO #pais;
        IF(@i_pais is null) INSERT INTO #pais VALUES (593), (57), (506); ELSE INSERT INTO #pais VALUES (@i_pais);
        CREATE CLUSTERED INDEX IX_temp_pais ON #pais(Pais);

        CREATE TABLE #temp_ids (valor BIGINT PRIMARY KEY);
        IF (@i_ids_comprobantes IS NOT NULL) INSERT INTO #temp_ids SELECT DISTINCT CONVERT(BIGINT, valor) FROM sat_catalogo.dbo.fn_split_string(@i_ids_comprobantes, ',');

        CREATE TABLE #temp_emisores (valor INT PRIMARY KEY);
        IF (@i_id_emisor IS NOT NULL) INSERT INTO #temp_emisores SELECT DISTINCT CONVERT(INT, valor) FROM sat_catalogo.dbo.fn_split_string(@i_id_emisor, ',');

        -- 4. Emisores con Licencia Vencida
        SELECT lc_id_emisor as idEmisorLc INTO #EmisoresLicVencida FROM sat_catalogo.dbo.sc_licencia WITH(NOLOCK)                
        INNER JOIN sat_catalogo.dbo.sc_emisor ON em_id_emisor = lc_id_emisor                  
        WHERE em_estado = 0 AND lc_estado = 0 AND (@i_pais IS NULL OR em_pais = @i_pais) AND lc_max_comprobantes < lc_comprobantes_procesados;
        CREATE CLUSTERED INDEX IX_lic_vencida ON #EmisoresLicVencida(idEmisorLc);

        DECLARE @cntIds INT, @cntEmisores INT;
        SELECT @cntIds = COUNT(*) FROM #temp_ids;
        SELECT @cntEmisores = COUNT(*) FROM #temp_emisores;
        PRINT '   Configuración: Estados: ' + ISNULL(@i_estatus, 'N/A') + ' | IDs: ' + CAST(@cntIds AS VARCHAR) + ' | Emisores: ' + CAST(@cntEmisores AS VARCHAR);

        -- =====================================================================
        -- 5. RAMIFICACIÓN LÓGICA (BRANCHING) PARA MÁXIMO RENDIMIENTO
        -- =====================================================================
        
        -- ESCENARIO A: Búsqueda por IDs Específicos (Query 2 Original)
        IF (@i_id_emisor IS NULL AND @i_ids_comprobantes IS NOT NULL)
        BEGIN
            PRINT '4. [Flujo] - Búsqueda por IDs (Scenario A)';
            SELECT TOP (ISNULL(@i_max_consulta, 100))                
                xml.co_id_comprobante AS IdComprobante, xml.co_pais as Pais, xml.co_hora_in AS HoraIn, xml.co_fecha_emision as FechaEmision,                   
                DATEDIFF(HOUR, xml.co_hora_reproceso, @inicio) AS HorasReproceso, em.em_nemonico as Emisor, xml.co_hora_reproceso AS HoraReproceso,                  
                ISNULL(xml.co_numero_reprocesos, 0) As Reprocesos, xml.co_estatus AS Estatus, est.Descripcion AS ValorEstatus,                    
                xml.co_id_emisor AS IdEmisor, xml.co_num_comprobante AS NumComprobante, xml.co_nombre_archivo AS NombreArchivo,                    
                xml.co_tipo_comprobante AS TipoComprobante, Documento,                  
                CASE WHEN @i_trama_dto = 1 THEN xml.co_trama_dto ELSE NULL END AS TramaDto,                 
                CASE WHEN @i_trama_in = 1 THEN xml.co_trama_entrada ELSE NULL END AS TramaEntrada,                  
                @i_procesos AS Proceso, 1 as ExisteBDD                  
            FROM com_log_comprobante_xml xml WITH (NOLOCK)                  
            LEFT JOIN #estado est ON xml.co_estatus = est.Codigo
            INNER JOIN sat_catalogo.dbo.sc_emisor em WITH (NOLOCK) ON em.em_id_emisor = xml.co_id_emisor              
            INNER JOIN sat_catalogo.dbo.sc_vista_tipo_documetos td WITH (NOLOCK) ON xml.co_codigo_tipo_documento = td.CodigoNegocio AND xml.co_pais = td.Pais                  
            WHERE xml.co_id_comprobante IN (SELECT valor FROM #temp_ids)
              AND (xml.co_numero_reprocesos < @i_num_reprocesos OR xml.co_numero_reprocesos IS NULL)
              AND em.em_estado = 0
              AND NOT EXISTS (SELECT 1 FROM #EmisoresLicVencida WHERE idEmisorLc = xml.co_id_emisor)
            ORDER BY xml.co_hora_reproceso DESC;
        END
        -- ESCENARIO B: Búsqueda por Emisor (Query 3 Original)
        ELSE IF (@i_id_emisor IS NOT NULL)
        BEGIN
            PRINT '4. [Flujo] - Búsqueda por Emisor (Scenario B)';
            SELECT TOP (ISNULL(@i_max_consulta, 100))                
                xml.co_id_comprobante AS IdComprobante, xml.co_pais as Pais, xml.co_hora_in AS HoraIn, xml.co_fecha_emision as FechaEmision,                   
                DATEDIFF(HOUR, xml.co_hora_reproceso, @inicio) AS HorasReproceso, em.em_nemonico as Emisor, xml.co_hora_reproceso AS HoraReproceso,                  
                ISNULL(xml.co_numero_reprocesos, 0) As Reprocesos, xml.co_estatus AS Estatus, est.Descripcion AS ValorEstatus,                    
                xml.co_id_emisor AS IdEmisor, xml.co_num_comprobante AS NumComprobante, xml.co_nombre_archivo AS NombreArchivo,                    
                xml.co_tipo_comprobante AS TipoComprobante, Documento,                  
                CASE WHEN @i_trama_dto = 1 THEN xml.co_trama_dto ELSE NULL END AS TramaDto,                 
                CASE WHEN @i_trama_in = 1 THEN xml.co_trama_entrada ELSE NULL END AS TramaEntrada,                  
                @i_procesos AS Proceso, 1 as ExisteBDD                  
            FROM com_log_comprobante_xml xml WITH (NOLOCK)                  
            INNER JOIN #estado est ON xml.co_estatus = est.Codigo
            INNER JOIN sat_catalogo.dbo.sc_emisor em WITH (NOLOCK) ON em.em_id_emisor = xml.co_id_emisor              
            INNER JOIN sat_catalogo.dbo.sc_vista_tipo_documetos td WITH (NOLOCK) ON xml.co_codigo_tipo_documento = td.CodigoNegocio AND xml.co_pais = td.Pais                  
            WHERE xml.co_id_emisor IN (SELECT valor FROM #temp_emisores)
              AND xml.co_pais IN (SELECT Pais FROM #pais)
              AND xml.co_hora_reproceso <= @FechaLimiteReproceso
              -- REGLA ECUADOR: Solo mismo día para estados críticos
              AND (
                (xml.co_pais = 593 AND est.Descripcion IN ('ErrorEnvioAutorizador', 'ErrorConexionAutorizador', 'ErrorConsultaAutorizador'))
                AND xml.co_fecha_emision >= CAST(@inicio AS DATE)
                OR 
                NOT (xml.co_pais = 593 AND est.Descripcion IN ('ErrorEnvioAutorizador', 'ErrorConexionAutorizador', 'ErrorConsultaAutorizador'))
                AND xml.co_fecha_emision BETWEEN @FechaInicio AND @FechaFin
              )
              AND (@i_ids_comprobantes IS NULL OR xml.co_id_comprobante IN (SELECT valor FROM #temp_ids))
              AND (xml.co_numero_reprocesos < @i_num_reprocesos OR xml.co_numero_reprocesos IS NULL)
              AND em.em_estado = 0
              AND NOT EXISTS (SELECT 1 FROM #EmisoresLicVencida WHERE idEmisorLc = xml.co_id_emisor)
            ORDER BY xml.co_hora_reproceso DESC;
        END
        -- ESCENARIO C: Búsqueda General (Query 1 Original)
        ELSE
        BEGIN
            PRINT '4. [Flujo] - Búsqueda General (Scenario C)';
            SELECT TOP (ISNULL(@i_max_consulta, 100))                
                xml.co_id_comprobante AS IdComprobante, xml.co_pais as Pais, xml.co_hora_in AS HoraIn, xml.co_fecha_emision as FechaEmision,                   
                DATEDIFF(HOUR, xml.co_hora_reproceso, @inicio) AS HorasReproceso, em.em_nemonico as Emisor, xml.co_hora_reproceso AS HoraReproceso,                  
                ISNULL(xml.co_numero_reprocesos, 0) As Reprocesos, xml.co_estatus AS Estatus, est.Descripcion AS ValorEstatus,                    
                xml.co_id_emisor AS IdEmisor, xml.co_num_comprobante AS NumComprobante, xml.co_nombre_archivo AS NombreArchivo,                    
                xml.co_tipo_comprobante AS TipoComprobante, Documento,                  
                CASE WHEN @i_trama_dto = 1 THEN xml.co_trama_dto ELSE NULL END AS TramaDto,                 
                CASE WHEN @i_trama_in = 1 THEN xml.co_trama_entrada ELSE NULL END AS TramaEntrada,                  
                @i_procesos AS Proceso, 1 as ExisteBDD                  
            FROM com_log_comprobante_xml xml WITH (NOLOCK)                  
            INNER JOIN #estado est ON xml.co_estatus = est.Codigo
            INNER JOIN sat_catalogo.dbo.sc_emisor em WITH (NOLOCK) ON em.em_id_emisor = xml.co_id_emisor              
            INNER JOIN sat_catalogo.dbo.sc_vista_tipo_documetos td WITH (NOLOCK) ON xml.co_codigo_tipo_documento = td.CodigoNegocio AND xml.co_pais = td.Pais                  
            WHERE xml.co_pais IN (SELECT Pais FROM #pais)
              AND xml.co_hora_reproceso <= @FechaLimiteReproceso
              -- REGLA ECUADOR: Solo mismo día para estados críticos
              AND (
                (
                  (xml.co_pais = 593) 
                  AND (est.Descripcion IN ('ErrorEnvioAutorizador', 'ErrorConexionAutorizador', 'ErrorConsultaAutorizador'))
                  AND (xml.co_fecha_emision >= CAST(@inicio AS DATE))
                )
                OR 
                (
                  NOT ( (xml.co_pais = 593) AND (est.Descripcion IN ('ErrorEnvioAutorizador', 'ErrorConexionAutorizador', 'ErrorConsultaAutorizador')) )
                  AND (xml.co_fecha_emision BETWEEN @FechaInicio AND @FechaFin)
                )
              )
              AND (xml.co_numero_reprocesos < @i_num_reprocesos OR xml.co_numero_reprocesos IS NULL)
              AND em.em_estado = 0
              AND NOT EXISTS (SELECT 1 FROM #EmisoresLicVencida WHERE idEmisorLc = xml.co_id_emisor)
            ORDER BY xml.co_hora_reproceso DESC
            OPTION (RECOMPILE); -- Ayuda a elegir el mejor plan para el rango de fechas actual
        END
        
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
        PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, 'Consulta finalizada:');

    END TRY                
    BEGIN CATCH                
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;
        EXEC [master].[dbo].[spct_insertar_alerta_postgres] @severity = 'Error', @process = @NombreSP, @message = @ErrorMessage;
        PRINT '!!! ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        
        -- Liberar AppLock en caso de error
        IF (@i_control_ejecucion = 1) 
        BEGIN
            EXEC sp_releaseapplock @Resource = @NombreSP, @LockOwner = 'Session';
            DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @NombreSP;
        END
    END CATCH                
      
    -- 6. Finalización y Log de Auditoría
    SET @fin = GETDATE();
    
    -- PRIORIDAD 1: Liberar el control lo antes posible para evitar bloqueos huérfanos
    IF (@i_control_ejecucion = 1)
    BEGIN
        EXEC sp_releaseapplock @Resource = @NombreSP, @LockOwner = 'Session';
        DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @NombreSP;      
        PRINT '   [INFO]: Control de ejecución (AppLock + Tabla) liberado.';
    END

    -- PRIORIDAD 2: Registro de auditoría
    SET @error_msg = ISNULL(@id_ejecucion, 'N/A') + ' | ' + ISNULL(@error_msg, 'COMPLETADO');
    EXEC sat_comprobante.dbo.spco_crear_log_consulta @i_lc_nombre_sp = @NombreSP, @i_lc_appname = 'BATCH-END', @i_lc_emisor = @idEmisorLog, @i_lc_parametros = @params, @i_lc_origen = 'BDD', @i_lc_inicio = @inicio, @i_lc_fin = @fin, @i_lc_error = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
END
GO
