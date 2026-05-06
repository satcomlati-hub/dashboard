alter   PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026]
    @Pais int = null,
    @Motivo bit = 1
AS
/*************************************************************************************************************************************************
    PROCESO: consulta_tablero_no_autorizados_2026
    DESCRIPCIÓN: Pobla la tabla co_comprobante_rechazado procesando país por país para evitar bloqueos y optimizar recursos.
    
    HISTORIAL DE CAMBIOS:
    FECHA           AUTOR           DESCRIPCIÓN
    -----------     ------------    ---------------------------------------------------------------------------------------------------------
    06-MAY-2026     Antigravity     Refactorización: Inyección de co_mes_emi para Partition Pruning, Log Ejecutivo y Alertas Postgres.
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
    DECLARE @i_lc_error VARCHAR(MAX);

    -- LÓGICA DE PARTICIONAMIENTO (co_mes_emi)
    -- Ajustado a formato de mes simple (1-12) según hallazgo en pruebas manuales
    DECLARE @mes_emi_actual INT = MONTH(GETDATE());
    DECLARE @mes_emi_previo INT = MONTH(DATEADD(DAY, -@i_dias_actual, GETDATE()));

    -- CONSTRUCCIÓN DE LOG EJECUTIVO (Para soporte rápido)
    SET @params = 'EXEC ' + @FullSPName + ' @Pais = ' + ISNULL(CAST(@Pais AS VARCHAR), 'NULL') + ', @Motivo = ' + ISNULL(CAST(@Motivo AS VARCHAR), 'NULL');

    -- 2. CONTROL DE CONCURRENCIA
    IF EXISTS(SELECT 1 FROM sat_comprobante.dbo.com_control_ejecucion WITH(NOLOCK)
              WHERE FechaInicio > DATEADD(MINUTE, -15, GETDATE()) 
              AND Procedimiento = @FullSPName)
    BEGIN
        PRINT 'AVISO: Ya se encuentra en ejecución ' + @FullSPName;
        RETURN 0;
    END

    INSERT INTO sat_comprobante.dbo.com_control_ejecucion (Procedimiento, FechaInicio, Usuario)
    VALUES (@FullSPName, GETDATE(), SYSTEM_USER);

    BEGIN TRY
        PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

        -- 3. OBTENER AMBIENTE
        EXEC sat_catalogo.dbo.sp_get_valor_variable_app 'sql_ambiente', @aux_ambiente OUT, @aux_ambiente2 OUT, @@SERVERNAME;

        -- 4. IDENTIFICAR PAÍSES CON PENDIENTES
        PRINT '1. Identificando países a procesar...';
        DECLARE @paises_proceso TABLE (id_pais INT PRIMARY KEY);
        
        INSERT INTO @paises_proceso (id_pais)
        SELECT DISTINCT co_pais
        FROM sat_comprobante..com_log_comprobante_xml WITH(NOLOCK)
        WHERE co_mes_emi IN (@mes_emi_actual, @mes_emi_previo) -- OPTIMIZACIÓN: Partition Pruning
          AND co_hora_in > DATEADD(DAY, -@i_dias_actual, CAST(GETDATE() AS DATE)) 
          AND co_hora_in < DATEADD(HOUR, -1, GETDATE()) 
          AND co_estatus NOT IN (1, 14) -- Evitar autorizados y anulados
          AND (@Pais IS NULL OR co_pais = @Pais);

        DECLARE @count_paises INT = (SELECT COUNT(*) FROM @paises_proceso);
        PRINT '   Países encontrados: ' + CAST(@count_paises AS VARCHAR);

        -- 5. PROCESAMIENTO ITERATIVO POR PAÍS
        DECLARE cur_paises CURSOR LOCAL FAST_FORWARD FOR SELECT id_pais FROM @paises_proceso;
        OPEN cur_paises;
        FETCH NEXT FROM cur_paises INTO @current_pais;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @inicio_pais = GETDATE();
            PRINT '--- Procesando País: ' + CAST(@current_pais AS VARCHAR) + ' [Inicio: ' + CONVERT(VARCHAR, @inicio_pais, 120) + '] ---';

            -- Tabla temporal optimizada
            IF OBJECT_ID('tempdb..#resultNoAutorizados') IS NOT NULL DROP TABLE #resultNoAutorizados;
            
            -- 5.1 Carga Base (Uso de co_mes_emi es CRÍTICO aquí)
            SELECT  
                @aux_ambiente AS ambiente, co_id_emisor, co_id_comprobante, co_hora_in, co_fecha_emision, 
                co_estatus, co_num_comprobante, co_codigo_tipo_documento, co_detalle, co_numero_reprocesos,
                co_hora_reproceso, co_establecimiento, co_punto_emision, CAST(0 AS BIT) AS co_info_detalles, 
                CAST('' AS VARCHAR(500)) AS co_motivo, co_pais, CAST(0 AS BIT) AS Reprocesable,      
                E.DescripcionEstatus, T.DescripcionTipoDocumento
            INTO #resultNoAutorizados
            FROM sat_comprobante..com_log_comprobante_xml L WITH(NOLOCK)
            INNER JOIN sat_catalogo..sc_vista_estados_documentos E ON E.CodigoEstatus = L.co_estatus
            LEFT JOIN sat_catalogo..sc_vista_tipo_documetos T ON T.CodigoNegocio = L.co_codigo_tipo_documento AND T.Pais = L.co_pais
            WHERE co_mes_emi IN (@mes_emi_actual, @mes_emi_previo) -- OPTIMIZACIÓN: Inyección de partición
              AND co_hora_in > DATEADD(DAY, -@i_dias_actual, CAST(GETDATE() AS DATE)) 
              AND co_hora_in < DATEADD(HOUR, -1, GETDATE()) 
              AND E.Autorizado = 0
              AND co_estatus <> 14
              AND co_pais = @current_pais;

            SELECT @total_comprobantes = COUNT(*) FROM #resultNoAutorizados;

            IF @total_comprobantes > 0
            BEGIN
                CREATE CLUSTERED INDEX IX_tmp_id ON #resultNoAutorizados(co_id_comprobante);

                -- 5.2 Obtención de detalles
                UPDATE t
                SET co_detalle = d.Mensajes, co_info_detalles = 1
                FROM #resultNoAutorizados t
                INNER JOIN (
                    SELECT dl_id_comprobante, STRING_AGG(CAST(dl_mensaje AS VARCHAR(MAX)), CHAR(10)) AS Mensajes
                    FROM sat_comprobante.dbo.com_detalle_log WITH(NOLOCK)
                    WHERE dl_evento NOT IN (11,28,3,30) 
                      AND dl_mensaje NOT LIKE '%Fin proceso%' AND dl_mensaje NOT LIKE '%Consulte el detalle%'
                    GROUP BY dl_id_comprobante
                ) d ON d.dl_id_comprobante = t.co_id_comprobante
                WHERE t.co_detalle IS NULL;

                -- 5.3 Reemplazos dinámicos (Optimizado para volumen bajo)
                IF (@Motivo = 1 OR @total_comprobantes < 5000)
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

                -- 5.4 Clasificación final
                UPDATE #resultNoAutorizados
                SET co_motivo = CASE
                        WHEN co_detalle LIKE '%CUFE malformado%' THEN 'CUFE mal formado'
                        WHEN co_detalle LIKE '%Digest Value%' THEN 'Digest Value'
                        WHEN co_detalle LIKE '%no coincide%' THEN 'Descuadre Valores'
                        WHEN co_detalle LIKE '%no tiene detalles%' THEN 'SIN DETALLES'
                        WHEN co_detalle LIKE '%precio unitario%' THEN 'Precio Cero'
                        WHEN co_detalle LIKE '%CABYS%' THEN 'CABYS incorrecto'
                        WHEN co_detalle LIKE '%token%' THEN 'Error TOKEN'
                        WHEN co_detalle LIKE '%Object reference%' THEN 'Error no controlado'
                        ELSE 'REVISAR DETALLE' END,
                    Reprocesable = CASE WHEN co_detalle LIKE '%task was canceled%' OR co_detalle LIKE '%timeout%' THEN 1 ELSE 0 END;

                -- 5.5 Persistencia Atómica por País
                BEGIN TRANSACTION;
                    DELETE FROM sat_comprobante.dbo.co_comprobante_rechazado WHERE co_pais = @current_pais;

                    INSERT INTO sat_comprobante.dbo.co_comprobante_rechazado (
                        ambiente, co_motivo, co_pais, co_nemonico, co_id_emisor, co_id_comprobante, co_hora_in, 
                        co_fecha_emision, co_estatus, co_num_comprobante, co_codigo_tipo_documento, co_establecimiento, 
                        co_punto_emision, Reprocesable, co_info_detalles, co_detalle, co_ultima_actualizacion, 
                        co_numero_reprocesos, co_hora_reproceso, DescripcionEstatus, DescripcionTipoDocumento
                    )
                    SELECT 
                        ambiente, co_motivo, co_pais, em_nemonico, co_id_emisor, co_id_comprobante, co_hora_in, 
                        CAST(co_fecha_emision AS DATE), co_estatus, co_num_comprobante, co_codigo_tipo_documento, 
                        co_establecimiento, co_punto_emision, Reprocesable, co_info_detalles, co_detalle, GETDATE(), 
                        co_numero_reprocesos, co_hora_reproceso, DescripcionEstatus, DescripcionTipoDocumento
                    FROM #resultNoAutorizados
                    INNER JOIN sat_catalogo..sc_emisor ON em_id_emisor = co_id_emisor;
                    
                    SET @rows_afectados += @@ROWCOUNT;
                COMMIT TRANSACTION;
            END

            SET @fin_pais = GETDATE();
            DECLARE @params_pais VARCHAR(MAX) = @params + ' | Pais Actual: ' + CAST(@current_pais AS VARCHAR);
            EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'BATCH', @current_pais, @params_pais, null, @inicio_pais, @fin_pais, 0, null;

            FETCH NEXT FROM cur_paises INTO @current_pais;
        END

        CLOSE cur_paises;
        DEALLOCATE cur_paises;

        -- 6. FINALIZACIÓN Y RESULTADOS
        SET @fin = GETDATE();
        SET @i_lc_error = 'rows:' + CAST(@rows_afectados AS VARCHAR) + ' | total_s:' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR);
        
        -- Log Global Final
        EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'SUCCESS', @Pais, @params, @i_lc_error, @inicio, @fin, 0, null;

        -- Mostrar consolidado (opcional según el uso del dashboard)
        SELECT * FROM sat_comprobante.dbo.co_comprobante_rechazado ORDER BY co_motivo;

        DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @FullSPName;
        PRINT '--- FIN PROCESO EXITOSO: ' + @NombreSP + ' ---';

    END TRY
    BEGIN CATCH
        -- Captura de error
        SET @fin = GETDATE();
        SET @i_lc_error = 'Error: ' + ERROR_MESSAGE() + ' (Line: ' + CAST(ERROR_LINE() AS VARCHAR) + ')';
        
        -- Log de Error
        EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'ERROR', @Pais, @params, @i_lc_error, @inicio, @fin, 1, null;
        
        -- Alerta a Postgres para monitoreo proactivo
        EXEC sat_catalogo.dbo.spct_insertar_alerta_postgres @FullSPName, @i_lc_error, 'CRITICAL';

        -- Limpieza de control
        DELETE FROM sat_comprobante.dbo.com_control_ejecucion WHERE Procedimiento = @FullSPName;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
