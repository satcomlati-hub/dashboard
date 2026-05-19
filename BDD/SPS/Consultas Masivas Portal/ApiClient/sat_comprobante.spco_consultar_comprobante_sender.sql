USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spco_consultar_comprobante_sender]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spco_consultar_comprobante_sender_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spco_consultar_comprobante_sender', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spco_consultar_comprobante_sender];
    END
END
GO

CREATE PROCEDURE [dbo].[spco_consultar_comprobante_sender]    
 @i_co_id_emisor int,    
 @i_co_establecimiento varchar (10) = null,    
 @i_co_punto_emision varchar (10) = null,     
 @i_co_nombre_archivo varchar (max)  = null,  
 @i_co_comprobantes varchar (max) = null    
AS    
BEGIN    
    SET NOCOUNT ON;
    
    DECLARE @params VARCHAR(MAX), 
            @fin DATETIME, 
            @inicio DATETIME = GETDATE(),
            @row_count INT = 0,
            @error_msg NVARCHAR(MAX) = NULL;

    -- Construcción de la ejecución completa para el log
    SELECT @params = 'EXEC [dbo].[spco_consultar_comprobante_sender] ' +
        '@i_co_id_emisor = ' + ISNULL(CAST(@i_co_id_emisor AS VARCHAR), 'NULL') + ', ' +
        '@i_co_establecimiento = ' + ISNULL('''' + @i_co_establecimiento + '''', 'NULL') + ', ' +
        '@i_co_punto_emision = ' + ISNULL('''' + @i_co_punto_emision + '''', 'NULL') + ', ' +
        '@i_co_nombre_archivo = ' + ISNULL('''' + @i_co_nombre_archivo + '''', 'NULL') + ', ' +
        '@i_co_comprobantes = ' + ISNULL('''' + @i_co_comprobantes + '''', 'NULL');

    BEGIN TRY
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    
        IF (ISNULL(@i_co_comprobantes, '') <> '')    
        BEGIN   
            WITH CTE_comprobantes AS (
                SELECT DISTINCT CAST(Value AS DECIMAL(18,0)) AS entero      
                FROM STRING_SPLIT(@i_co_comprobantes, ',')  
            )
            SELECT 
                 [co_id_comprobante] AS IdComprobante      
                ,[co_id_emisor] AS IdEmisor      
                ,[co_num_comprobante] AS NumComprobante      
                ,REPLACE([co_nombre_archivo], 'SP:', '') AS NombreArchivo      
                ,[co_fecha_emision] AS FechaEmision      
                ,[co_codigo_tipo_documento] AS CodigoTipoDocumento      
                ,[co_num_autorizacion] AS NumAutorizacion      
                ,[co_establecimiento] AS Establecimiento      
                ,[co_punto_emision] AS Punto      
                ,[co_secuencia] AS Secuencia      
                ,[co_guest_remoto] AS GuestRemoto      
                ,[co_guest_app] AS GuestApp      
                ,[co_guest_version] AS GuestVersion      
                ,[co_estatus] AS Estatus      
            FROM [sat_comprobante].[dbo].[com_log_comprobante_xml] WITH(NOLOCK)      
            WHERE co_id_emisor = @i_co_id_emisor  
              AND co_fecha_emision > DATEADD(MONTH, -4, GETDATE())  
              AND co_id_comprobante IN (SELECT entero FROM CTE_comprobantes);

            SET @row_count = @@ROWCOUNT;
        END    
        ELSE   
        BEGIN  
            IF (@i_co_nombre_archivo IS NULL) RETURN 0;  
            
            WITH CTE_comprobantes2 AS (
                SELECT DISTINCT value AS nombre      
                FROM STRING_SPLIT(@i_co_nombre_archivo, ',')  
            )
            SELECT 
                 [co_id_comprobante] AS IdComprobante    
                ,[co_id_emisor] AS IdEmisor    
                ,[co_num_comprobante] AS NumComprobante    
                ,REPLACE([co_nombre_archivo], 'SP:', '') AS NombreArchivo    
                ,[co_fecha_emision] AS FechaEmision    
                ,[co_codigo_tipo_documento] AS CodigoTipoDocumento    
                ,[co_num_autorizacion] AS NumAutorizacion    
                ,[co_establecimiento] AS Establecimiento    
                ,[co_punto_emision] AS Punto    
                ,[co_secuencia] AS Secuencia    
                ,[co_guest_remoto] AS GuestRemoto    
                ,[co_guest_app] AS GuestApp    
                ,[co_guest_version] AS GuestVersion    
                ,[co_estatus] AS Estatus    
            FROM [sat_comprobante].[dbo].[com_log_comprobante_xml] WITH(NOLOCK)    
            WHERE co_id_emisor = @i_co_id_emisor    
              AND co_nombre_archivo IS NOT NULL   
              AND co_establecimiento = @i_co_establecimiento  
              AND co_punto_emision = @i_co_punto_emision  
              AND co_fecha_emision > DATEADD(MONTH, -1, GETDATE())
              AND co_nombre_archivo IN (SELECT nombre FROM CTE_comprobantes2);

            SET @row_count = @@ROWCOUNT;
        END    

        SET @error_msg = 'rows:' + CAST(@row_count AS VARCHAR);

    END TRY
    BEGIN CATCH
        SET @error_msg = 'rows:Error - ' + ERROR_MESSAGE();
    END CATCH
 
    SELECT @fin = GETDATE();

    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = 'spco_consultar_comprobante_sender',
        @i_lc_hostname  = NULL,
        @i_lc_appname   = 'batch',
        @i_lc_emisor    = @i_co_id_emisor,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'Bitacora',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg, -- Aquí se guarda el conteo de filas
        @i_lc_usuario   = NULL;
  
END
GO
