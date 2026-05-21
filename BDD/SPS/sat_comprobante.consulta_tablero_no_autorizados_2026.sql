USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[consulta_tablero_no_autorizados_2026]') IS NOT NULL
BEGIN  
    DECLARE @NombreBK NVARCHAR(255) = 'consulta_tablero_no_autorizados_2026_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');  
    IF OBJECT_ID(@NombreBK) IS NULL   
    BEGIN  
        EXEC sp_rename 'consulta_tablero_no_autorizados_2026', @NombreBK;  
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;  
    END  
    ELSE  
    BEGIN  
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';  
        DROP PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026];  
    END  
END  
GO

CREATE PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026]  
    @Pais int = null,  
    @Motivo bit = 1  
AS  
/*************************************************************************************************************************************************  
    PROCESO: consulta_tablero_no_autorizados_2026  
    DESCRIPCIÓN: Pobla la tabla co_comprobante_rechazado procesando país por país.  
      
    HISTORIAL DE CAMBIOS:  
    FECHA           AUTOR           DESCRIPCIÓN  
    -----------     ------------    ---------------------------------------------------------------------------------------------------------  
    06-MAY-2026     Antigravity     Refactorización: Log Ejecutivo y Alertas.  
    12-MAY-2026     Antigravity     Mejora: Descompresión de dl_detalle_evento_cp e identificación de fuente en co_motivo.  
    19-MAY-2026     Antigravity     Modificación: Exclusión de descompresión para Panamá (507).
    20-MAY-2026     Antigravity     Restricción: Exclusión de Panamá (507) fuera del horario de 01:00 AM a 04:00 AM.
*************************************************************************************************************************************************/  
BEGIN  
    SET NOCOUNT ON;  
    -- 1. CONFIGURACIÓN Y VARIABLES  
    DECLARE @i_dias_actual INT = 3;  
    DECLARE @aux_ambiente VARCHAR(50), @aux_ambiente2 VARCHAR(50);  
    DECLARE @current_pais INT;  
    DECLARE @total_comprobantes INT;  
    DECLARE @rows_afectados INT = 0;  
  
    -- VARIABLES DE LOGGING Y MONITOREO  
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);  
    DECLARE @FullSPName VARCHAR(200) = DB_NAME() + '.dbo.' + @NombreSP;  
    DECLARE @inicio DATETIME = GETDATE();  
    DECLARE @fin DATETIME;  
    DECLARE @params VARCHAR(MAX);  
    DECLARE @inicio_pais DATETIME;  
    DECLARE @fin_pais DATETIME;  
  
    DECLARE @mes_emi_actual INT = MONTH(GETDATE());  
    DECLARE @mes_emi_previo INT = MONTH(DATEADD(DAY, -@i_dias_actual, GETDATE()));  
  
    SET @params = 'EXEC ' + @FullSPName + ' @Pais = ' + ISNULL(CAST(@Pais AS VARCHAR), 'NULL') + ', @Motivo = ' + ISNULL(CAST(@Motivo AS VARCHAR), 'NULL');  
  
    -- 2. CONTROL DE CONCURRENCIA  
    IF EXISTS(SELECT 1 FROM sat_comprobante.dbo.com_control_ejecucion WITH(NOLOCK)  
              WHERE FechaInicio > DATEADD(MINUTE, -15, GETDATE())   
              AND Procedimiento = @FullSPName)  
    BEGIN  
        PRINT 'AVISO: Ya se encuentra en ejecución ' + @FullSPName;  
        RETURN 0;  
    END  
  
    INSERT INTO sat_comprobante.dbo.com_control_ejecucion (
        Procedimiento,
        FechaInicio,
        Usuario
    )  
    VALUES (
        @FullSPName,
        GETDATE(),
        SYSTEM_USER
    );  
  
    BEGIN TRY  
        PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';  
  
        -- 3. OBTENER AMBIENTE  
        EXEC sat_catalogo.dbo.sp_get_valor_variable_app 'sql_ambiente', @aux_ambiente OUT, @aux_ambiente2 OUT, @@SERVERNAME;  
  
        -- 4. IDENTIFICAR PAÍSES CON PENDIENTES  
        DECLARE @paises_proceso TABLE (id_pais INT PRIMARY KEY);  
          
        INSERT INTO @paises_proceso (
            id_pais
        )  
        SELECT DISTINCT 
            co_pais  
        FROM sat_comprobante..com_log_comprobante_xml WITH(NOLOCK)  
        WHERE co_mes_emi IN (@mes_emi_actual, @mes_emi_previo)  
          AND co_hora_in > DATEADD(DAY, -@i_dias_actual, CAST(GETDATE() AS DATE))   
          AND co_hora_in < DATEADD(HOUR, -1, GETDATE())   
          AND co_estatus NOT IN (1, 14)   
          AND co_pais is not null
          AND (@Pais IS NULL OR co_pais = @Pais)
          -- Restricción de Panamá (507): solo se procesa entre las 01:00 AM y las 04:00 AM (horas 1, 2, 3)
          AND NOT (co_pais = 507 AND NOT (DATEPART(HOUR, GETDATE()) BETWEEN 1 AND 3));  
  
        -- 5. PROCESAMIENTO ITERATIVO POR PAÍS  
        DECLARE cur_paises CURSOR LOCAL FAST_FORWARD FOR SELECT id_pais FROM @paises_proceso;  
        OPEN cur_paises;  
        FETCH NEXT FROM cur_paises INTO @current_pais;  
  
        WHILE @@FETCH_STATUS = 0  
        BEGIN  
            SET @inicio_pais = GETDATE();  
  
            IF OBJECT_ID('tempdb..#resultNoAutorizados') IS NOT NULL DROP TABLE #resultNoAutorizados;  
              
            SELECT    
                @aux_ambiente AS ambiente, 
                co_id_emisor, 
                co_id_comprobante, 
                co_hora_in, 
                co_fecha_emision,   
                co_estatus, 
                co_num_comprobante, 
                co_codigo_tipo_documento, 
                co_detalle, 
                co_numero_reprocesos,  
                co_hora_reproceso, 
                co_establecimiento, 
                co_punto_emision, 
                CAST(0 AS BIT) AS co_info_detalles,   
                CAST('' AS VARCHAR(500)) AS co_motivo, 
                co_pais, 
                CAST(0 AS BIT) AS Reprocesable,        
                E.DescripcionEstatus, 
                T.DescripcionTipoDocumento,  
                CAST(0 AS BIT) AS co_es_comprimido -- FLAG PARA IDENTIFICAR FUENTE  
            INTO #resultNoAutorizados  
            FROM sat_comprobante..com_log_comprobante_xml L WITH(NOLOCK)  
            INNER JOIN sat_catalogo..sc_vista_estados_documentos E ON E.CodigoEstatus = L.co_estatus  
            LEFT JOIN sat_catalogo..sc_vista_tipo_documetos T ON T.CodigoNegocio = L.co_codigo_tipo_documento AND T.Pais = L.co_pais  
            WHERE co_mes_emi IN (@mes_emi_actual, @mes_emi_previo)  
              AND co_hora_in > DATEADD(DAY, -@i_dias_actual, CAST(GETDATE() AS DATE))   
              AND co_hora_in < DATEADD(HOUR, -1, GETDATE())   
              AND E.Autorizado = 0  
              AND co_estatus <> 14  
              AND co_pais = @current_pais;  
  
            SELECT @total_comprobantes = COUNT(*) FROM #resultNoAutorizados;  
  
            IF @total_comprobantes > 0  
            BEGIN  
                CREATE CLUSTERED INDEX IX_tmp_id ON #resultNoAutorizados(co_id_comprobante);  
  
                -- 5.2 OBTENCIÓN DE DETALLES Y MARCACIÓN DE FUENTE (BINARY VS TEXT)  
                -- Excluimos a Panamá (507) del proceso de descompresión según el requerimiento.
                UPDATE t  
                SET co_detalle = d.Mensajes,   
                    co_info_detalles = 1,  
                    co_es_comprimido = d.TieneCompresion  
                FROM #resultNoAutorizados t  
                INNER JOIN (  
                    SELECT 
                        dl_id_comprobante,   
                        STRING_AGG(  
                            CAST(  
                                CASE   
                                    WHEN @current_pais <> 507 AND dl_mensaje = 'Consulte el detalle->' AND dl_detalle_evento_cp IS NOT NULL   
                                    THEN CAST(DECOMPRESS(dl_detalle_evento_cp) AS NVARCHAR(MAX))  
                                    ELSE dl_mensaje   
                                END AS VARCHAR(MAX)),   
                            CHAR(10)  
                        ) AS Mensajes,  
                        MAX(CASE WHEN @current_pais <> 507 AND dl_mensaje = 'Consulte el detalle->' THEN 1 ELSE 0 END) AS TieneCompresion  
                    FROM sat_comprobante.dbo.com_detalle_log WITH(NOLOCK)  
                    WHERE dl_tipo_evento = 1  
                      AND dl_evento NOT IN (11,28,3,30)   
                      AND dl_mensaje NOT LIKE '%Fin proceso%'  
                      AND dl_hora >= DATEADD(DAY, -@i_dias_actual, CAST(GETDATE() AS DATE))   
                    GROUP BY dl_id_comprobante  
                ) d ON d.dl_id_comprobante = t.co_id_comprobante  
                WHERE t.co_detalle IS NULL;  
  
                -- 5.3 REEMPLAZOS DINÁMICOS  
                IF (@Motivo = 1 OR @total_comprobantes < 2000)  
                BEGIN  
                    DECLARE @patron VARCHAR(1000), @reemplazo VARCHAR(200);  
                    DECLARE cur_reemplazos CURSOR LOCAL FAST_FORWARD FOR  
                    SELECT patron, reemplazo FROM sat_catalogo.dbo.sc_config_reemplazos_mensaje_rechazo WHERE activo = 1 ORDER BY orden;  
                      
                    OPEN cur_reemplazos;  
                    FETCH NEXT FROM cur_reemplazos INTO @patron, @reemplazo;  
                    WHILE @@FETCH_STATUS = 0  
                    BEGIN  
                        UPDATE #resultNoAutorizados   
                        SET co_detalle = REPLACE(co_detalle, @patron, @reemplazo)  
                        WHERE co_info_detalles = 1 AND co_detalle LIKE '%' + @patron + '%';  
                        FETCH NEXT FROM cur_reemplazos INTO @patron, @reemplazo;  
                    END  
                    CLOSE cur_reemplazos; DEALLOCATE cur_reemplazos;  
                END  
  
                -- 5.4 CLASIFICACIÓN FINAL E IDENTIFICACIÓN DE FUENTE  
                UPDATE #resultNoAutorizados  
                SET co_motivo = (CASE  
                        WHEN co_detalle LIKE '%CUFE malformado%' THEN 'CUFE mal formado'  
                        WHEN co_detalle LIKE '%Digest Value%' THEN 'Digest Value'  
                        WHEN co_detalle LIKE '%no coincide%' THEN 'Descuadre Valores'  
                        WHEN co_detalle LIKE '%no tiene detalles%' THEN 'SIN DETALLES'  
                        WHEN co_detalle LIKE '%precio unitario%' THEN 'Precio Cero'  
                        WHEN co_detalle LIKE '%CABYS%' THEN 'CABYS incorrecto'  
                        WHEN co_detalle LIKE '%token%' THEN 'Error TOKEN'  
                        WHEN co_detalle LIKE '%Object reference%' THEN 'Error no controlado'  
                        ELSE 'REVISAR DETALLE' END) + (CASE WHEN co_es_comprimido = 1 THEN ' (XML)' ELSE '' END),  
                    Reprocesable = CASE WHEN co_detalle LIKE '%task was canceled%' OR co_detalle LIKE '%timeout%' THEN 1 ELSE 0 END;  
  
                -- 5.5 Persistencia Atómica por País  
                BEGIN TRANSACTION;  
                    DELETE FROM sat_comprobante.dbo.co_comprobante_rechazado 
                    WHERE co_pais = @current_pais;  
  
                    INSERT INTO sat_comprobante.dbo.co_comprobante_rechazado (  
                        ambiente, 
                        co_motivo, 
                        co_pais, 
                        co_nemonico, 
                        co_id_emisor, 
                        co_id_comprobante, 
                        co_hora_in,   
                        co_fecha_emision, 
                        co_estatus, 
                        co_num_comprobante, 
                        co_codigo_tipo_documento, 
                        co_establecimiento,   
                        co_punto_emision, 
                        Reprocesable, 
                        co_info_detalles, 
                        co_detalle, 
                        co_ultima_actualizacion,   
                        co_numero_reprocesos, 
                        co_hora_reproceso, 
                        DescripcionEstatus, 
                        DescripcionTipoDocumento  
                    )  
                    SELECT   
                        ambiente, 
                        co_motivo, 
                        co_pais, 
                        em_nemonico, 
                        co_id_emisor, 
                        co_id_comprobante, 
                        co_hora_in,   
                        CAST(co_fecha_emision AS DATE), 
                        co_estatus, 
                        co_num_comprobante, 
                        co_codigo_tipo_documento,   
                        co_establecimiento, 
                        co_punto_emision, 
                        Reprocesable, 
                        co_info_detalles, 
                        co_detalle, 
                        GETDATE(),   
                        co_numero_reprocesos, 
                        co_hora_reproceso, 
                        DescripcionEstatus, 
                        DescripcionTipoDocumento  
                    FROM #resultNoAutorizados  
                    INNER JOIN sat_catalogo..sc_emisor ON em_id_emisor = co_id_emisor;  
                      
                    SET @rows_afectados += @@ROWCOUNT;  
                COMMIT TRANSACTION;  
            END  
  
            SET @fin_pais = GETDATE();  
            DECLARE @params_pais VARCHAR(MAX) = @params + ' | Pais: ' + CAST(@current_pais AS VARCHAR);  
            
            EXEC [sat_comprobante].[dbo].[spco_crear_log_consulta] 
                @i_lc_nombre_sp = @NombreSP,
                @i_lc_appname   = 'BATCH',
                @i_lc_emisor    = @current_pais,
                @i_lc_parametros = @params_pais,
                @i_lc_origen    = 'BDD',
                @i_lc_inicio    = @inicio_pais,
                @i_lc_fin       = @fin_pais,
                @i_lc_error     = NULL;  
  
            FETCH NEXT FROM cur_paises INTO @current_pais;  
        END  
  
        CLOSE cur_paises;  
        DEALLOCATE cur_paises;  
  
        SET @fin = GETDATE();  
        DECLARE @error_msg_final NVARCHAR(MAX) = 'rows:' + CAST(@rows_afectados AS VARCHAR) + ' | total_s:' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR);  
        
        EXEC [sat_comprobante].[dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_appname   = 'SUCCESS',
            @i_lc_emisor    = @Pais,
            @i_lc_parametros = @params,
            @i_lc_origen    = 'BDD',
            @i_lc_inicio    = @inicio,
            @i_lc_fin       = @fin,
            @i_lc_error     = @error_msg_final;
  
        DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @FullSPName;  
        PRINT '--- FIN PROCESO EXITOSO ---';  
  
    END TRY  
    BEGIN CATCH  
        SET @fin = GETDATE();  
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();  
        DECLARE @error_msg_err NVARCHAR(MAX) = 'Error: ' + @ErrorMessage + ' (Line: ' + CAST(ERROR_LINE() AS VARCHAR) + ')';  
        
        EXEC [sat_comprobante].[dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_appname   = 'ERROR',
            @i_lc_emisor    = @Pais,
            @i_lc_parametros = @params,
            @i_lc_origen    = 'BDD',
            @i_lc_inicio    = @inicio,
            @i_lc_fin       = @fin,
            @i_lc_error     = @error_msg_err;
        -- ALERTA OBLIGATORIA A POSTGRES EN CASO DE ERROR (Dashboard de Monitoreo)
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;
            
        DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @FullSPName;  
        THROW;  
    END CATCH  
END;
GO
