USE [sat_comprobante]
GO

-- =============================================
-- Autor:           Antigravity (Optimization)
-- Fecha Creación:  2026-05-06
-- Descripción:     Wrapper para Ecuador (593) con Log Ejecutivo y Control de Concurrencia.
-- =============================================

IF OBJECT_ID('[dbo].[consulta_tablero_no_autorizados_2026_EC]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'consulta_tablero_no_autorizados_2026_EC_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'consulta_tablero_no_autorizados_2026_EC', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_EC];
    END
END
GO

CREATE PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_EC]
AS
BEGIN
    SET NOCOUNT ON;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX) = 'rows:0';
    DECLARE @res_lock INT;

    -- LOG EJECUTIVO: Construir la cadena para poder replicar la ejecución exacta
    SET @params = 'EXEC [dbo].[' + @NombreSP + ']';

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    -- CONTROL DE CONCURRENCIA: Asegurar que solo se ejecute una instancia a la vez
    EXEC @res_lock = sp_getapplock 
        @Resource = @NombreSP, 
        @LockMode = 'Exclusive', 
        @LockOwner = 'Session', 
        @LockTimeout = 0;

    IF @res_lock < 0
    BEGIN
        SET @error_msg = 'rows:Error - Proceso en ejecución (Lock activo)';
        PRINT '>>> ADVERTENCIA: El proceso ' + @NombreSP + ' ya se encuentra en ejecución. Se aborta esta instancia.';
        
        -- Loguear el intento fallido por bloqueo
        SET @fin = GETDATE();
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_appname   = 'BATCH',
            @i_lc_emisor    = 0,
            @i_lc_parametros = @params,
            @i_lc_origen    = 'BDD',
            @i_lc_inicio    = @inicio,
            @i_lc_fin       = @fin,
            @i_lc_error     = @error_msg;

        RETURN;
    END

    BEGIN TRY
        PRINT '1. Ejecutando Proceso para Ecuador (593)...';
        
        EXEC [dbo].[consulta_tablero_no_autorizados_2026_OTROS] @i_Pais = 593;

        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
        PRINT '   Proceso completado correctamente.';

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- ALERTA OBLIGATORIA A POSTGRES EN CASO DE ERROR
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;

        PRINT '>>> ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
    END CATCH

    -- LIBERAR LOCK
    EXEC sp_releaseapplock @Resource = @NombreSP, @LockOwner = 'Session';

    -- LOG DE AUDITORÍA FINAL
    SET @fin = GETDATE();
    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'BATCH',
        @i_lc_emisor    = 0,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
END;
GO
