USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[sphis_consulta_autorizaciones]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'sphis_consulta_autorizaciones_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy (preservamos la primera versión del día)
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'sphis_consulta_autorizaciones', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[sphis_consulta_autorizaciones];
    END
END
GO

CREATE PROCEDURE [dbo].[sphis_consulta_autorizaciones]
@i_IdAutorizacion bigint = null,
@i_EstatusAutorizador smallint = null,
@i_EstatusSatcom smallint = null,
@i_IdEmisor int ,
@i_NumComprobante varchar (30) = null,
@i_TipoComprobante varchar(5) = null,
@i_IdProveedor int = null,
@i_RazonSocialProveedor varchar(100) = null,
@i_IdentificacionProveedor varchar(20) = null,
@i_Pagina int = null,
@i_CorreoElectronico varchar(100) = null,
@i_HoraInicio datetime = null,
@i_HoraFin datetime = null,
@i_IdUsuario int,
@i_MinFechaConsulta datetime ,
@i_MaxFechaConsulta datetime,  
@i_MostrarDuplicados bit = 0
AS
BEGIN
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET NOCOUNT ON;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = DB_NAME() + '.' + OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX);

    -- LOG EJECUTIVO: Construir la cadena para poder replicar la ejecución exacta
    SET @params = CONCAT(
        'EXEC [dbo].[sphis_consulta_autorizaciones] ',
        '@i_IdAutorizacion = ', ISNULL(CAST(@i_IdAutorizacion AS VARCHAR), 'NULL'), ', ',
        '@i_EstatusAutorizador = ', ISNULL(CAST(@i_EstatusAutorizador AS VARCHAR), 'NULL'), ', ',
        '@i_EstatusSatcom = ', ISNULL(CAST(@i_EstatusSatcom AS VARCHAR), 'NULL'), ', ',
        '@i_IdEmisor = ', ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL'), ', ',
        '@i_NumComprobante = ', ISNULL('''' + @i_NumComprobante + '''', 'NULL'), ', ',
        '@i_TipoComprobante = ', ISNULL('''' + @i_TipoComprobante + '''', 'NULL'), ', ',
        '@i_IdProveedor = ', ISNULL(CAST(@i_IdProveedor AS VARCHAR), 'NULL'), ', ',
        '@i_RazonSocialProveedor = ', ISNULL('''' + @i_RazonSocialProveedor + '''', 'NULL'), ', ',
        '@i_IdentificacionProveedor = ', ISNULL('''' + @i_IdentificacionProveedor + '''', 'NULL'), ', ',
        '@i_Pagina = ', ISNULL(CAST(@i_Pagina AS VARCHAR), 'NULL'), ', ',
        '@i_CorreoElectronico = ', ISNULL('''' + @i_CorreoElectronico + '''', 'NULL'), ', ',
        '@i_HoraInicio = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraInicio, 120) + '''', 'NULL'), ', ',
        '@i_HoraFin = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraFin, 120) + '''', 'NULL'), ', ',
        '@i_IdUsuario = ', ISNULL(CAST(@i_IdUsuario AS VARCHAR), 'NULL'), ', ',
        '@i_MinFechaConsulta = ', ISNULL('''' + CONVERT(VARCHAR, @i_MinFechaConsulta, 120) + '''', 'NULL'), ', ',
        '@i_MaxFechaConsulta = ', ISNULL('''' + CONVERT(VARCHAR, @i_MaxFechaConsulta, 120) + '''', 'NULL'), ', ',
        '@i_MostrarDuplicados = ', ISNULL(CAST(@i_MostrarDuplicados AS VARCHAR), 'NULL')
    );

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY

        IF (@i_MinFechaConsulta IS NULL OR @i_MaxFechaConsulta IS NULL)
        BEGIN
            SET @i_MinFechaConsulta = @i_HoraInicio;
            SET @i_MaxFechaConsulta = @i_HoraFin;
        END
        
        -- 0<=>Root
        -- 1<=>Multiempresa
        -- 2<=>Usuario
        -- 3<=>Contribuyente
        -- 4<=>RootRemoto
        DECLARE @us_tipo_usuario smallint;
        CREATE TABLE #tabla_emisores (IdEmisor int);
        CREATE INDEX idx_tmp_dba01 ON #tabla_emisores(IdEmisor);
        
        SELECT @us_tipo_usuario = us_tipo_usuario
        FROM sat_seguridad.dbo.se_usuario
        WHERE us_id_usuario = @i_IdUsuario;
        
        IF (@us_tipo_usuario = 1)
        BEGIN
            INSERT INTO #tabla_emisores (
                IdEmisor
            )
            SELECT DISTINCT 
                em_id_emisor
            FROM sat_seguridad.dbo.se_usuario
            INNER JOIN sat_catalogo.dbo.sc_emisor ON (
                us_id_emisor = em_id_emisor
                AND us_id_usuario = @i_IdUsuario
            );

            INSERT INTO #tabla_emisores (
                IdEmisor
            )
            SELECT DISTINCT 
                ue_id_emisor
            FROM sat_seguridad.dbo.ss_usuario_emisor
            INNER JOIN sat_catalogo.dbo.sc_emisor ON em_id_emisor = ue_id_emisor
            WHERE ue_id_usuario = @i_IdUsuario
            AND ue_id_emisor NOT IN (SELECT DISTINCT IdEmisor FROM #tabla_emisores);
        END
        ELSE
        BEGIN
            INSERT INTO #tabla_emisores (
                IdEmisor
            )
            SELECT DISTINCT 
                em_id_emisor
            FROM sat_catalogo.dbo.sc_emisor;
        END

        IF (@i_EstatusSatcom <= 0)
            SELECT @i_EstatusSatcom = NULL;
        IF (@i_IdEmisor <= 0)
            SELECT @i_IdEmisor = NULL;
        IF (@i_EstatusAutorizador <= 0)
            SELECT @i_EstatusAutorizador = NULL;
        IF (@i_IdAutorizacion <= 0)
            SELECT @i_IdAutorizacion = NULL;
        IF (CONVERT(INT, @i_TipoComprobante) <= 0)
            SELECT @i_TipoComprobante = NULL;
        IF (@i_IdProveedor <= 0)
            SELECT @i_IdProveedor = NULL;

        DECLARE @num_por_consulta int,
                @co_id_cliente int,
                @now datetime,
                @aux nvarchar(20),
                @total int,
                @mensaje nvarchar(100);

        SELECT @now = GETDATE();
        SELECT @num_por_consulta = 2000;

        CREATE TABLE #borrar (IdAutorizacion decimal);
        CREATE TABLE #consulta (
            Ordinal int IDENTITY(1,1),
            IdAutorizacion decimal,
            HoraIn datetime,
            Estatus int,
            IdEmisor int,
            NumComprobante varchar(20),
            TipoComprobante varchar(5),
            FechaEmision datetime,
            ImporteTotal decimal(18,2),
            EstadoAutorizado smallint,
            TramaEntrada varbinary(MAX),
            Emisor varchar(100),
            TramaDto xml,
            NumeroAutorizacion varchar(50),
            FechaAutorizacion datetime,
            ClaveAcceso varchar(100),
            AsuntoMail varchar(200),
            IdProveedor int,
            RucProveedor varchar(200),
            RazonSocial varchar(200),
            Mail varchar(100),
            UsuarioPagoAutorizado varchar(100),
            FechaPagoAutorizado datetime,
            EstatusAutorizador smallint,
            Pais smallint,
            EstatusAprobacion smallint,
            Reprocesos smallint,
            FechaReproceso datetime,
            IdLicencia int,
            DescTipoComprobante varchar(100),
            Version varchar(30)
        );

        IF @i_IdAutorizacion IS NOT NULL    
            SELECT @i_MinFechaConsulta = NULL, @i_MaxFechaConsulta = NULL;
        ELSE IF @i_MinFechaConsulta IS NULL AND @i_MaxFechaConsulta IS NULL  
            SELECT @i_MinFechaConsulta = DATEADD(month, -3, GETDATE()), @i_MaxFechaConsulta = GETDATE();

        PRINT '1. Ejecutando consulta principal sobre com_log_autorizacion...';

        INSERT INTO #consulta (
            IdAutorizacion,
            HoraIn,
            Estatus,
            IdEmisor,
            NumComprobante,
            TipoComprobante,
            FechaEmision,
            ImporteTotal,
            TramaEntrada,
            Emisor,
            TramaDto,
            NumeroAutorizacion,
            FechaAutorizacion,
            ClaveAcceso,
            AsuntoMail,
            IdProveedor,
            RucProveedor,
            RazonSocial,
            Mail,
            UsuarioPagoAutorizado,
            FechaPagoAutorizado,
            EstatusAutorizador,
            Pais,
            EstatusAprobacion,
            Reprocesos,
            FechaReproceso,
            IdLicencia,
            DescTipoComprobante,
            Version
        )
        SELECT 
            co_id_autorizacion,
            TRY_CONVERT(datetime, co_hora_in),
            co_estatus,
            co_id_emisor,
            co_num_comprobante,
            co_tipo_comprobante,
            TRY_CONVERT(datetime, co_fecha_emision),
            co_importe_total,
            co_trama_entrada,
            ISNULL(em_nemonico, '-'),
            ISNULL(co_trama_dto, '-'),
            co_num_autorizacion,
            TRY_CONVERT(datetime, co_fecha_autorizacion),
            co_clave_acceso,
            co_asunto_mail,
            co_id_proveedor,
            cl.cl_identificacion,
            ISNULL(ce_razon_social, cl.cl_primer_nombre + ' ' + ISNULL(cl.cl_primer_apellido, '')) AS RazonSocial,
            co_mail,
            us_login,
            TRY_CONVERT(datetime, co_fecha_pago_autorizado),
            co_estatus_sri,
            co_pais,
            ISNULL(co_estatus_aprobacion, '0'),
            co_reprocesos,
            TRY_CONVERT(datetime, co_hora_reproceso),
            co_id_licencia,
            td.Valor2,
            co_version
        FROM com_log_autorizacion AS aut WITH (NOLOCK)
        INNER JOIN #tabla_emisores ON (co_id_emisor = IdEmisor)
        LEFT JOIN sat_catalogo.dbo.sc_emisor WITH (NOLOCK) ON co_id_emisor = em_id_emisor
        INNER JOIN sat_catalogo.dbo.fn_consulta_catalogo('TIPO_DOCUMENTO') AS td ON td.CodigoNegocio = aut.co_tipo_comprobante AND td.Pais = aut.co_pais
        LEFT JOIN [sat_comprobante].[dbo].[com_cliente] AS cl ON co_id_proveedor = cl.cl_id_cliente
        LEFT JOIN [sat_comprobante].[dbo].[com_cliente_emisor] AS ce ON cl.cl_id_cliente = ce.ce_id_cliente AND ce.ce_id_emisor = aut.co_id_emisor
        LEFT JOIN sat_seguridad.dbo.se_usuario ON co_id_usuario_pago_autorizado = us_id_usuario
        WHERE (@i_IdAutorizacion IS NULL OR co_id_autorizacion = @i_IdAutorizacion)
          AND (@i_EstatusAutorizador IS NULL OR @i_EstatusAutorizador = co_estatus_sri)
          AND (@i_EstatusSatcom IS NULL OR co_estatus = @i_EstatusSatcom)
          AND (@i_TipoComprobante IS NULL OR co_tipo_comprobante = @i_TipoComprobante)
          AND ((@i_MinFechaConsulta IS NULL AND @i_MaxFechaConsulta IS NULL) OR (co_fecha_emision BETWEEN @i_MinFechaConsulta AND @i_MaxFechaConsulta))
          AND (@i_IdEmisor IS NULL OR co_id_emisor = @i_IdEmisor)
          AND (@i_IdentificacionProveedor IS NULL OR cl_identificacion = @i_IdentificacionProveedor)
          AND (@i_IdProveedor IS NULL OR co_id_proveedor = @i_IdProveedor)
          AND (@i_NumComprobante IS NULL OR co_num_comprobante LIKE '%' + @i_NumComprobante + '%')
          AND (@i_RazonSocialProveedor IS NULL OR ce.ce_razon_social LIKE '%' + @i_RazonSocialProveedor + '%')
        ORDER BY co_tipo_comprobante, sat_catalogo.dbo.fn_convert_numeric(co_num_comprobante) DESC;

        -- Capturar el número de filas del proceso principal
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);
        PRINT '   Registros procesados: ' + SUBSTRING(@error_msg, 6, 20);

        SELECT @total = COUNT(*) FROM #consulta;
        PRINT '2. Paginando resultados. Total: ' + CAST(@total AS VARCHAR);
        
        SELECT @mensaje = 'Pg:' + CAST(@i_Pagina + 1 AS VARCHAR) + '/' + CAST((@total / @num_por_consulta) + 1 AS VARCHAR) + ', Total Comprobantes:' + CAST(@total AS VARCHAR);
        
        SELECT @i_Pagina = @num_por_consulta * @i_Pagina;
        
        IF (@i_Pagina > 0)
        BEGIN
            SET ROWCOUNT @i_Pagina;
            INSERT INTO #borrar (
                IdAutorizacion
            )
            SELECT 
                IdAutorizacion
            FROM #consulta
            ORDER BY HoraIn DESC;
            
            SET ROWCOUNT 0;
            
            DELETE #consulta
            FROM #borrar b 
            INNER JOIN #consulta c ON c.IdAutorizacion = b.IdAutorizacion;
        END
        
        SET ROWCOUNT @num_por_consulta;
        
        DELETE FROM #consulta
        WHERE EstadoAutorizado = 9;
        
        PRINT '3. Retornando datos finales...';

        SELECT
            IdAutorizacion,
            HoraIn,
            Estatus,
            IdEmisor,
            NumComprobante,
            TipoComprobante,
            FechaEmision,
            ImporteTotal,
            TramaEntrada,
            Emisor,
            TramaDto,
            NumeroAutorizacion,
            FechaAutorizacion,
            ClaveAcceso,
            AsuntoMail,
            IdProveedor,
            RucProveedor,
            RazonSocial,
            Mail,
            UsuarioPagoAutorizado,
            FechaPagoAutorizado,
            EstatusAutorizador,
            Pais,
            EstatusAprobacion,
            Reprocesos,
            FechaReproceso,
            IdLicencia,
            DescTipoComprobante,
            Version
        FROM #consulta
        WHERE (Pais = 57 AND EstatusAutorizador <> 14)
           OR (Pais <> 57)
          AND (@i_MostrarDuplicados = 1 OR (EstatusAutorizador <> 14 AND Estatus <> 9))
        ORDER BY HoraIn DESC;
        
        SET ROWCOUNT 0;

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

    -- Log de Auditoría Final
    SET @fin = GETDATE();
    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'BATCH',
        @i_lc_emisor    = @i_IdEmisor,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
END
GO
