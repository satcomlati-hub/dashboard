USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[sphis_consulta_comprobantes_procesos_op_numero_tipo]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'sphis_consulta_comprobantes_procesos_op_numero_tipo_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'sphis_consulta_comprobantes_procesos_op_numero_tipo', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[sphis_consulta_comprobantes_procesos_op_numero_tipo];
    END
END
GO

CREATE PROCEDURE [dbo].[sphis_consulta_comprobantes_procesos_op_numero_tipo]          
(     
 @i_MinFechaConsulta date,  
 @i_MaxFechaConsulta date,   
 @i_IdEmisor as int,  
 @i_NumComprobante as varchar (100),  
 @i_TipoComprobante as varchar (5),  
 @i_error as varchar(400) out     
) 
WITH RECOMPILE        
AS 
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    DECLARE @inicio_proceso DATETIME = GETDATE(),
            @params NVARCHAR(MAX),
            @sp_name VARCHAR(200) = 'sphis_consulta_comprobantes_procesos_op_numero_tipo',
            @error_msg NVARCHAR(MAX),
            @contador BIGINT = 0;

    -- Log Ejecutivo: Replicación de comando SQL
    SET @params = 'EXEC [dbo].[' + @sp_name + '] ' +
                  '@i_MinFechaConsulta = ' + ISNULL('''' + CAST(@i_MinFechaConsulta AS VARCHAR) + '''', 'NULL') + ', ' +
                  '@i_MaxFechaConsulta = ' + ISNULL('''' + CAST(@i_MaxFechaConsulta AS VARCHAR) + '''', 'NULL') + ', ' +
                  '@i_IdEmisor = ' + ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL') + ', ' +
                  '@i_NumComprobante = ' + ISNULL('''' + @i_NumComprobante + '''', 'NULL') + ', ' +
                  '@i_TipoComprobante = ' + ISNULL('''' + @i_TipoComprobante + '''', 'NULL');

    -- Exclusión solicitada: Emisor 517
    IF (@i_IdEmisor = 517)
    BEGIN
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @sp_name,
            @i_lc_emisor = @i_IdEmisor,
            @i_lc_parametros = @params,
            @i_lc_origen = 'EXCLUSION_ID_517',
            @i_lc_inicio = @inicio_proceso,
            @i_lc_fin = GETDATE(),
            @i_lc_error = 'rows:0 (Excluido 517)';
        RETURN 0;
    END

    BEGIN TRY
        DECLARE @t_Comprobantes AS ComprobanteXML;
  
        INSERT INTO @t_Comprobantes ([IdComprobante], [HoraIn], [FechaEmision], [Estatus], [NumComprobante], [CodigoTipoDocumento], DescripcionEstatus, TramaDto)       
        SELECT [co_id_comprobante], [co_hora_in], [co_fecha_emision], [co_estatus], [co_num_comprobante], [co_codigo_tipo_documento], DescripcionEstatus, co_trama_dto  
        FROM com_log_comprobante_xml WITH(NOLOCK)   
        LEFT OUTER JOIN sat_catalogo.dbo.sc_vista_estados_documentos ON co_estatus = CodigoEstatus  
        WHERE co_id_emisor = @i_IdEmisor AND co_num_comprobante = @i_NumComprobante AND co_codigo_tipo_documento = @i_TipoComprobante  
        AND EXISTS(SELECT 1 FROM sat_catalogo.dbo.sc_vista_estados_autorizados WHERE CodigoEstatus = co_estatus);
  
        IF (@@ROWCOUNT = 0)  
        BEGIN  
            INSERT INTO @t_Comprobantes ([IdComprobante], [HoraIn], [FechaEmision], [Estatus], [NumComprobante], [CodigoTipoDocumento], DescripcionEstatus)       
            SELECT [co_id_comprobante], [co_hora_in], [co_fecha_emision], [co_estatus], [co_num_comprobante], [co_codigo_tipo_documento], DescripcionEstatus  
            FROM com_log_comprobante_xml WITH(NOLOCK)   
            LEFT OUTER JOIN sat_catalogo.dbo.sc_vista_estados_documentos ON co_estatus = CodigoEstatus  
            WHERE co_id_emisor = @i_IdEmisor AND co_num_comprobante = @i_NumComprobante AND co_codigo_tipo_documento = @i_TipoComprobante;
        END  

        -- Retorno de resultados
        SELECT [IdComprobante], [HoraIn], [FechaEmision], [Estatus], [NumComprobante], [CodigoTipoDocumento], DescripcionEstatus, TramaDto  
        FROM @t_Comprobantes;

        SELECT @contador = COUNT(1) FROM @t_Comprobantes;    
        SET @error_msg = 'rows:' + CAST(@contador AS VARCHAR);

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @i_error = LEFT(@ErrorMessage, 400);
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        EXEC [master].[dbo].[spct_insertar_alerta_postgres] @severity = 'Error', @process = @sp_name, @issuing = @i_IdEmisor, @message = @ErrorMessage;
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH

    -- Log de Auditoría Final
    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @sp_name,
        @i_lc_emisor = @i_IdEmisor,
        @i_lc_parametros = @params,
        @i_lc_origen = 'BDD',
        @i_lc_inicio = @inicio_proceso,
        @i_lc_fin = GETDATE(),
        @i_lc_error = @error_msg;
END;
GO
