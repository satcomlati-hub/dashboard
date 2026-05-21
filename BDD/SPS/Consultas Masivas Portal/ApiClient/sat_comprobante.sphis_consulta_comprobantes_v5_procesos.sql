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
 @i_IdComprobante as varchar(max)=null,--            
 @i_IdExterno as varchar(max)=null,            
 @i_NumComprobante as varchar (max) =null,            
 @i_NumFolio as varchar(max) = null,            
 @i_EstatusAutorizador as int =null,-- Estado SRI            
 @i_EstatusSatcom as int =null,--Estado de la carga            
 @i_IdEmisor as int =null,--            
 @i_NombreArchivo as varchar (30) =null,            
 @i_TipoComprobante as varchar(5) =null,  --Codigo Negociomst            
 @i_HoraInicio as date=null,--Hora ini filtro consulta            
 @i_HoraFin as date=null, --Hora fin filtro consulta            
 @i_MaxFechaConsulta as date =null,--Inicio ultima consulta            
 @i_MinFechaConsulta as date =null,--fin ultima consulta            
 @i_IdentificacionCliente as varchar(20)=null,            
 @i_RazonSocialCliente as varchar(200)=null,            
 @i_IdCliente as decimal=null,--Si tiene IdCliente, es una consulta de cliente            
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
 ) --with recompile      
