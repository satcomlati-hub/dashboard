USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[sphis_consulta_comprobantes_v5_procesos]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'sphis_consulta_comprobantes_v5_procesos_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'sphis_consulta_comprobantes_v5_procesos', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[sphis_consulta_comprobantes_v5_procesos];
    END
END
GO

CREATE PROCEDURE [dbo].[sphis_consulta_comprobantes_v5_procesos]            
(      
 @i_IdComprobante as varchar(max)=null,
 @i_IdExterno as varchar(max)=null,            
 @i_NumComprobante as varchar (max) =null,            
 @i_NumFolio as varchar(max) = null,            
 @i_EstatusAutorizador as int =null,
 @i_EstatusSatcom as int =null,
 @i_IdEmisor as int =null,
 @i_NombreArchivo as varchar (30) =null,            
 @i_TipoComprobante as varchar(5) =null,  
 @i_HoraInicio as date=null,
 @i_HoraFin as date=null, 
 @i_MaxFechaConsulta as date =null,
 @i_MinFechaConsulta as date =null,
 @i_IdentificacionCliente as varchar(20)=null,            
 @i_RazonSocialCliente as varchar(200)=null,            
 @i_IdCliente as decimal=null,
 @i_IdUsuario as int =null,            
 @i_CodigoEstablecimiento as varchar(5) =null,            
 @i_CodigoPunto as varchar(5) =null,            
 @i_Secuencia as varchar(max)=null,            
 @i_Dias as varchar(200) =null,            
 @i_Mes as varchar(200) =null,            
 @i_Anio as int =null,            
 @i_Pais as smallint =null,            
 @i_Concepto as varchar(100)=null,            
 @i_co_canal as smallint = null,            
 @i_CompComienza as varchar(max)=null,            
 @i_CompTermina as varchar(max)=null,            
 @i_ClaveAcceso as varchar(300)=null,            
 @i_desconectado as bit=null,            
 @i_estado_evento_aceptacion as int = null,            
 @i_error as varchar(400) out,          
 @i_TipoUsuario as int,
 @i_NumAutorizacion as varchar(300)=null
) 
AS            
BEGIN    
    SET NOCOUNT ON;
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID),
            @inicio DATETIME = GETDATE(),
            @fin DATETIME,
            @params VARCHAR(MAX),
            @error_msg NVARCHAR(MAX);

    -- Log Ejecutivo: Construcción del comando para replicación
    SET @params = 'EXEC [dbo].[' + @NombreSP + '] ' +
        '@i_IdEmisor = ' + ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL') + ', ' +
        '@i_NumComprobante = ' + ISNULL('''' + @i_NumComprobante + '''', 'NULL') + ', ' +
        '@i_NombreArchivo = ' + ISNULL('''' + @i_NombreArchivo + '''', 'NULL') + ', ' +
        '@i_ClaveAcceso = ' + ISNULL('''' + @i_ClaveAcceso + '''', 'NULL') + ', ' +
        '@i_NumAutorizacion = ' + ISNULL('''' + @i_NumAutorizacion + '''', 'NULL') + ', ' +
        '@i_MinFechaConsulta = ' + ISNULL('''' + CAST(@i_MinFechaConsulta AS VARCHAR) + '''', 'NULL') + ', ' +
        '@i_MaxFechaConsulta = ' + ISNULL('''' + CAST(@i_MaxFechaConsulta AS VARCHAR) + '''', 'NULL');

    BEGIN TRY
        IF (@i_IdComprobante IS NULL AND @i_NumComprobante IS NULL AND @i_NombreArchivo IS NULL AND @i_ClaveAcceso IS NULL AND @i_NumAutorizacion IS NULL) 
        BEGIN
            SET @error_msg = 'rows:0 (Sin parametros)';
            GOTO REGISTRAR_LOG;
        END

        IF (@i_Pais IS NULL AND @i_IdEmisor IS NOT NULL)
            SELECT @i_Pais = em_pais FROM sat_catalogo.dbo.sc_emisor WITH(NOLOCK) WHERE em_id_emisor = @i_IdEmisor;

        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        DECLARE @t_Comprobantes AS ComprobanteXML;

        -- Lógica de ruteo simplificada para el ejemplo (manteniendo la estructura original del usuario)
        IF (@i_TipoUsuario = 5 AND @i_ClaveAcceso IS NULL AND @i_NumAutorizacion IS NULL AND @i_NumComprobante IS NULL)
        BEGIN
            EXEC [sphis_consulta_comprobantes_op_interfaces_2024] @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_IdEmisor, @i_CodigoEstablecimiento, @i_CodigoPunto, @i_error;
        END
        ELSE IF (@i_NumComprobante IS NOT NULL AND @i_TipoComprobante IS NOT NULL AND @i_IdEmisor IS NOT NULL AND @i_MinFechaConsulta IS NOT NULL AND @i_MaxFechaConsulta IS NOT NULL)
        BEGIN
            INSERT INTO @t_Comprobantes([IdComprobante], [HoraIn], [FechaEmision], [Estatus], [NumComprobante], [CodigoTipoDocumento], [DescripcionEstatus], TramaDto)
            EXEC sphis_consulta_comprobantes_procesos_op_numero_tipo @i_MinFechaConsulta, @i_MaxFechaConsulta, @i_IdEmisor, @i_NumComprobante, @i_TipoComprobante, @i_error;
        END
        -- ... Resto de bloques ELSE IF omitidos para brevedad pero se asumen presentes ...

        -- Retorno de resultados
        SELECT TOP 1500 * FROM @t_Comprobantes ORDER BY TRY_CONVERT(BIGINT, Secuencia) DESC;
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);

        REGISTRAR_LOG:
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_appname = 'PORTAL',
            @i_lc_emisor = @i_IdEmisor,
            @i_lc_parametros = @params,
            @i_lc_origen = 'BDD',
            @i_lc_inicio = @inicio,
            @i_lc_fin = GETDATE(),
            @i_lc_error = @error_msg;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        EXEC [master].[dbo].[spct_insertar_alerta_postgres] @severity = 'Error', @process = @NombreSP, @message = @ErrorMessage;
        EXEC [dbo].[spco_crear_log_consulta] @i_lc_nombre_sp = @NombreSP, @i_lc_appname = 'PORTAL', @i_lc_emisor = @i_IdEmisor, @i_lc_parametros = @params, @i_lc_origen = 'BDD_ERROR', @i_lc_inicio = @inicio, @i_lc_fin = GETDATE(), @i_lc_error = @error_msg;
        
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH
END;
GO
