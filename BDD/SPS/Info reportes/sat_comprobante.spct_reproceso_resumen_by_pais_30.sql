USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spct_reproceso_resumen_by_pais_30]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spct_reproceso_resumen_by_pais_30_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spct_reproceso_resumen_by_pais_30', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spct_reproceso_resumen_by_pais_30];
    END
END
GO

CREATE PROCEDURE [dbo].[spct_reproceso_resumen_by_pais_30]                   
AS  
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    DECLARE @inicio_proceso DATETIME = GETDATE(),
            @NombreSP VARCHAR(200) = 'spct_reproceso_resumen_by_pais_30',
            @params NVARCHAR(MAX) = 'EXEC [dbo].[spct_reproceso_resumen_by_pais_30]',
            @error_msg NVARCHAR(MAX);

    BEGIN TRY
        -- Configuración de rango de fechas (ventana de 60 días hacia atrás desde hace 5 días)
        DECLARE @fechaFin DATE = DATEADD(DAY, -5, GETDATE());   
        DECLARE @fechaFinLimite DATE = DATEADD(DAY, -60, @fechaFin); 

        -- Ejecución del proceso de hosting con formato 1x1 (un parámetro por línea)
        EXEC spct_reproceso_resumen_by_pais_hosting 
            @pais = NULL, 
            @borrar = NULL, 
            @fechaFin = @fechaFin, 
            @fechaInicio = @fechaFinLimite;

        SET @error_msg = 'rows:Ejecutado';

        DECLARE @fin_proceso DATETIME = GETDATE();
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_origen    = 'BDD',
            @i_lc_emisor    = NULL,
            @i_lc_parametros = @params,
            @i_lc_inicio    = @inicio_proceso,
            @i_lc_fin       = @fin_proceso,
            @i_lc_error     = @error_msg;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE(),
                @fin_error DATETIME = GETDATE();
        
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- Log de error en auditoría
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_origen    = 'BDD',
            @i_lc_parametros = @params,
            @i_lc_inicio    = @inicio_proceso,
            @i_lc_fin       = @fin_error,
            @i_lc_error     = @error_msg;

        -- Alerta a Postgres
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process  = @NombreSP,
            @message  = @ErrorMessage;

        PRINT 'ERROR EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW;
    END CATCH

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo: ' + CAST(DATEDIFF(SECOND, @inicio_proceso, GETDATE()) AS VARCHAR) + 's] ---';
END
GO
