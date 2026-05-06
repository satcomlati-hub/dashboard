USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[consulta_tablero_no_autorizados_2026_OTROS]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'consulta_tablero_no_autorizados_2026_OTROS_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy (preservamos la primera versión del día)
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'consulta_tablero_no_autorizados_2026_OTROS', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_OTROS];
    END
END
GO

CREATE PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_OTROS]
(
    @i_Pais int = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX); 

    -- LOG EJECUTIVO: Construir la cadena para poder replicar la ejecución exacta
    SET @params = CONCAT('EXEC [dbo].[', @NombreSP, '] ',
                  '@i_Pais = ', ISNULL(CAST(@i_Pais AS VARCHAR), 'NULL'));

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY
        
        PRINT '1. Ejecutando consulta de comprobantes rechazados (Catch-all OTROS)...';

        SELECT 
            ambiente,
            co_motivo,
            co_pais,
            co_nemonico,
            --co_id_emisor,
            CAST(co_id_comprobante AS varchar(30)) AS Column1,
            CAST(co_id_comprobante AS varchar(30)) AS co_id_comprobante,
            co_hora_in,
            co_fecha_emision,
            --co_estatus,
            co_num_comprobante,
            co_codigo_tipo_documento,
            co_establecimiento,
            co_punto_emision,
            Reprocesable,
            --co_info_detalles,
            co_detalle,
            co_ultima_actualizacion,
            co_numero_reprocesos,
            co_hora_reproceso,
            DescripcionEstatus,
            DescripcionTipoDocumento
        FROM sat_comprobante.dbo.co_comprobante_rechazado
        WHERE 
            (@i_Pais IS NULL AND co_pais NOT IN (593, 57, 507, 506))
            OR 
            (@i_Pais IS NOT NULL AND co_pais = @i_Pais);

        -- Capturar el número de filas del proceso principal
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
            
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        
        -- Formatear error para el log de auditoría
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- ALERTA A TELEGRAM VIA POSTGRES (Dashboard de Monitoreo)
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    -- Log de Auditoría Final
    SET @fin = GETDATE();
    EXEC [sat_comprobante].[dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'DASHBOARD',
        @i_lc_emisor    = NULL,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';

END;
GO
