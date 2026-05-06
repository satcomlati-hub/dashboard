USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spct_reproceso_resumen_by_pais]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spct_reproceso_resumen_by_pais_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spct_reproceso_resumen_by_pais', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spct_reproceso_resumen_by_pais];
    END
END
GO

CREATE PROCEDURE [dbo].[spct_reproceso_resumen_by_pais]                     
    @pais INT = NULL,
    @borrar BIT = 0,
    @fechaFin DATE = NULL,
    @fechaInicio DATE = NULL  
AS               
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    DECLARE @inicio_proceso DATETIME = GETDATE(),
            @NombreSP VARCHAR(200) = 'spct_reproceso_resumen_by_pais',
            @params NVARCHAR(MAX),
            @error_msg NVARCHAR(MAX),
            @nombreBDD NVARCHAR(128) = DB_NAME();

    -- LOG EJECUTIVO: Formato replicable para depuración
    SET @params = 'EXEC [dbo].[' + @NombreSP + '] ' +
                  '@pais = ' + ISNULL(CAST(@pais AS VARCHAR), 'NULL') + ', ' +
                  '@borrar = ' + ISNULL(CAST(@borrar AS VARCHAR), 'NULL') + ', ' +
                  '@fechaFin = ' + ISNULL('''' + CAST(@fechaFin AS VARCHAR) + '''', 'NULL') + ', ' +
                  '@fechaInicio = ' + ISNULL('''' + CAST(@fechaInicio AS VARCHAR) + '''', 'NULL');

    BEGIN TRY
        -- Validación de Entorno Restringido (Hosting / JOB Producción)
        IF ((@@SERVERNAME = 'SRVBDDMSPROD\MSPROD2022' OR @@SERVERNAME = 'EC2AMAZ-IVL1JSC') AND @nombreBDD = 'sat_comprobante')
        BEGIN
            PRINT '>>> Ejecución cancelada: Hosting trabaja con JOB en entorno PROD: ' + @nombreBDD;
            SET @error_msg = 'Ejecución cancelada por restricciones de entorno (Hosting/JOB)';
            GOTO REGISTRAR_LOG;
        END

        -- Ejecución del proceso remoto con formato de legibilidad (1 parámetro por línea)
        EXEC sat_comprobante.dbo.spct_reproceso_resumen_by_pais_hosting 
            @pais = @pais, 
            @borrar = @borrar, 
            @fechaFin = @fechaFin, 
            @fechaInicio = @fechaInicio;

        SET @error_msg = 'rows:Ejecutado';

        REGISTRAR_LOG:
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
            @country  = @pais,
            @message  = @ErrorMessage;

        PRINT 'ERROR EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW;
    END CATCH

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo: ' + CAST(DATEDIFF(SECOND, @inicio_proceso, GETDATE()) AS VARCHAR) + 's] ---';
END
GO
