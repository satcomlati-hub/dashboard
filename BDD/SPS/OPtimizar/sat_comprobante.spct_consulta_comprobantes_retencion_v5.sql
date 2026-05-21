USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spct_consulta_comprobantes_retencion_v5_all]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spct_consulta_comprobantes_retencion_v5_all_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spct_consulta_comprobantes_retencion_v5_all', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spct_consulta_comprobantes_retencion_v5_all];
    END
END
GO

CREATE PROCEDURE [dbo].[spct_consulta_comprobantes_retencion_v5_all]
    -- Parametros de reporte BASE
    -- comprobante
    @i_IdEmisor varchar(MAX) = null,
    @i_CodigoEstablecimiento varchar(3) = null,
    @i_CodigoPunto varchar(3) = null,
    -- fechas
    @i_HoraInicio date = null,
    @i_HoraFin date = null
AS      
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX); 

    SET @params = CONCAT(
        'EXEC [dbo].[', @NombreSP, '] ',
        '@i_IdEmisor = ', ISNULL('''' + @i_IdEmisor + '''', 'NULL'), ', ',
        '@i_CodigoEstablecimiento = ', ISNULL('''' + @i_CodigoEstablecimiento + '''', 'NULL'), ', ',
        '@i_CodigoPunto = ', ISNULL('''' + @i_CodigoPunto + '''', 'NULL'), ', ',
        '@i_HoraInicio = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraInicio, 120) + '''', 'NULL'), ', ',
        '@i_HoraFin = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraFin, 120) + '''', 'NULL')
    );

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY
        PRINT '1. [Preparación] - Eliminando tabla temporal si existe...';
        IF (OBJECT_ID('tempdb.dbo.#consulta_spct_consulta_comprobantes_retencion','U')) IS NOT NULL      
            DROP TABLE #consulta_spct_consulta_comprobantes_retencion;

        CREATE TABLE #consulta_retencion (      
            Num decimal(30,0) IDENTITY(1,1),      
            IdReq decimal(30,0),      
            IdCli decimal(30,0),      
            IdEstado decimal(30,0),      
            Id_Emisor int,      
            Cedula_RUC varchar(50),      
            RazonSocial varchar(200),      
            Serie varchar(20),      
            Documento varchar(30),      
            Fecha datetime,      
            DocAplicado varchar(200),      
            TipoRetencion varchar(20),      
            CodigoPorcentaje varchar(20),      
            Porcentaje varchar(20),      
            BaseImponible decimal(18,2),      
            ValorRetenido decimal(18,2),      
            TotalRetencion decimal(18,2),      
            Estado varchar(60),      
            Autorizacion varchar(50),      
            FechaAutorizacion datetime,      
            Establecimiento varchar(20),      
            Punto varchar(20)      
        );

        CREATE INDEX index_temp ON #consulta_retencion(IdReq);

        PRINT '2. [Inserción] - Obteniendo datos base de com_aux_reportes_SRI...';
        INSERT INTO #consulta_retencion (      
            IdReq,      
            Id_Emisor,      
            DocAplicado,      
            TipoRetencion,      
            CodigoPorcentaje,      
            Porcentaje,      
            BaseImponible,      
            ValorRetenido      
        )      
        SELECT      
            Id,      
            aux.IdEmisor,      
            DocAplicado,      
            TipoRetencion,      
            CodigoPorcentaje,      
            Porcentaje,      
            BaseImpRetencion,      
            ValorRetenido      
        FROM com_aux_reportes_SRI aux WITH (NOLOCK)      
        INNER JOIN dbo.fn_split_string(@i_IdEmisor, ',') AS em      
            ON aux.IdEmisor = em.valor      
        WHERE aux.FechaEmision BETWEEN @i_HoraInicio AND @i_HoraFin      
        AND aux.TipoRetencion IS NOT NULL; -- Identificador de retenciones      

        PRINT '   Registros insertados (Paso 2): ' + CAST(@@ROWCOUNT AS VARCHAR);

        PRINT '2.5. [Inserción] - Extrayendo retenciones No Autorizadas desde XML...';
        INSERT INTO #consulta_retencion (      
            IdReq,      
            Id_Emisor,      
            DocAplicado,      
            TipoRetencion,      
            CodigoPorcentaje,      
            Porcentaje,      
            BaseImponible,      
            ValorRetenido      
        )      
        SELECT DISTINCT      
            aux.co_id_comprobante,      
            aux.co_id_emisor,      
            docs.doc.value('(NumeroDocumento)[1]', 'varchar(50)'),
            REPLACE(t3.dato.value('(CodigoImpuesto)[1]', 'varchar(5)'), '|', ''),
            REPLACE(t3.dato.value('(CodigoPorcentaje)[1]', 'varchar(5)'), '|', ''),
            t3.dato.value('(Porcentaje)[1]', 'varchar(30)'),
            ISNULL(TRY_CONVERT(decimal(18,2), t3.dato.value('(BaseImponible)[1]', 'varchar(30)')), 0),
            TRY_CONVERT(decimal(18,2), t3.dato.value('(Valor)[1]', 'varchar(30)'))
        FROM com_comprobante_aux t1 WITH (NOLOCK) 
        INNER JOIN com_log_comprobante_xml aux WITH (NOLOCK)      
            ON aux.co_id_comprobante = t1.co_id_comprobante 
            AND aux.co_id_emisor = t1.co_id_emisor
        INNER JOIN dbo.fn_split_string(@i_IdEmisor, ',') AS em      
            ON t1.co_id_emisor = em.valor      
        CROSS APPLY t1.co_trama_dto.nodes('//Requerimiento/DocumentosAsociados/Documento') docs(doc)  
        CROSS APPLY docs.doc.nodes('Retenciones/Retencion') t3(dato)  
        WHERE t1.co_fecha_emision BETWEEN @i_HoraInicio AND @i_HoraFin      
        AND t1.co_codigo_tipo_Documento = '07'
        AND t1.co_pais = 593
        AND t1.co_id_comprobante NOT IN (SELECT DISTINCT IdReq FROM #consulta_retencion WHERE IdReq IS NOT NULL);

        PRINT '   Registros insertados (Paso 2.5): ' + CAST(@@ROWCOUNT AS VARCHAR);

        PRINT '3. [Actualización] - Complementando datos con com_log_comprobante_xml...';
        UPDATE #consulta_retencion      
        SET      
            IdCli = xml.co_id_cliente,      
            IdEstado = xml.co_estatus,      
            Serie = SUBSTRING(xml.co_num_comprobante, 1, 7),      
            Documento = SUBSTRING(xml.co_num_comprobante, 9, 9),      
            Fecha = xml.co_fecha_emision,      
            TotalRetencion = ISNULL(xml.co_total_comprobante, 0),      
            Autorizacion = xml.co_num_autorizacion,      
            FechaAutorizacion = xml.co_fecha_autorizacion,      
            Establecimiento = xml.co_establecimiento,      
            Punto = xml.co_punto_emision,
            Cedula_RUC = xml.co_identificacion,      
            RazonSocial = xml.co_razon_social
        FROM com_log_comprobante_xml xml WITH (NOLOCK)      
        WHERE #consulta_retencion.IdReq = xml.co_id_comprobante      
        AND #consulta_retencion.Id_Emisor = xml.co_id_emisor;

        PRINT '   Registros actualizados (Paso 3): ' + CAST(@@ROWCOUNT AS VARCHAR);

        PRINT '4. [Actualización] - Resolviendo estados y tipos de retención...';
        UPDATE #consulta_retencion      
        SET Estado = estados.Descripcion      
        FROM sat_catalogo.dbo.sc_vista_estados_documentos estados      
        WHERE CONVERT(VARCHAR(10), #consulta_retencion.IdEstado) LIKE estados.Codigo;
        
        UPDATE #consulta_retencion      
        SET TipoRetencion = 'RENTA'      
        WHERE TipoRetencion = '1';
        
        UPDATE #consulta_retencion      
        SET TipoRetencion = 'IVA'      
        WHERE TipoRetencion <> 'RENTA';
        
        PRINT '5. [Resultado] - Generando consulta final...';
        SELECT DISTINCT      
            Cedula_RUC,      
            RazonSocial,      
            Serie,      
            Documento,      
            Fecha,      
            DocAplicado,      
            TipoRetencion,      
            CodigoPorcentaje,      
            BaseImponible,      
            Porcentaje,      
            ValorRetenido,      
            TotalRetencion,      
            Estado,      
            Autorizacion,      
            FechaAutorizacion,      
            IdReq,      
            Establecimiento,      
            Punto      
        FROM #consulta_retencion      
        WHERE DocAplicado IS NOT NULL      
        AND Estado NOT IN ('DuplicadoSatcom', 'PendienteValidacionSATCOM')      
        AND (@i_CodigoEstablecimiento IS NULL OR @i_CodigoEstablecimiento = Establecimiento)      
        AND (@i_CodigoPunto IS NULL OR @i_CodigoPunto = Punto)      
        ORDER BY Serie, Documento;
        
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
        PRINT '   Registros procesados y enviados: ' + CAST(@@ROWCOUNT AS VARCHAR);

        DROP TABLE #consulta_retencion;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    SET @fin = GETDATE();
    
    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp  = @NombreSP,
        @i_lc_appname    = 'BATCH',
        @i_lc_emisor     = @i_IdEmisor,
        @i_lc_parametros = @params,
        @i_lc_origen     = 'BDD',
        @i_lc_inicio     = @inicio,
        @i_lc_fin        = @fin,
        @i_lc_error      = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
    
    RETURN 0;
END