AS            
BEGIN    
    SET NOCOUNT ON;
    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = DB_NAME() + '.' + OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);

    BEGIN TRY

		if(@@SERVERNAME = 'SRVBDDMSPROD\MSPROD2022')
		begin
			if(@i_IdEmisor in (908, 1925, 1739,593,610,543,573,908,1739,1925,1727,606,1841,541,1852,1672,1722,1856,1858))
			begin
				print 'Emisor desactivado'
				SET @fin = GETDATE();
				EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'PORTAL', @i_IdEmisor, 'Emisor INACTIVO', NULL, @inicio, @fin, 0, NULL;
				return 0
			end
		end

       

        if(@i_Pais is null and @i_IdEmisor is not null)  --Optimiza para consultas del bridge
            select @i_Pais = em_pais from sat_catalogo.dbo.sc_emisor with(nolock) where em_id_emisor = @i_IdEmisor

        -- Captura de parámetros en formato EXEC replicable (copiar y ejecutar directo en SSMS)
        SET @params = 'EXEC [' + DB_NAME() + '].[dbo].[' + OBJECT_NAME(@@PROCID) + '] ' +
            '@i_IdComprobante = ' + ISNULL('''' + @i_IdComprobante + '''', 'NULL') + ', ' +
            '@i_IdExterno = ' + ISNULL('''' + @i_IdExterno + '''', 'NULL') + ', ' +
            '@i_NumComprobante = ' + ISNULL('''' + @i_NumComprobante + '''', 'NULL') + ', ' +
            '@i_NumFolio = ' + ISNULL('''' + @i_NumFolio + '''', 'NULL') + ', ' +
            '@i_EstatusAutorizador = ' + ISNULL(CAST(@i_EstatusAutorizador AS VARCHAR), 'NULL') + ', ' +
            '@i_EstatusSatcom = ' + ISNULL(CAST(@i_EstatusSatcom AS VARCHAR), 'NULL') + ', ' +
            '@i_IdEmisor = ' + ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL') + ', ' +
            '@i_NombreArchivo = ' + ISNULL('''' + @i_NombreArchivo + '''', 'NULL') + ', ' +
            '@i_TipoComprobante = ' + ISNULL('''' + @i_TipoComprobante + '''', 'NULL') + ', ' +
            '@i_HoraInicio = ' + ISNULL('''' + CONVERT(VARCHAR(10), @i_HoraInicio, 120) + '''', 'NULL') + ', ' +
            '@i_HoraFin = ' + ISNULL('''' + CONVERT(VARCHAR(10), @i_HoraFin, 120) + '''', 'NULL') + ', ' +
            '@i_MaxFechaConsulta = ' + ISNULL('''' + CONVERT(VARCHAR(10), @i_MaxFechaConsulta, 120) + '''', 'NULL') + ', ' +
            '@i_MinFechaConsulta = ' + ISNULL('''' + CONVERT(VARCHAR(10), @i_MinFechaConsulta, 120) + '''', 'NULL') + ', ' +
            '@i_IdentificacionCliente = ' + ISNULL('''' + @i_IdentificacionCliente + '''', 'NULL') + ', ' +
            '@i_RazonSocialCliente = ' + ISNULL('''' + @i_RazonSocialCliente + '''', 'NULL') + ', ' +
            '@i_IdCliente = ' + ISNULL(CAST(@i_IdCliente AS VARCHAR), 'NULL') + ', ' +
            '@i_IdUsuario = ' + ISNULL(CAST(@i_IdUsuario AS VARCHAR), 'NULL') + ', ' +
            '@i_CodigoEstablecimiento = ' + ISNULL('''' + @i_CodigoEstablecimiento + '''', 'NULL') + ', ' +
            '@i_CodigoPunto = ' + ISNULL('''' + @i_CodigoPunto + '''', 'NULL') + ', ' +
            '@i_Secuencia = ' + ISNULL('''' + @i_Secuencia + '''', 'NULL') + ', ' +
            '@i_Dias = ' + ISNULL('''' + @i_Dias + '''', 'NULL') + ', ' +
            '@i_Mes = ' + ISNULL('''' + @i_Mes + '''', 'NULL') + ', ' +
            '@i_Anio = ' + ISNULL(CAST(@i_Anio AS VARCHAR), 'NULL') + ', ' +
            '@i_Pais = ' + ISNULL(CAST(@i_Pais AS VARCHAR), 'NULL') + ', ' +
            '@i_Concepto = ' + ISNULL('''' + @i_Concepto + '''', 'NULL') + ', ' +
            '@i_co_canal = ' + ISNULL(CAST(@i_co_canal AS VARCHAR), 'NULL') + ', ' +
            '@i_CompComienza = ' + ISNULL('''' + @i_CompComienza + '''', 'NULL') + ', ' +
            '@i_CompTermina = ' + ISNULL('''' + @i_CompTermina + '''', 'NULL') + ', ' +
            '@i_ClaveAcceso = ' + ISNULL('''' + @i_ClaveAcceso + '''', 'NULL') + ', ' +
            '@i_desconectado = ' + ISNULL(CAST(@i_desconectado AS VARCHAR), 'NULL') + ', ' +
            '@i_estado_evento_aceptacion = ' + ISNULL(CAST(@i_estado_evento_aceptacion AS VARCHAR), 'NULL') + ', ' +
            '@i_TipoUsuario = ' + ISNULL(CAST(@i_TipoUsuario AS VARCHAR), 'NULL') + ', ' +
            '@i_NumAutorizacion = ' + ISNULL('''' + @i_NumAutorizacion + '''', 'NULL');

        -------------------------------------------------------------------
        -- CONTROL DE CONSULTAS RECURRENTES (10 por hora, ventana deslizante)
        -- Aplica para TODAS las llamadas al SP
        -------------------------------------------------------------------
        DECLARE @Consultas int = 0
        DECLARE @LimiteConsultas int = 10  -- Límite: 10 consultas por hora

        BEGIN TRY
            -- Registrar el intento de consulta y obtener la recurrencia acumulada de la última hora
            EXEC dbo.spco_crear_log_consulta 
                @i_lc_nombre_sp = @NombreSP,
                @i_lc_hostname = 'BDD',
                @i_lc_appname = 'PORTAL',
                @i_lc_emisor = @i_IdEmisor,
                @i_lc_parametros = @params,
                @i_lc_origen = 'Intento',
                @i_lc_inicio = @inicio,
                @i_lc_fin = @inicio,
                @i_lc_error = null,
                @i_lc_usuario = @i_IdUsuario,
                @o_recurrencias = @Consultas OUTPUT;
        END TRY
        BEGIN CATCH
            -- Tolerancia a fallos: Si falla el logging, omitimos el control y continuamos
            PRINT '>>> ERROR EN CONTROL DE RECURRENCIAS: ' + ERROR_MESSAGE() + '. Se omite rate limit para evitar bloqueo del servicio.';
            SET @Consultas = 0;
        END CATCH

        IF (@Consultas > @LimiteConsultas)
        BEGIN
            BEGIN TRY
                SET @fin = GETDATE();
                -- Registrar el log de bloqueo
                EXEC dbo.spco_crear_log_consulta 
                    @i_lc_nombre_sp = @NombreSP,
                    @i_lc_hostname = 'BDD',
                    @i_lc_appname = 'PORTAL',
                    @i_lc_emisor = @i_IdEmisor,
                    @i_lc_parametros = @params,
                    @i_lc_origen = 'Bloqueado',
                    @i_lc_inicio = @inicio,
                    @i_lc_fin = @fin,
                    @i_lc_error = 'Bloqueado por exceso de consultas',
                    @i_lc_usuario = @i_IdUsuario;
            END TRY
            BEGIN CATCH
                PRINT '>>> ERROR AL REGISTRAR LOG DE BLOQUEO: ' + ERROR_MESSAGE();
            END CATCH

            -- Salida temprana: devolver error controlado sin ejecutar la consulta pesada
            PRINT 'BLOQUEADO: ' + CAST(@Consultas AS VARCHAR) + ' consultas en la última hora (límite: ' + CAST(@LimiteConsultas AS VARCHAR) + ')';
            RETURN 0;
        END


		--Control consultas sin datos KT--
        if(@i_IdComprobante is null and @i_NumComprobante is null and @i_NombreArchivo is null and @i_ClaveAcceso is null and @i_NumAutorizacion is null) 
        BEGIN
            SET @fin = GETDATE();
            EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'PORTAL', @i_IdEmisor, 'Salida temprana: Sin parametros', NULL, @inicio, @fin, 0, NULL;
            return 0
        END


        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED          
              
        declare @w_top int =1500          
              
        declare @t_Comprobantes as ComprobanteXML  --Resultados de la consulta      

        ------------------            
        ----Para la APPP--            
        ------------------            
        if(@i_MaxFechaConsulta is null  and @i_HoraInicio is not null)           
            select @i_MaxFechaConsulta=@i_HoraFin            
              
        if(@i_MinFechaConsulta is null  and @i_HoraFin is not null)           
            select @i_MinFechaConsulta=@i_HoraInicio            
               
        if(@i_TipoUsuario =5 and @i_ClaveAcceso is null and @i_NumAutorizacion is null and @i_NumComprobante is null)--EnumTipoUsuario = 5 (Servicios )       
        begin
            exec [sphis_consulta_comprobantes_op_interfaces_2024]     @i_MaxFechaConsulta,  @i_MinFechaConsulta,@i_IdEmisor,@i_CodigoEstablecimiento,@i_CodigoPunto, @i_error
            GOTO FINALIZAR;
        end
        else if(@i_estado_evento_aceptacion is not null or @i_estado_evento_aceptacion > 0)            
        begin            
            print 'sphis_consulta_comprobantes_op_estado_aceptacion'            
            GOTO FINALIZAR;
        end   
        ------------------ 
        --
        else if(@i_MaxFechaConsulta is not null and @i_MinFechaConsulta is not null and @i_Pais is not null and @i_IdEmisor is not null 
        and @i_NumComprobante is null and @i_ClaveAcceso is null and @i_NumAutorizacion is null and @i_IdentificacionCliente is null AND @i_IdExterno IS NULL) --//2024: KT: desde pantalla, sin filtros, solo fechas            
        begin
            if (@i_EstatusAutorizador is null)
            begin
                insert into @t_Comprobantes           
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
                @i_error
            end
            else
            begin
                insert into @t_Comprobantes           
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
                @i_error
            end
        end
        --
        else if(@i_IdCliente is not null) --Consulta para clientes            
        begin            
            print 'sphis_consulta_comprobantes_op_cliente'            
            insert into @t_Comprobantes           
            (          
            [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], 
            [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], 
            [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle],
            [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico],
            [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus]          
            )           
            exec sphis_consulta_comprobantes_op_cliente  
            @i_EstatusAutorizador ,@i_IdEmisor ,@i_NumComprobante ,@i_TipoComprobante ,@i_MaxFechaConsulta ,@i_MinFechaConsulta ,@i_IdCliente ,@i_IdUsuario ,@i_IdentificacionCliente 
            ,@i_RazonSocialCliente ,@i_CodigoEstablecimiento ,@i_CodigoPunto ,@i_Pais ,@i_Dias ,@i_Mes ,@i_Anio
        end            
        else if(@i_IdentificacionCliente is not null) --Consulta para clientes            
        begin            
            print 'sphis_consulta_comprobantes_op_fechas_cliente'            
            insert into @t_Comprobantes           
            (          
            [IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante]
			, [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso], [Version], [HostProceso]
			, [CondicionVenta], [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]            
            )          
            exec sphis_consulta_comprobantes_op_fechas_cliente          
            @i_IdComprobante, @i_EstatusAutorizador, @i_EstatusSatcom, @i_IdEmisor, @i_NumComprobante, @i_NombreArchivo, @i_TipoComprobante, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_IdentificacionCliente, @i_RazonSocialCliente, @i_IdCliente, @i_IdUsuario
            , @i_CodigoEstablecimiento, @i_CodigoPunto, @i_Dias, @i_Mes, @i_Anio, @i_Pais, @i_Concepto, @i_error, @i_Secuencia, @i_co_canal, @i_HoraInicio, @i_HoraFin, @i_NumFolio              
        end 
        else if(@i_NumComprobante is not null and @i_TipoComprobante is not null and @i_IdEmisor is not null and @i_MinFechaConsulta is not null and @i_MaxFechaConsulta is not null and @i_Pais not in (57))
        begin
            insert into @t_Comprobantes([IdComprobante], [HoraIn], [FechaEmision], [Estatus], [NumComprobante], [CodigoTipoDocumento], [DescripcionEstatus], TramaDto)
            exec sphis_consulta_comprobantes_procesos_op_numero_tipo @i_MinFechaConsulta, @i_MaxFechaConsulta, @i_IdEmisor, @i_NumComprobante, @i_TipoComprobante, @i_error
        end
        else if(@i_NumFolio is not null or @i_Secuencia is not null or @i_NumComprobante is not null or @i_IdComprobante is not null)            
        begin            
            print 'sphis_consulta_comprobantes_op_numero.dbo.'            
            insert into @t_Comprobantes           
            (          
            [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion]
			, [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso]
			, [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]          
            )           
            exec sphis_consulta_comprobantes_op_numero @i_IdComprobante, @i_IdEmisor, @i_NumComprobante, @i_NumFolio, @i_Secuencia, @i_IdUsuario, @i_Anio, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_CompComienza, @i_CompTermina, @i_Pais, @i_error
        end   
        else if(@i_CompComienza is not null or @i_CompTermina is not null)            
        begin            
            print 'sphis_consulta_comprobantes_op_numero.'            
            insert into @t_Comprobantes           
            (          
            [IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion]
			, [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso]
			, [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion]          
            )      
            exec sphis_consulta_comprobantes_op_numero @i_IdComprobante, @i_IdEmisor, @i_NumComprobante, @i_NumFolio, @i_Secuencia, @i_IdUsuario, @i_Anio, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_CompComienza, @i_CompTermina, @i_Pais, @i_error
        end            
        else if(@i_ClaveAcceso is not null)            
        begin            
            print 'sphis_consulta_comprobantes_op_clave_acceso'            
            insert into @t_Comprobantes ([IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion]
			, [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id]
			, [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion], [ClaveAcceso])   
       
            exec sphis_consulta_comprobantes_op_clave_acceso @i_IdEmisor, @i_ClaveAcceso, @i_IdUsuario, @i_Anio, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_Pais, @i_error
        end            
        else if(@i_NumAutorizacion is not null)            
        begin            
            print 'sphis_consulta_comprobantes_op_num_autorizacion'            
            insert into @t_Comprobantes ([IdComprobante], [TramaDto], [TramaAutorizado], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion]
			, [FechaAutorizacion], [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id]
			, [Notificacion], [UsuarioProceso], [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion], [ClaveAcceso])   
     
            exec sphis_consulta_comprobantes_op_num_autorizacion @i_IdEmisor, @i_NumAutorizacion, @i_IdUsuario, @i_Anio, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_Pais, @i_error
        end   
        else --Por defecto            
        begin            
            print 'sphis_consulta_comprobantes_op_fechas_2022 por defecto'            
            insert into @t_Comprobantes ([IdComprobante], [HoraIn], [Estatus], [IdEmisor], [NumComprobante], [TipoComprobante], [HoraReproceso], [NumeroReprocesos], [IdLicencia], [IdCliente], [NumAutorizacion], [FechaAutorizacion]
			, [NumComprobanteAsociado], [TotalComprobante], [FechaIn], [Canal], [HoraExportImport], [IdPunto], [Pais], [FechaEmision], [AnioEmi], [MesEmi], [DiaEmi], [Establecimiento], [PuntoEmision], [Secuencia], [Respuesta], [Detalle], [Control], [Id], [Notificacion], [UsuarioProceso]
			, [Version], [HostProceso], [CondicionVenta], [CodigoTipoDocumento], [Concepto], [MailNotificacion], [Nemonico], [IdentificacionCliente], [RazonSocialCliente], [TipoDocumento], [DescripcionEstatus], [DescripcionEstadoNotificacion], [TramaAutorizado]
			, [TipoIdentificacion])          
            exec sphis_consulta_comprobantes_op_fechas_2022 @i_IdComprobante, @i_IdExterno, @i_EstatusAutorizador, @i_EstatusSatcom, @i_IdEmisor, @i_NumComprobante, @i_NombreArchivo, @i_TipoComprobante, @i_MaxFechaConsulta, @i_MinFechaConsulta, @i_IdentificacionCliente, @i_RazonSocialCliente, @i_IdCliente, @i_IdUsuario, @i_CodigoEstablecimiento, @i_CodigoPunto, @i_Dias, @i_Mes, @i_Anio, @i_Pais, @i_Concepto, @i_error, @i_desconectado            
        end            
        
        FINALIZAR:

        if(@i_TipoUsuario =5)--EnumTipoUsuario = 5 (Servicios )       
        begin          
            select top (10000)    
            IdComprobante, Estatus, FechaEmision as HoraIn, FechaEmision, RIGHT('00' + CONVERT(VARCHAR, CodigoTipoDocumento), 2) AS CodigoTipoDocumento , NumComprobante , DescripcionEstatus       
            from @t_Comprobantes 
            order by TRY_CONVERT(bigint, Secuencia) desc,    HoraIn desc         
        end          
        else          
        begin          
            select top (@w_top) * from @t_Comprobantes order by TRY_CONVERT(bigint, Secuencia) desc            
        end          

        -- Log de Auditoría Final (Éxito)
        SET @fin = GETDATE();
        EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'PORTAL', @i_IdEmisor, @params, NULL, @inicio, @fin, 0, NULL;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        SET @fin = GETDATE();

        -- ALERTA A POSTGRES EN CASO DE ERROR
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @country = @i_Pais,
            @issuing = '-',
            @message = @ErrorMessage,
            @extra_info = '{"Fase": "Ejecucion SP Portal"}';

        -- Log de Auditoría Final (Fallo)
        EXEC sat_comprobante.dbo.spco_crear_log_consulta @NombreSP, 'BDD', 'PORTAL', @i_IdEmisor, @params, @ErrorMessage, @inicio, @fin, 1, NULL;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, GETDATE()) AS VARCHAR) + 's] ---';
END;
GO
