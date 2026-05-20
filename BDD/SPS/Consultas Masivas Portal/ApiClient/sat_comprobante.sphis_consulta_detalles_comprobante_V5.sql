USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[sphis_consulta_detalles_comprobante_V5]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'sphis_consulta_detalles_comprobante_V5_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'sphis_consulta_detalles_comprobante_V5', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[sphis_consulta_detalles_comprobante_V5];
    END
END
GO

CREATE PROCEDURE [dbo].[sphis_consulta_detalles_comprobante_V5]                
(
    @i_co_id_comprobante bigint,                
    @i_detalles bit = 0,                
    @i_co_his bit = 0,            
    @i_IdEmisor int = 0,            
    @i_AppName varchar(200) = 'BDD',            
    @i_IdUsuario int = 0,           
    @i_Metodo varchar(30) = null          
)
WITH RECOMPILE               
AS                
BEGIN                
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED                
    DECLARE @com_log_comprobante_xml_aux ComprobanteXML                 
    DECLARE @i_control int = 0 , @Inicio datetime = getdate(), @NombreSP varchar(200) = OBJECT_NAME(@@PROCID) , @fin datetime = getdate()             
    
    -- Optimización: Obtener los parámetros de ejecución estructurados y listos para ejecutar desde el log
    DECLARE @params VARCHAR(MAX) = 'EXEC [dbo].[' + @NombreSP + '] ' +
        '@i_co_id_comprobante = ' + ISNULL(CAST(@i_co_id_comprobante AS VARCHAR), 'NULL') + ', ' +
        '@i_detalles = ' + ISNULL(CAST(@i_detalles AS VARCHAR), 'NULL') + ', ' +
        '@i_co_his = ' + ISNULL(CAST(@i_co_his AS VARCHAR), 'NULL') + ', ' +
        '@i_IdEmisor = ' + ISNULL(CAST(@i_IdEmisor AS VARCHAR), 'NULL') + ', ' +
        '@i_AppName = ' + ISNULL('''' + @i_AppName + '''', 'NULL') + ', ' +
        '@i_IdUsuario = ' + ISNULL(CAST(@i_IdUsuario AS VARCHAR), 'NULL') + ', ' +
        '@i_Metodo = ' + ISNULL('''' + @i_Metodo + '''', 'NULL');
          
    IF (@i_co_id_comprobante = 0 or @i_co_id_comprobante = 24202947953240573) RETURN 0  ---id temporalmente bloqueado 24202947953240573          
           
    --Control de consultas recurrentes, aplica solo para el Api Client--        
    IF (@i_co_id_comprobante >= 0 and (@i_AppName = 'ApiClient' or @i_AppName = 'ApiClient1'))           
    BEGIN          
        DECLARE @Consultas int = 0          
        DECLARE @LimiteConsultas int = 20          
        
        BEGIN TRY
            -- Registrar el intento de consulta (lc_origen = 'Intento') y obtener la recurrencia acumulada del día
            EXEC dbo.spco_crear_log_consulta 
                @i_lc_nombre_sp = @NombreSP,
                @i_lc_hostname = @i_Metodo,
                @i_lc_appname = @i_AppName,
                @i_lc_emisor = @i_IdEmisor,
                @i_lc_parametros = @params, -- Parámetro registrado en formato listo para ejecutar
                @i_lc_origen = 'Intento',
                @i_lc_inicio = @Inicio,
                @i_lc_fin = @Inicio,
                @i_lc_error = null,
                @i_lc_usuario = @i_IdUsuario,
                @o_recurrencias = @Consultas OUTPUT;
        END TRY
        BEGIN CATCH
            -- Tolerancia a fallos: Si falla el logging, omitimos el control de recurrencias y continuamos con la consulta
            PRINT '>>> ERROR EN CONTROL DE RECURRENCIAS: ' + ERROR_MESSAGE() + '. Se omite rate limit para evitar bloqueo del servicio.';
            SET @Consultas = 0;
        END CATCH
            
        IF (@Consultas > @LimiteConsultas)          
        BEGIN          
            BEGIN TRY
                -- Registrar el log de bloqueo
                EXEC dbo.spco_crear_log_consulta 
                    @i_lc_nombre_sp = @NombreSP,
                    @i_lc_hostname = @i_Metodo,
                    @i_lc_appname = @i_AppName,
                    @i_lc_emisor = @i_IdEmisor,
                    @i_lc_parametros = @params, -- Parámetro registrado en formato listo para ejecutar
                    @i_lc_origen = 'Bloqueado',
                    @i_lc_inicio = @Inicio,
                    @i_lc_fin = getdate(),
                    @i_lc_error = 'Bloqueado por exceso de consultas',
                    @i_lc_usuario = @i_IdUsuario;
            END TRY
            BEGIN CATCH
                PRINT '>>> ERROR AL REGISTRAR LOG DE BLOQUEO: ' + ERROR_MESSAGE();
            END CATCH
          
            INSERT INTO @com_log_comprobante_xml_aux (
                [IdComprobante],
                [Estatus],
                [Detalle],
                [HostProceso],
                [FechaEmision],
                [Concepto]          
            ) 
            VALUES (
                @i_co_id_comprobante, 
                50,          
                CONCAT('Error:Bloqueado por exceso de consultas:', @Consultas, ', podra ser consultado nuevamente mañana.'),
                'BDD', 
                GETDATE(),          
                CONCAT('Error:Exceso de consultas:', @Consultas, '.')          
            );
             
            SELECT 
                [IdComprobante],
                [Estatus],
                [Detalle],
                [HostProceso],
                [FechaEmision],
                [Concepto]          
            FROM @com_log_comprobante_xml_aux;
          
            RETURN 0;          
        END          
    END          
         
    --Busca ID en otras BDD , temporal para obtener PDF de una factura--        
    IF (@i_co_id_comprobante = 254251048413716485)        
    BEGIN        
        INSERT INTO @com_log_comprobante_xml_aux                
        (                
            [IdComprobante]                
            ,[TramaDto]                
            ,[TramaAutorizado]             
            ,TramaEntrada            
            ,[HoraIn]                
            ,[Estatus]                
            ,[IdEmisor]                
            ,[NumComprobante]                
            ,[NombreArchivo]                
            ,[TipoComprobante]                
            ,[HoraReproceso]                
            ,[NumeroReprocesos]                
            ,[IdLicencia]                
            ,[IdCliente]                
            ,[NumAutorizacion]                
            ,[FechaAutorizacion]                
            ,[NumComprobanteAsociado]                
            ,[TotalComprobante]                
            ,[FechaIn]                
            ,[Canal]                
            ,[HoraExportImport]                
            ,[IdPunto]                
            ,[Pais]                
            ,[FechaEmision]                
            ,[AnioEmi]                
            ,[MesEmi]                
            ,[DiaEmi]                
            ,[Establecimiento]                
            ,[PuntoEmision]                
            ,[Secuencia]                
            ,[Respuesta]                
            ,[Detalle]                
            ,[Control]      
            ,[Id]                
            ,[EstadoNotificacion]                
            ,[UsuarioProceso]                
            ,[Version]                
            ,[HostProceso]                
            ,[CondicionVenta]                
            ,[Concepto]                
            ,[CodigoTipoDocumento]                
            --adicionales--                
            ,[TipoDocumento]                
            ,[DescripcionTipoDocumento]                
            --                
            ,[Nemonico]                
            ,[RazonSocialEmisor]                
            ,[IdentificacionCliente]          
            ,[RazonSocialCliente]                
            --                
            ,[DescripcionEstatus]                
            ,[DescripcionEstadoNotificacion]                
            ,[MailNotificacion]                
            ,[ExisteBDD]                
            --                
            ,HoraBDD                
            ,GuestRemoto                 
            ,GuestApp                
            ,GuestVersion                
            ,SegProceso                
        )            
        SELECT                
            co.[co_id_comprobante]  AS [IdComprobante]                
            ,[co_trama_dto]  AS [TramaDto]                
            ,[co_trama_autorizado] AS [TramaAutorizado]              
            ,co_trama_entrada AS TramaIn            
            ,[co_hora_in]   AS [HoraIn]           
            ,[co_estatus]   AS [Estatus]              
            ,co.[co_id_emisor]  AS [IdEmisor]                
            ,[co_num_comprobante] AS [NumComprobante]                
            ,[co_nombre_archivo] AS [NombreArchivo]                
            ,[co_tipo_comprobante]  AS [TipoComprobante]                
            ,[co_hora_reproceso] AS [HoraReproceso]                
            ,[co_numero_reprocesos] AS [NumeroReprocesos]                
            ,[co_id_licencia]  AS [IdLicencia]                
            ,[co_id_cliente]  AS [IdCliente]                
            ,[co_num_autorizacion] AS [NumAutorizacion]                
            ,[co_fecha_autorizacion]  AS [FechaAutorizacion]                
            ,[co_num_comprobante_asociado] AS [NumComprobanteAsociado]                
            ,[co_total_comprobante]   AS [TotalComprobante]                
            ,[co_fecha_in]     AS [FechaIn]                
            ,[co_canal]      AS [Canal]                
            ,[co_hora_export_import]  AS [HoraExportImport]                
            ,[co_id_punto]     AS [IdPunto]                
            ,[co_pais]      AS [Pais]                
            ,co.[co_fecha_emision]   AS [FechaEmision]                
            ,[co_anio_emi]    AS [AnioEmi]                
            ,[co_mes_emi]     AS [MesEmi]                
            ,[co_dia_emi]     AS [DiaEmi]                
            ,[co_establecimiento] AS [Establecimiento]            
            ,[co_punto_emision]    AS [PuntoEmision]                
            ,[co_secuencia]     AS [Secuencia]                
            ,[co_respuesta]     AS [Respuesta]                
            ,[co_detalle]                AS [Detalle]                
            ,[co_control]     AS [Control]                
            ,[co_id]   AS [Id]                
            ,[co_estado_notificacion]  AS [EstadoNotificacion]                
            ,[co_usuario_proceso]   AS [UsuarioProceso]                
            ,[co_version]     AS [Version]                
            ,[co_host_proceso]    AS [HostProceso]                
            ,[co_condicion_venta]   AS [CondicionVenta]                
            ,[co_concepto]     AS [Concepto]                
            ,[co_codigo_tipo_documento]  AS [CodigoTipoDocumento]                
            --adicionales--                
            ,tipo.[DescripcionTipoDocumento]                
            ,tipo.[DescripcionTipoDocumento]                
            --                
            ,em.em_nemonico AS Nemonico                 
            ,em.em_razon_social AS RazonSocialEmisor               
            ,co_identificacion AS [IdentificacionCliente]                
            ,co_razon_social AS [RazonSocialCliente]                
            --                
            ,null                
            ,null                
            ,co_mail_notificacion AS [MailNotificacion]                
            ,1      AS [ExisteBDD]                
            --                
            ,co_hora_bdd AS HoraBDD                
            ,co_guest_remoto AS GuestRemoto                 
            ,co_guest_app AS GuestApp                
            ,co_guest_version AS GuestVersion                
            ,co_seg_proceso AS SegProceso                
        FROM sat_comprobante_historica.dbo.com_log_comprobante_xml co WITH (NOLOCK)              
        LEFT JOIN sat_catalogo.dbo.sc_vista_tipo_documetos tipo ON CodigoNegocio = co_codigo_tipo_documento and co_pais = Pais                
        LEFT JOIN sat_catalogo.dbo.sc_vista_estados_documentos ON CodigoEstatus = co_estatus                
        LEFT JOIN sat_catalogo.dbo.sc_emisor AS em WITH (NOLOCK) ON em.em_id_emisor = co_id_emisor                
        WHERE co.co_id_comprobante = @i_co_id_comprobante              
         
        SELECT * FROM @com_log_comprobante_xml_aux        
        RETURN 0        
    END        
        
    INSERT INTO @com_log_comprobante_xml_aux                
    (                
        [IdComprobante]                
        ,[TramaDto]                
        ,[TramaAutorizado]             
        ,TramaEntrada            
        ,[HoraIn]                
        ,[Estatus]                
        ,[IdEmisor]                
        ,[NumComprobante]                
        ,[NombreArchivo]                
        ,[TipoComprobante]                
        ,[HoraReproceso]                
        ,[NumeroReprocesos]                
        ,[IdLicencia]                
        ,[IdCliente]                
        ,[NumAutorizacion]                
        ,[FechaAutorizacion]                
        ,[NumComprobanteAsociado]                
        ,[TotalComprobante]                
        ,[FechaIn]                
        ,[Canal]                
        ,[HoraExportImport]                
        ,[IdPunto]                
        ,[Pais]                
        ,[FechaEmision]                
        ,[AnioEmi]                
        ,[MesEmi]                
        ,[DiaEmi]                
        ,[Establecimiento]                
        ,[PuntoEmision]                
        ,[Secuencia]                
        ,[Respuesta]                
        ,[Detalle]                
        ,[Control]                
        ,[Id]                
        ,[EstadoNotificacion]                
        ,[UsuarioProceso]                
        ,[Version]                
        ,[HostProceso]                
        ,[CondicionVenta]                
        ,[Concepto]                
        ,[CodigoTipoDocumento]                
        --adicionales--                
        ,[TipoDocumento]                
        ,[DescripcionTipoDocumento]                
        --                
        ,[Nemonico]                
        ,[RazonSocialEmisor]                
        ,[IdentificacionCliente]                
        ,[RazonSocialCliente]                
        --                
        ,[DescripcionEstatus]                
        ,[DescripcionEstadoNotificacion]                
        ,[MailNotificacion]                
        ,[ExisteBDD]                
        --                
        ,HoraBDD                
        ,GuestRemoto                 
        ,GuestApp                
        ,GuestVersion                
        ,SegProceso                
    )            
    SELECT                
        co.[co_id_comprobante]  AS [IdComprobante]                
        ,[co_trama_dto]  AS [TramaDto]                
        ,[co_trama_autorizado] AS [TramaAutorizado]              
        ,co_trama_entrada AS TramaIn            
        ,[co_hora_in]   AS [HoraIn]           
        ,[co_estatus]   AS [Estatus]              
        ,co.[co_id_emisor]  AS [IdEmisor]                
        ,[co_num_comprobante] AS [NumComprobante]                
        ,[co_nombre_archivo] AS [NombreArchivo]                
        ,[co_tipo_comprobante]  AS [TipoComprobante]                
        ,[co_hora_reproceso] AS [HoraReproceso]            
        ,[co_numero_reprocesos] AS [NumeroReprocesos]                
        ,[co_id_licencia]  AS [IdLicencia]                
        ,[co_id_cliente]  AS [IdCliente]                
        ,[co_num_autorizacion] AS [NumAutorizacion]                
        ,[co_fecha_autorizacion]  AS [FechaAutorizacion]                
        ,[co_num_comprobante_asociado] AS [NumComprobanteAsociado]                
        ,[co_total_comprobante]   AS [TotalComprobante]                
        ,[co_fecha_in]     AS [FechaIn]                
        ,[co_canal]      AS [Canal]                
        ,[co_hora_export_import]  AS [HoraExportImport]                
        ,[co_id_punto]     AS [IdPunto]                
        ,[co_pais]      AS [Pais]                
        ,co.[co_fecha_emision]   AS [FechaEmision]                
        ,[co_anio_emi]    AS [AnioEmi]                
        ,[co_mes_emi]     AS [MesEmi]                
        ,[co_dia_emi]     AS [DiaEmi]                
        ,[co_establecimiento] AS [Establecimiento]            
        ,[co_punto_emision]    AS [PuntoEmision]                
        ,[co_secuencia]     AS [Secuencia]                
        ,[co_respuesta]     AS [Respuesta]                
        ,[co_detalle]                AS [Detalle]                
        ,[co_control]     AS [Control]                
        ,[co_id]   AS [Id]                
        ,[co_estado_notificacion]  AS [EstadoNotificacion]                
        ,[co_usuario_proceso]   AS [UsuarioProceso]                
        ,[co_version]     AS [Version]                
        ,[co_host_proceso]    AS [HostProceso]                
        ,[co_condicion_venta]   AS [CondicionVenta]                
        ,[co_concepto]     AS [Concepto]                
        ,[co_codigo_tipo_documento]  AS [CodigoTipoDocumento]                
        --adicionales--                
        ,tipo.[DescripcionTipoDocumento]                
        ,tipo.[DescripcionTipoDocumento]                
        --                
        ,em.em_nemonico AS Nemonico                 
        ,em.em_razon_social AS RazonSocialEmisor               
        ,co_identificacion AS [IdentificacionCliente]                
        ,co_razon_social AS [RazonSocialCliente]                
        --                
        ,null                
        ,null                
        ,co_mail_notificacion AS [MailNotificacion]                
        ,1      AS [ExisteBDD]                
        --                
        ,co_hora_bdd AS HoraBDD                
        ,co_guest_remoto AS GuestRemoto                 
        ,co_guest_app AS GuestApp                
        ,co_guest_version AS GuestVersion                
        ,co_seg_proceso AS SegProceso                
    FROM dbo.com_log_comprobante_xml co WITH (NOLOCK)              
    LEFT JOIN sat_catalogo.dbo.sc_vista_tipo_documetos tipo ON CodigoNegocio = co_codigo_tipo_documento and co_pais = Pais                
    LEFT JOIN sat_catalogo.dbo.sc_vista_estados_documentos ON CodigoEstatus = co_estatus                
    LEFT JOIN sat_catalogo.dbo.sc_emisor AS em WITH (NOLOCK) ON em.em_id_emisor = co_id_emisor                
    WHERE co.co_id_comprobante = @i_co_id_comprobante              
    
    SELECT @i_control = @@ROWCOUNT            
            
    PRINT dbo.fn_get_text_dif(@Inicio,@i_control,'Consulta com_log_comprobante_xml::')             
             
    BEGIN            
        SELECT @fin = getdate()             
        BEGIN TRY
            EXEC spco_crear_log_consulta @NombreSP,@i_Metodo,@i_AppName,@i_IdEmisor,@params,@i_control,@inicio,@fin,0,@i_IdUsuario            
        END TRY
        BEGIN CATCH
            PRINT '>>> ERROR AL REGISTRAR LOG FINAL: ' + ERROR_MESSAGE()
        END CATCH
    END            
                
    IF (@i_control = 0) --Busca en historica            
    BEGIN     
        PRINT 'Busca en historica'    
        INSERT INTO @com_log_comprobante_xml_aux            
        (                
            [IdComprobante]                
            ,[TramaDto]                
            ,[TramaAutorizado]            
            ,TramaEntrada            
            ,[HoraIn]                
            ,[Estatus]                
            ,[IdEmisor]                
            ,[NumComprobante]            
            ,[NombreArchivo]                
            ,[TipoComprobante]                
            ,[HoraReproceso]                
            ,[NumeroReprocesos]              
            ,[IdLicencia]                
            ,[IdCliente]                
            ,[NumAutorizacion]                
            ,[FechaAutorizacion]                
            ,[NumComprobanteAsociado]                
            ,[TotalComprobante]                
            ,[FechaIn]                
            ,[Canal]                
            ,[HoraExportImport]                
            ,[IdPunto]                
            ,[Pais]                
            ,[FechaEmision]                
            ,[AnioEmi]                
            ,[MesEmi]                
            ,[DiaEmi]                
            ,[Establecimiento]                
            ,[PuntoEmision]              
            ,[Secuencia]                
            ,[Respuesta]                
            ,[Detalle]                
            ,[Control]                
            ,[Id]                
            ,[EstadoNotificacion]                
            ,[UsuarioProceso]                
            ,[Version]                
            ,[HostProceso]                
            ,[CondicionVenta]                
            ,[Concepto]                
            ,[CodigoTipoDocumento]                
            --adicionales--                
            ,[TipoDocumento]                
            ,[DescripcionTipoDocumento]                
            --                
            ,[Nemonico]                
            ,[RazonSocialEmisor]                
            ,[IdentificacionCliente]                
            ,[RazonSocialCliente]                
            --                
            ,[DescripcionEstatus]                
            ,[DescripcionEstadoNotificacion]                
            ,[MailNotificacion]                
            ,[ExisteBDD]                  
        )                
        SELECT                
            co.[co_id_comprobante]  AS [IdComprobante]                
            ,[co_trama_dto]  AS [TramaDto]                
            ,[co_trama_autorizado] AS [TramaAutorizado]              
            ,co_trama_entrada            
            ,[co_hora_in]   AS [HoraIn]                
            ,[co_estatus]   AS [Estatus]                
            ,co.[co_id_emisor]  AS [IdEmisor]                
            ,[co_num_comprobante] AS [NumComprobante]                
            ,[co_nombre_archivo] AS [NombreArchivo]                
            ,[co_tipo_comprobante]  AS [TipoComprobante]                
            ,[co_hora_reproceso] AS [HoraReproceso]                
            ,[co_numero_reprocesos] AS [NumeroReprocesos]                
            ,[co_id_licencia]  AS [IdLicencia]                
            ,[co_id_cliente]  AS [IdCliente]                
            ,[co_num_autorizacion] AS [NumAutorizacion]                
            ,[co_fecha_autorizacion]  AS [FechaAutorizacion]                
            ,[co_num_comprobante_asociado] AS [NumComprobanteAsociado]                
            ,[co_total_comprobante]   AS [TotalComprobante]                
            ,[co_fecha_in]     AS [FechaIn]                
            ,[co_canal]      AS [Canal]                
            ,[co_hora_export_import]  AS [HoraExportImport]                
            ,[co_id_punto]     AS [IdPunto]                
            ,[co_pais]      AS [Pais]                
            ,co.[co_fecha_emision]   AS [FechaEmision]                
            ,[co_anio_emi]     AS [AnioEmi]                
            ,[co_mes_emi]     AS [MesEmi]                
            ,[co_dia_emi]     AS [DiaEmi]                
            ,[co_establecimiento] AS [Establecimiento]                
            ,[co_punto_emision]    AS [PuntoEmision]                
            ,[co_secuencia]     AS [Secuencia]                
            ,[co_respuesta]  AS [Respuesta]                
            ,[co_detalle]                AS [Detalle]                
            ,[co_control]     AS [Control]         
            ,[co_id]   AS [Id]                
            ,[co_estado_notificacion]  AS [EstadoNotificacion]                
            ,[co_usuario_proceso]   AS [UsuarioProceso]                
            ,[co_version]     AS [Version]             
            ,[co_host_proceso]    AS [HostProceso]                
            ,[co_condicion_venta]   AS [CondicionVenta]                
            ,'BDD HIS'     AS [Concepto]                
            ,[co_codigo_tipo_documento]  AS [CodigoTipoDocumento]               
            --adicionales--       
            ,tipo.[DescripcionTipoDocumento]             
            ,tipo.[DescripcionTipoDocumento]                
            --                
            ,em.em_nemonico AS Nemonico                 
            ,em.em_razon_social AS RazonSocialEmisor                
            ,co_identificacion AS [IdentificacionCliente]                
            ,co_razon_social AS [RazonSocialCliente]                
            --                
            ,null                
            ,null                
            ,co_mail_notificacion AS [MailNotificacion]                
            ,1      AS [ExisteBDD]                 
        FROM sat_comprobante_historica.dbo.com_log_comprobante_xml co WITH (NOLOCK)              
        LEFT JOIN sat_catalogo.dbo.sc_vista_tipo_documetos tipo ON CodigoNegocio = co_codigo_tipo_documento and co_pais = Pais                
        LEFT JOIN sat_catalogo.dbo.sc_vista_estados_documentos ON CodigoEstatus = co_estatus                
        LEFT JOIN sat_catalogo.dbo.sc_emisor AS em ON em.em_id_emisor = co_id_emisor                
        WHERE co.co_id_comprobante = @i_co_id_comprobante               
        
        SELECT @i_control = @i_control+@@ROWCOUNT            
        SELECT @i_co_his = 1 --para saber que consulto en la historica            
    END            
             
    IF (@i_control = 0) -- NO encontro comprobante               
    BEGIN                
        --Crea uno que no existe en BDD , estado NO EXISTE            
        INSERT INTO @com_log_comprobante_xml_aux (IdComprobante,Estatus) VALUES (@i_co_id_comprobante, 1)                
        SELECT @i_co_his = null -- Para no actualizar notificaciones            
    END                
    ELSE IF (
        @i_co_id_comprobante is null 
        or @i_co_id_comprobante = 0             
        or @i_co_id_comprobante = 23233731307840578 -- Panama            
        or @i_co_id_comprobante = 246126134328686971 -- Panama1 JL            
        or @i_co_id_comprobante = 246126200370708588 -- Panama            
        or @i_co_id_comprobante = 246126200368738975 -- Panama            
        or @i_co_id_comprobante = 244049303343775945            
        or @i_co_id_comprobante = 244126353367328078 -- Panama         
        or @i_co_id_comprobante = 251250112610694827 -- Panama        
    )               
    BEGIN                
        --Error PDF              
        UPDATE @com_log_comprobante_xml_aux SET TramaDto = null           
    END
      
    --notificaciones--            
    SELECT not_id, not_hora, not_id_comprobante, not_estado, not_mail      
    , not_id_usuario       
    , ROW_NUMBER() OVER(ORDER BY not_hora desc) AS IdRow      
    INTO #notificaciones      
    FROM dbo.com_Notificacion WITH(NOLOCK)             
    WHERE not_id_comprobante = @i_co_id_comprobante            
          
    IF (@@ROWCOUNT > 0)        
        UPDATE @com_log_comprobante_xml_aux             
        SET MailNotificacion = not_mail,            
            EstadoNotificacion = not_estado,            
            Notificacion = not_estado            
        FROM @com_log_comprobante_xml_aux INNER JOIN #notificaciones ON not_id_comprobante=IdComprobante      
        WHERE IdRow = 1      
      
    PRINT dbo.fn_get_text_dif(@Inicio,@i_control,'com_Notificacion::')        
    
    --------------      
    --Resultados--      
    --------------      
    DECLARE @tieneDatos int = 0            
    SELECT * FROM @com_log_comprobante_xml_aux     
    SET @tieneDatos = @@ROWCOUNT    
       
    IF (@tieneDatos > 0)    
    BEGIN    
        IF (@i_co_his = 1)    
        BEGIN    
            PRINT 'Detalle historico'    
            SELECT TOP (25)          
                dl_id_detalle_log AS IdDetalleLog,            
                ROW_NUMBER() OVER(ORDER BY dl_hora desc) AS Id,            
                dl_hora AS Hora,            
                dl_evento AS Evento,            
                null AS DecEvento,            
                dl_detalle_vento AS DetalleVento,            
                dl_id_comprobante AS IdComprobante,            
                dl_tipo_evento AS TipoEvento,            
                dl_grupo1 AS Grupo1,            
                dl_mensaje AS Mensaje            
            FROM sat_comprobante_historica.dbo.com_detalle_log dl WITH(NOLOCK)               
            WHERE dl_id_comprobante = @i_co_id_comprobante           
        END    
        ELSE    
        BEGIN    
            PRINT 'Detalle diaria'    
            SELECT TOP (25)          
                dl_id_detalle_log AS IdDetalleLog,            
                ROW_NUMBER() OVER(ORDER BY dl_hora desc) AS Id,            
                dl_hora AS Hora,            
                dl_evento AS Evento,            
                null AS DecEvento,            
                dl_detalle_vento AS DetalleVento,            
                dl_id_comprobante AS IdComprobante,            
                dl_tipo_evento AS TipoEvento,            
                dl_grupo1 AS Grupo1,            
                dl_mensaje AS Mensaje            
            FROM dbo.com_detalle_log dl WITH(NOLOCK)               
            WHERE dl_id_comprobante = @i_co_id_comprobante           
        END    
    END    
    ELSE    
    BEGIN    
        PRINT 'Sin Datos'    
        SELECT TOP (1)          
            dl_id_detalle_log AS IdDetalleLog,            
            ROW_NUMBER() OVER(ORDER BY dl_hora desc) AS Id,            
            dl_hora AS Hora,            
            dl_evento AS Evento,            
            null AS DecEvento,            
            dl_detalle_vento AS DetalleVento,            
            dl_id_comprobante AS IdComprobante,            
            dl_tipo_evento AS TipoEvento,            
            dl_grupo1 AS Grupo1,            
            dl_mensaje AS Mensaje            
        FROM dbo.com_detalle_log dl WITH(NOLOCK)               
        WHERE dl_id_comprobante = 0 --Solo por estructura    
    END    
     
    PRINT dbo.fn_get_text_dif(@Inicio,@@ROWCOUNT,'com_detalle_log::')          
             
    SELECT * FROM #notificaciones           
END
GO
