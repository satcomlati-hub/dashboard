USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[tablero_pendientes_reproceso]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'tablero_pendientes_reproceso_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy (preservamos la primera versión del día)
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'tablero_pendientes_reproceso', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[tablero_pendientes_reproceso];
    END
END
GO

CREATE PROCEDURE [dbo].[tablero_pendientes_reproceso]
AS
BEGIN
    SET NOCOUNT ON;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX) = 'EXEC [dbo].[' + @NombreSP + ']';
    DECLARE @error_msg NVARCHAR(MAX);
    DECLARE @i_mensaje VARCHAR(MAX) = 'SSL,Keyset does not exist,Value cannot be null,No se cuenta con informacion del cliente. ClienteId,No fue posible generar el documento electronico. Detalle: Keyset does not exist';

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY
        -- 1. Obteniendo pendientes por mensajes específicos
        PRINT '1. Obteniendo pendientes por mensajes específicos...';
        SELECT  
            Autorizado, 
            DescripcionEstatus, 
            DescripcionTipoDocumento,  
            co_pais,  
            co_nemonico, 
            CAST(co_id_comprobante AS VARCHAR(100)) AS co_id_comprobante, 
            co_numero_reprocesos,
            co_hora_reproceso, 
            co_num_comprobante,  
            co_hora_in,  
            co_fecha_emision,
            co_detalle   
        INTO #ResultPendientes
        FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK)
        LEFT JOIN sat_catalogo..sc_vista_estados_documentos ON co_estatus = CodigoEstatus  
        LEFT JOIN sat_catalogo..sc_vista_tipo_documetos ON co_codigo_tipo_documento = CodigoNegocio AND Pais = co_pais  
        INNER JOIN STRING_SPLIT(@i_mensaje, ',') AS criterios ON co_detalle LIKE '%' + criterios.value + '%'
        WHERE co_id_comprobante > 0
        AND Autorizado = 0
        AND (
            (co_pais = 593 AND co_fecha_in >= CAST(GETDATE() AS DATE)) -- Ecuador: Solo hoy
            OR 
            (co_pais <> 593 AND co_fecha_in >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE))) -- Otros: 1 día
        );
        
        PRINT '   Filas obtenidas (Mensajes): ' + CAST(@@ROWCOUNT AS VARCHAR);

        -- 2. Errores de autorizador con restricciones de tiempo (Ecuador vs Otros)
        PRINT '2. Obteniendo errores de autorizador con restricciones de tiempo...';
        INSERT INTO #ResultPendientes (
            Autorizado, 
            DescripcionEstatus, 
            DescripcionTipoDocumento,  
            co_pais,  
            co_nemonico, 
            co_id_comprobante, 
            co_numero_reprocesos,
            co_hora_reproceso, 
            co_num_comprobante,  
            co_hora_in,  
            co_fecha_emision,
            co_detalle
        )
        SELECT  
            Autorizado, 
            DescripcionEstatus, 
            DescripcionTipoDocumento,  
            co_pais,  
            co_nemonico, 
            CAST(co_id_comprobante AS VARCHAR(100)), 
            co_numero_reprocesos,
            co_hora_reproceso, 
            co_num_comprobante,  
            co_hora_in,  
            co_fecha_emision,
            co_detalle  
        FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK)
        INNER JOIN sat_catalogo..sc_vista_estados_documentos ON co_estatus = CodigoEstatus  
        INNER JOIN sat_catalogo..sc_vista_tipo_documetos ON co_codigo_tipo_documento = CodigoNegocio AND Pais = co_pais  
        WHERE co_id_comprobante > 0
        AND DescripcionEstatus IN ('ErrorEnvioAutorizador','ErrorConsultaAutorizador', 'ErrorConexionAutorizador')
        AND Autorizado = 0 
        AND (
            (co_pais = 593 AND co_hora_in >= CAST(GETDATE() AS DATE)) -- Ecuador: Solo hoy
            OR 
            (co_pais <> 593 AND co_hora_in >= DATEADD(DAY, -3, CAST(GETDATE() AS DATE))) -- Otros: 3 días
        );
        
        PRINT '   Filas obtenidas (Errores Auth): ' + CAST(@@ROWCOUNT AS VARCHAR);

        -- 3. Obteniendo RecibidoAut (últimos 30 días)
        PRINT '3. Obteniendo RecibidoAut (últimos 30 días)...';
        INSERT INTO #ResultPendientes (
            Autorizado, 
            DescripcionEstatus, 
            DescripcionTipoDocumento,  
            co_pais,  
            co_nemonico, 
            co_id_comprobante, 
            co_numero_reprocesos,
            co_hora_reproceso, 
            co_num_comprobante,  
            co_hora_in,  
            co_fecha_emision,
            co_detalle
        )
        SELECT  
            Autorizado, 
            DescripcionEstatus, 
            DescripcionTipoDocumento,  
            co_pais,  
            co_nemonico, 
            CAST(co_id_comprobante AS VARCHAR(100)), 
            co_numero_reprocesos,
            co_hora_reproceso, 
            co_num_comprobante,  
            co_hora_in,  
            co_fecha_emision,
            co_detalle   
        FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK)
        INNER JOIN sat_catalogo..sc_vista_estados_documentos ON co_estatus = CodigoEstatus  
        INNER JOIN sat_catalogo..sc_vista_tipo_documetos ON co_codigo_tipo_documento = CodigoNegocio AND Pais = co_pais  
        WHERE Autorizado = 0
        AND co_fecha_in >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))
        AND DescripcionEstatus IN ('RecibidoAut');
        
        PRINT '   Filas obtenidas (RecibidoAut): ' + CAST(@@ROWCOUNT AS VARCHAR);

        -- 4. Retornando resultados finales
        PRINT '4. Retornando resultados finales...';
        SELECT 
            Autorizado,
            DescripcionEstatus,
            DescripcionTipoDocumento,
            co_pais,
            co_nemonico,
            co_id_comprobante,
            co_numero_reprocesos,
            co_hora_reproceso,
            co_num_comprobante,
            co_hora_in,
            co_fecha_emision,
            co_detalle
        FROM #ResultPendientes 
        ORDER BY DescripcionEstatus;

        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- ALERTA OBLIGATORIA A POSTGRES EN CASO DE ERROR
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    -- Log de Auditoría Final
    SET @fin = GETDATE();
    
    EXEC sat_comprobante.dbo.spco_crear_log_consulta 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'BATCH',
        @i_lc_emisor    = NULL,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
END
GO