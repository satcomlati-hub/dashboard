USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[sphis_consulta_comprobantes_v5_bitacora]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'sphis_consulta_comprobantes_v5_bitacora_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'sphis_consulta_comprobantes_v5_bitacora', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[sphis_consulta_comprobantes_v5_bitacora];
    END
END
GO

CREATE PROCEDURE [dbo].[sphis_consulta_comprobantes_v5_bitacora]              
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
    @i_MostrarDuplicados bit = 0  
)      
AS              
BEGIN   
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = DB_NAME() + '.' + OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX);
    DECLARE @row_count INT = 0;

    -- Captura de parámetros en formato ejecutable replicable (concatenación segura)
    SET @params = CONCAT(
        'EXEC [dbo].[sphis_consulta_comprobantes_v5_bitacora] ',
        '@i_IdComprobante = ', ISNULL('''' + @i_IdComprobante + '''', 'NULL'), ', ',
        '@i_IdExterno = ', ISNULL('''' + @i_IdExterno + '''', 'NULL'), ', ',
        '@i_NumComprobante = ', ISNULL('''' + @i_NumComprobante + '''', 'NULL'), ', ',
        '@i_NumFolio = ', ISNULL('''' + @i_NumFolio + '''', 'NULL'), ', ',
        '@i_EstatusAutorizador = ', ISNULL(CAST(@i_EstatusAutorizador AS VARCHAR), 'NULL'), ', ',
        '@i_EstatusSatcom = ', ISNULL(CAST(@i_EstatusSatcom AS VARCHAR), 'NULL'), ', ',
        '@i_IdEmisor = ', ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL'), ', ',
        '@i_NombreArchivo = ', ISNULL('''' + @i_NombreArchivo + '''', 'NULL'), ', ',
        '@i_TipoComprobante = ', ISNULL('''' + @i_TipoComprobante + '''', 'NULL'), ', ',
        '@i_HoraInicio = ', ISNULL('''' + CONVERT(VARCHAR(10), @i_HoraInicio, 120) + '''', 'NULL'), ', ',
        '@i_HoraFin = ', ISNULL('''' + CONVERT(VARCHAR(10), @i_HoraFin, 120) + '''', 'NULL'), ', ',
        '@i_MaxFechaConsulta = ', ISNULL('''' + CONVERT(VARCHAR(10), @i_MaxFechaConsulta, 120) + '''', 'NULL'), ', ',
        '@i_MinFechaConsulta = ', ISNULL('''' + CONVERT(VARCHAR(10), @i_MinFechaConsulta, 120) + '''', 'NULL'), ', ',
        '@i_IdentificacionCliente = ', ISNULL('''' + @i_IdentificacionCliente + '''', 'NULL'), ', ',
        '@i_RazonSocialCliente = ', ISNULL('''' + @i_RazonSocialCliente + '''', 'NULL'), ', ',
        '@i_IdCliente = ', ISNULL(CAST(@i_IdCliente AS VARCHAR), 'NULL'), ', ',
        '@i_IdUsuario = ', ISNULL(CAST(@i_IdUsuario AS VARCHAR), 'NULL'), ', ',
        '@i_CodigoEstablecimiento = ', ISNULL('''' + @i_CodigoEstablecimiento + '''', 'NULL'), ', ',
        '@i_CodigoPunto = ', ISNULL('''' + @i_CodigoPunto + '''', 'NULL'), ', ',
        '@i_Secuencia = ', ISNULL('''' + @i_Secuencia + '''', 'NULL'), ', ',
        '@i_Dias = ', ISNULL('''' + @i_Dias + '''', 'NULL'), ', ',
        '@i_Mes = ', ISNULL('''' + @i_Mes + '''', 'NULL'), ', ',
        '@i_Anio = ', ISNULL(CAST(@i_Anio AS VARCHAR), 'NULL'), ', ',
        '@i_Pais = ', ISNULL(CAST(@i_Pais AS VARCHAR), 'NULL'), ', ',
        '@i_Concepto = ', ISNULL('''' + @i_Concepto + '''', 'NULL'), ', ',
        '@i_co_canal = ', ISNULL(CAST(@i_co_canal AS VARCHAR), 'NULL'), ', ',
        '@i_CompComienza = ', ISNULL('''' + @i_CompComienza + '''', 'NULL'), ', ',
        '@i_CompTermina = ', ISNULL('''' + @i_CompTermina + '''', 'NULL'), ', ',
        '@i_ClaveAcceso = ', ISNULL('''' + @i_ClaveAcceso + '''', 'NULL'), ', ',
        '@i_desconectado = ', ISNULL(CAST(@i_desconectado AS VARCHAR), 'NULL'), ', ',
        '@i_estado_evento_aceptacion = ', ISNULL(CAST(@i_estado_evento_aceptacion AS VARCHAR), 'NULL'), ', ',
        '@i_TipoUsuario = ', ISNULL(CAST(@i_TipoUsuario AS VARCHAR), 'NULL'), ', ',
        '@i_MostrarDuplicados = ', ISNULL(CAST(@i_MostrarDuplicados AS VARCHAR), 'NULL')
    );

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY
        DECLARE @w_top int = 2500;
        
        PRINT '1. Aplicando filtros y controles de consulta...';
        if(@i_TipoComprobante is null or exists(select top(1) 1 from sat_catalogo..sc_vista_tipo_documetos
                            where CodigoNegocio = @i_TipoComprobante
                            and Documento like 'FACTURA%'))
        BEGIN
            PRINT '   Filtro CONTROL_CONSULTA_BITACORA';
            if(@i_NumComprobante is null and @i_IdentificacionCliente is null)
            BEGIN
                if(ABS( DATEDIFF(day,@i_MinFechaConsulta,@i_MaxFechaConsulta ))>3)
                if exists(
                    select dg_nombre_grupo,em_nemonico, em_id_emisor 
                    from sat_catalogo..sc_grupos 
                    inner join sat_catalogo..sc_grupo_emisores on ge_id_grupo = dg_id_grupo
                    inner join sat_catalogo..sc_emisor on em_id_emisor = ge_id_emisor
                    where dg_nombre_grupo = 'CONTROL_CONSULTA_BITACORA'
                    and em_id_emisor = @i_IdEmisor
                )
                BEGIN
                    PRINT '   APLICA CONTROL_CONSULTA_BITACORA';
                    set @i_MaxFechaConsulta = dateadd(day, 2, @i_MinFechaConsulta);
                END
            END
        END
        ELSE
        BEGIN
            PRINT '   SIN CONTROL_CONSULTA_BITACORA';
        END
                    
        CREATE TABLE #t_Comprobantes 
        (
            [IdComprobante] [bigint] NULL,
            [TramaDto] [xml] NULL,
            [TramaAutorizado] [varbinary](max) NULL,
            [HoraIn] [datetime] NULL,
            [Estatus] [smallint] NULL,
            [IdEmisor] [int] NULL,
            [NumComprobante] [varchar](100) NULL,
            [TipoComprobante] [smallint] NULL,
            [HoraReproceso] [datetime] NULL,
            [NumeroReprocesos] [int] NULL,
            [IdLicencia] [decimal](18, 0) NULL,
            [IdCliente] [decimal](18, 0) NULL,
            [NumAutorizacion] [varchar](100) NULL,
            [FechaAutorizacion] [datetime] NULL,
            [NumComprobanteAsociado] [varchar](100) NULL,
            [TotalComprobante] [money] NULL,
            [FechaIn] [date] NULL,
            [Canal] [smallint] NULL,
            [HoraExportImport] [datetime] NULL,
            [IdPunto] [int] NULL,
            [Pais] [smallint] NULL,
            [FechaEmision] [datetime] NULL,
            [AnioEmi] [int] NULL,
            [MesEmi] [int] NULL,
            [DiaEmi] [int] NULL,
            [Establecimiento] [varchar](60) NULL,
            [PuntoEmision] [varchar](10) NULL,
            [Secuencia] [varchar](60) NULL,
            [Respuesta] [smallint] NULL,
            [Detalle] [varchar](max) NULL,
            [Control] [varchar](50) NULL,
            [Id] [bigint] NULL,
            [EstadoNotificacion] [smallint] NULL,
            [Notificacion] [smallint] NULL,
            [UsuarioProceso] [int] NULL,
            [Version] [varchar](60) NULL,
            [HostProceso] [varchar](100) NULL,
            [CondicionVenta] [varchar](60) NULL,
            [Concepto] [varchar](300) NULL,
            [CodigoTipoDocumento] [varchar](60) NULL,
            [TipoDocumento] [varchar](60) NULL,
            [Nemonico] [varchar](200) NULL,
            [IdentificacionCliente] [varchar](60) NULL,
            [RazonSocialCliente] [varchar](200) NULL,
            [DescripcionEstatus] [varchar](200) NULL,
            [DescripcionEstadoNotificacion] [varchar](100) NULL,
            [ClaveAcceso] [varchar](300) NULL,
            [MailNotificacion] [varchar](300) NULL,
            [ExisteBDD] [bit] NULL,
            [TipoIdentificacion] [varchar](20) NULL
        );

        ------------------              
        ----Para la APPP--              
        ------------------              
        if(@i_MaxFechaConsulta is null  and @i_HoraInicio is not null)             
            select @i_MaxFechaConsulta=@i_HoraFin;              
                    
        if(@i_MinFechaConsulta is null  and @i_HoraFin is not null)             
            select @i_MinFechaConsulta=@i_HoraInicio;              
                    
        if(@i_estado_evento_aceptacion is not null or @i_estado_evento_aceptacion > 0)              
        BEGIN              
            PRINT '   sphis_consulta_comprobantes_op_estado_aceptacion';
            SET @error_msg = 'rows:0';
            GOTO LOG_AUDITORIA_EXITO;
        END     
        --  
        else if(@i_NumFolio is not null and @i_MaxFechaConsulta is not null and @i_MinFechaConsulta is not null and @i_IdEmisor is not null )  
        BEGIN  
            PRINT '   Ejecutando sphis_consulta_bitacora_comprobantes_op_folio...';
            insert into #t_Comprobantes     
            (             
                [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia],  
                [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport],  
                [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle],   
                [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta],  
                [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento],   
                [DescripcionEstatus], [DescripcionEstadoNotificacion], [TramaAutorizado], [TipoIdentificacion]  
            )        
            exec sphis_consulta_bitacora_comprobantes_op_folio  
                @i_MinFechaConsulta,@i_MaxFechaConsulta, @i_IdUsuario,@i_IdEmisor,@i_NumFolio,@i_error;
        END  
        else if(  
            @i_MaxFechaConsulta is not null and @i_MinFechaConsulta is not null and @i_Pais is not null and @i_IdEmisor is not null    
            and @i_NumComprobante is null and @i_ClaveAcceso is null and @i_IdentificacionCliente is null and @i_RazonSocialCliente is null  
            and @i_NumFolio is null and @i_IdComprobante is null
        )              
        BEGIN  
            if (@i_EstatusAutorizador is null)  
            BEGIN  
                PRINT '   Ejecutando sphis_consulta_comprobantes_op_fechas_2024...';
                insert into #t_Comprobantes             
                (             
                    [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia],  
                    [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport],  
                    [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle],   
                    [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta],  
                    [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento],   
                    [DescripcionEstatus], [DescripcionEstadoNotificacion], [TramaAutorizado], [TipoIdentificacion]  
                )        
                exec sphis_consulta_comprobantes_op_fechas_2024   
                    @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_IdUsuario,@i_Pais,@i_IdEmisor,@i_CodigoEstablecimiento,@i_CodigoPunto,  
                    @i_error;  
            END  
            else  
            BEGIN  
                PRINT '   Ejecutando sphis_consulta_comprobantes_op_estatus_2024...';
                insert into #t_Comprobantes             
                (             
                    [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia],  
                    [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport],  
                    [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle],   
                    [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta],  
                    [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento],   
                    [DescripcionEstatus], [DescripcionEstadoNotificacion], [TramaAutorizado], [TipoIdentificacion]  
                )        
                exec sphis_consulta_comprobantes_op_estatus_2024
                    @i_EstatusAutorizador, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_IdUsuario,@i_Pais,@i_IdEmisor,@i_CodigoEstablecimiento,@i_CodigoPunto,  
                    @i_error;  
            END  
            
            if(@i_TipoComprobante is not null)  
                delete #t_Comprobantes where CodigoTipoDocumento <> @i_TipoComprobante;  
        END  
        else if(@i_IdCliente is not null)             
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_cliente...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], 
                [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport],   
                [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle],  
                [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico],  
                [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus]            
            )             
            exec sphis_consulta_comprobantes_op_cliente  
                @i_EstatusAutorizador ,@i_IdEmisor ,@i_NumComprobante ,@i_TipoComprobante ,@i_MaxFechaConsulta ,@i_MinFechaConsulta ,@i_IdCliente ,@i_IdUsuario ,@i_IdentificacionCliente ,@i_RazonSocialCliente ,@i_CodigoEstablecimiento ,@i_CodigoPunto ,@i_Pais ,@i_Dias, @i_Mes, @i_Anio;
        END              
        else if(@i_IdentificacionCliente is not null)            
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_fechas_cliente...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante],
                [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso],
                [CondicionVenta], [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]            
            )            
            exec sphis_consulta_comprobantes_op_fechas_cliente            
                @i_IdComprobante              
                , @i_EstatusAutorizador              
                , @i_EstatusSatcom              
                , @i_IdEmisor              
                , @i_NumComprobante              
                , @i_NombreArchivo              
                , @i_TipoComprobante              
                , @i_MaxFechaConsulta              
                , @i_MinFechaConsulta              
                , @i_IdentificacionCliente              
                , @i_RazonSocialCliente              
                , @i_IdCliente              
                , @i_IdUsuario              
                , @i_CodigoEstablecimiento              
                , @i_CodigoPunto              
                , @i_Dias              
                , @i_Mes              
                , @i_Anio              
                , @i_Pais              
                , @i_Concepto, @i_error              
                , @i_Secuencia              
                , @i_co_canal              
                , @i_HoraInicio              
                , @i_HoraFin              
                , @i_NumFolio;
        END    
        else if(@i_RazonSocialCliente is not null)            
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_fechas_cliente_razonsocial...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante],
                [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso],
                [CondicionVenta], [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]              
            )            
            exec sphis_consulta_comprobantes_op_fechas_cliente_razonsocial           
                @i_IdComprobante              
                , @i_EstatusAutorizador              
                , @i_EstatusSatcom              
                , @i_IdEmisor              
                , @i_NumComprobante              
                , @i_NombreArchivo              
                , @i_TipoComprobante              
                , @i_MaxFechaConsulta              
                , @i_MinFechaConsulta              
                , @i_IdentificacionCliente              
                , @i_RazonSocialCliente              
                , @i_IdCliente              
                , @i_IdUsuario              
                , @i_CodigoEstablecimiento              
                , @i_CodigoPunto              
                , @i_Dias              
                , @i_Mes              
                , @i_Anio              
                , @i_Pais              
                , @i_Concepto, @i_error              
                , @i_Secuencia              
                , @i_co_canal              
                , @i_HoraInicio              
                , @i_HoraFin              
                , @i_NumFolio;
        END  
        else if((@i_NumFolio is not null             
            or @i_Secuencia is not null   
            or @i_NumComprobante is not null         
            or @i_IdComprobante is not null)  
            and @i_CodigoEstablecimiento is not null  
            and @i_CodigoPunto is not null)              
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_establecimiento_punto_numero...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion],
                [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id],
                [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto],
                [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]            
            )             
            exec sphis_consulta_comprobantes_op_establecimiento_punto_numero              
                @i_IdComprobante              
                ,@i_IdEmisor              
                ,@i_NumComprobante              
                ,@i_NumFolio              
                ,@i_Secuencia              
                ,@i_IdUsuario              
                ,@i_Anio              
                ,@i_MaxFechaConsulta              
                ,@i_MinFechaConsulta              
                ,@i_CompComienza              
                ,@i_CompTermina              
                ,@i_Pais  
                ,@i_CodigoEstablecimiento  
                ,@i_CodigoPunto  
                ,@i_error;              
        END  
        else if(@i_NumFolio is not null             
            or @i_Secuencia is not null   
            or @i_NumComprobante is not null             
            or @i_IdComprobante is not null)              
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_numero...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion],
                [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id],
                [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto],
                [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]            
            )             
            exec sphis_consulta_comprobantes_op_numero              
                @i_IdComprobante              
                ,@i_IdEmisor              
                ,@i_NumComprobante              
                ,@i_NumFolio              
                ,@i_Secuencia              
                ,@i_IdUsuario              
                ,@i_Anio              
                ,@i_MaxFechaConsulta              
                ,@i_MinFechaConsulta              
                ,@i_CompComienza              
                ,@i_CompTermina              
                ,@i_Pais              
                ,@i_error;              
        END              
        else if(@i_CompComienza is not null             
            or @i_CompTermina is not null)              
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_numero (Comienza/Termina)...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion],
                [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id],
                [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto],
                [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]            
            )             
            exec sphis_consulta_comprobantes_op_numero              
                @i_IdComprobante              
                ,@i_IdEmisor          
                ,@i_NumComprobante              
                ,@i_NumFolio              
                ,@i_Secuencia              
                ,@i_IdUsuario              
                ,@i_Anio              
                ,@i_MaxFechaConsulta              
                ,@i_MinFechaConsulta              
                ,@i_CompComienza              
                ,@i_CompTermina              
                ,@i_Pais              
                ,@i_error;              
        END              
        else if(@i_ClaveAcceso is not null)              
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_clave_acceso...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion],
                [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id],
                [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto],
                [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion], [ClaveAcceso]            
            )            
            exec sphis_consulta_comprobantes_op_clave_acceso              
                @i_IdEmisor              
                ,@i_ClaveAcceso              
                ,@i_IdUsuario              
                ,@i_Anio              
                ,@i_MaxFechaConsulta              
                ,@i_MinFechaConsulta              
                ,@i_Pais              
                ,@i_error;              
        END              
        else              
        BEGIN              
            PRINT '   Ejecutando sphis_consulta_comprobantes_op_fechas_2022 por defecto...';
            insert into #t_Comprobantes             
            (            
                [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion],
                [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id],
                [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [MailNotificacion],
                [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion], [TramaAutorizado], [TipoIdentificacion]            
            )            
            exec sphis_consulta_comprobantes_op_fechas_2022
                @i_IdComprobante              
                ,@i_IdExterno   
                ,@i_EstatusAutorizador              
                ,@i_EstatusSatcom              
                ,@i_IdEmisor              
                ,@i_NumComprobante              
                ,@i_NombreArchivo              
                ,@i_TipoComprobante              
                ,@i_MaxFechaConsulta              
                ,@i_MinFechaConsulta              
                ,@i_IdentificacionCliente              
                ,@i_RazonSocialCliente              
                ,@i_IdCliente              
                ,@i_IdUsuario              
                ,@i_CodigoEstablecimiento              
                ,@i_CodigoPunto              
                ,@i_Dias          
                ,@i_Mes              
                ,@i_Anio              
                ,@i_Pais              
                ,@i_Concepto              
                ,@i_error              
                ,@i_desconectado;              
        END              
        
        -------------------------------------              
        --Actualiza informacion del cliente--              
        -------------------------------------              
        PRINT '2. Actualizando información de clientes...';
        update #t_Comprobantes              
        set             
            IdentificacionCliente = cli.Identificacion,             
            RazonSocialCliente = cli.RazonSocial              
        from #t_Comprobantes as com             
        inner join sat_catalogo.dbo.sc_vista_datos_cliente_v5 as cli on com.IdCliente = cli.IdCliente              
            and cli.IdEmisor = com.IdEmisor              
        where IdentificacionCliente is null or RazonSocialCliente is null;              
                    
        PRINT '   Filas actualizadas desde Cliente-Emisor: ' + CAST(@@rowcount AS VARCHAR);              
                    
        update #t_Comprobantes              
        set             
            IdentificacionCliente = cl_identificacion,             
            RazonSocialCliente = isnull(cl_primer_nombre,'')+' '+isnull(cl_primer_apellido,'')              
        from #t_Comprobantes as com         
        inner join [sat_comprobante].[dbo].[com_cliente] on com.IdCliente= cl_id_cliente              
        where IdentificacionCliente is null;              
                    
        PRINT '   Filas actualizadas desde Cliente: ' + CAST(@@rowcount AS VARCHAR);              
            
        -------------------------  
        --Estado notificaciones--  
        -------------------------  
        PRINT '3. Actualizando estado de notificaciones...';
        update #t_Comprobantes              
        set             
            Notificacion=isnull(not_estado, 3),              
            EstadoNotificacion = isnull(not_estado, 3)              
        from #t_Comprobantes             
        left outer join com_Notificacion on IdComprobante=not_id_comprobante;
        
        PRINT '   Filas actualizadas Notificacion1: ' + CAST(@@rowcount AS VARCHAR);     
            
        update #t_Comprobantes              
        set             
            Notificacion=1,              
            EstadoNotificacion = 1,              
            MailNotificacion = not_mail,              
            DescripcionEstadoNotificacion  = 'Notificado'              
        from #t_Comprobantes             
        inner join com_Notificacion on IdComprobante=not_id_comprobante and not_estado=1;
        
        PRINT '   Filas actualizadas Notificacion2: ' + CAST(@@rowcount AS VARCHAR);              
        
        -- Consumidor final              
        update #t_Comprobantes              
        set             
            Notificacion=3,              
            RazonSocialCliente = 'Consumidor Final'              
        where IdentificacionCliente = '9999999999999'              
            or nullif(IdentificacionCliente,'') is null              
            or IdentificacionCliente = '222222222222'              
            or RazonSocialCliente = 'NO REGISTRADO';
            
        PRINT '   Filas actualizadas Consumidor final: ' + CAST(@@rowcount AS VARCHAR);             
                    
        update #t_Comprobantes              
        set               
            TipoDocumento= DescripcionTipo            
        from #t_Comprobantes as com             
        inner join sat_catalogo.dbo.sc_vista_tipo_documetos as v on com.CodigoTipoDocumento = v.CodigoNegocio and v.Pais=com.Pais;              
        
        -- Obtener filas de resultado principal para auditoría
        SELECT @row_count = COUNT(1) FROM #t_Comprobantes;
        SET @error_msg = 'rows:' + CAST(@row_count AS VARCHAR);

        LOG_AUDITORIA_EXITO:
        
        -- Retornar resultados al cliente
        select top (@w_top)   
            IdComprobante,
            HoraIn,
            Estatus,
            NumComprobante,
            TipoComprobante,
            HoraReproceso,
            NumAutorizacion,
            TotalComprobante,
            Canal,
            FechaEmision,
            EstadoNotificacion,
            Notificacion,
            Concepto,
            CodigoTipoDocumento,
            TipoDocumento,
            Nemonico,
            IdentificacionCliente,
            RazonSocialCliente,
            ExisteBDD  
        from #t_Comprobantes
        where @i_MostrarDuplicados = 1 OR Estatus <> 14
        order by TRY_CONVERT(bigint, Secuencia) desc;

        -- Log de Auditoría Final Exitoso
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

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @fin = GETDATE();
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- Alerta obligatoria a postgres (Dashboard de monitoreo) en caso de fallos
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @country = @i_Pais,
            @issuing = '-',
            @message = @ErrorMessage,
            @extra_info = '{"Fase": "Ejecucion SP Bitacora"}';

        -- Log de Auditoría Final con error
        EXEC [dbo].[spco_crear_log_consulta] 
            @i_lc_nombre_sp = @NombreSP,
            @i_lc_appname   = 'BATCH',
            @i_lc_emisor    = @i_IdEmisor,
            @i_lc_parametros = @params,
            @i_lc_origen    = 'BDD',
            @i_lc_inicio    = @inicio,
            @i_lc_fin       = @fin,
            @i_lc_error     = @error_msg;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';
END;
GO
