USE [sat_comprobante]
GO
IF OBJECT_ID('[dbo].[spco_sop_mon_busca_comprobante]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spco_sop_mon_busca_comprobante_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spco_sop_mon_busca_comprobante', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spco_sop_mon_busca_comprobante];
    END
END
GO

CREATE PROCEDURE [dbo].[spco_sop_mon_busca_comprobante]
@Id bigint = null,
@Log bit = 1,
@Detalle int = 3000,
@Trama bit = 0
AS
BEGIN
    SET NOCOUNT ON; -- Evita mensajes de "filas afectadas" para mejorar el rendimiento de red

    DECLARE @Num VARCHAR(20), @cod VARCHAR(10), @IdEmisor INT, @co_pais INT;

    -- 1. Consulta inicial del comprobante en com_log_comprobante_xml
    SELECT 'com_log_comprobante_xml' AS tabla, 
           (SELECT 1 FROM sat_catalogo.dbo.sc_vista_emisores_offline WHERE IdEmisor = co_id_emisor) AS co_offline,
           co_id_comprobante, co_num_comprobante_asociado, em_nemonico, em_id_emisor, co_canal, co_seg_proceso, 
           co_numero_reprocesos, co_hora_reproceso, co_pais, co_fecha_emision, co_hora_in, co_hora_bdd, 
           co_host_proceso, Descripcion, co_estatus, co_id_emisor, co_codigo_tipo_documento, co_num_comprobante, 
           co_trama_dto, co_clave_acceso, co_num_autorizacion, co_trama_autorizado, co_detalle
    FROM sat_comprobante.dbo.com_log_comprobante_xml WITH (NOLOCK)
    INNER JOIN sat_catalogo.dbo.sc_emisor ON em_id_emisor = co_id_emisor
    INNER JOIN sat_catalogo..sc_vista_estados_documentos ON co_estatus = Codigo
    WHERE co_id_comprobante = @Id
    ORDER BY co_hora_reproceso;

    -- Obtener valores del comprobante para filtros y consultas cruzadas, incluyendo el país
    SELECT @Num = co_num_comprobante, 
           @cod = co_codigo_tipo_documento, 
           @IdEmisor = co_id_emisor,
           @co_pais = co_pais
    FROM sat_comprobante.dbo.com_log_comprobante_xml WITH (NOLOCK)
    WHERE co_id_comprobante = @Id;

    -- 2. Consultar documentos autorizados por ID
    SELECT 'sc_documentos_autorizados X ID' AS tabla, * 
    FROM sat_catalogo.[dbo].[sc_documentos_autorizados] WITH (NOLOCK) 
    WHERE IdComprobante = @Id
    ORDER BY HoraReproceso;

    -- 3. Consultar documentos autorizados por Número y Tipo
    SELECT 'sc_documentos_autorizados X Numero/tipo' AS tabla, *
    FROM sat_catalogo.[dbo].[sc_documentos_autorizados] WITH (NOLOCK)        
    WHERE IdEmisor = @IdEmisor          
      AND CodigoTipoComprobante = @cod       
      AND NumComprobante = @Num   
    ORDER BY HoraReproceso;

    -- 4. Identificar duplicados en com_log_comprobante_xml
    SELECT TOP 1500 co_fecha_in, co_id_comprobante AS OtrosIds, co_hora_bdd, co_canal, co_numero_reprocesos, 
                    co_seg_proceso, co_pais, co_fecha_emision, co_hora_in, co_estatus, co_id_emisor, 
                    co_codigo_tipo_documento, co_num_comprobante, co_clave_acceso, co_num_autorizacion, co_detalle,
                    CASE WHEN @Trama = 1 THEN co_trama_dto ELSE NULL END AS co_trama_dto    
    INTO #duplicados
    FROM sat_comprobante.dbo.com_log_comprobante_xml WITH (NOLOCK)
    WHERE co_id_emisor = @IdEmisor
      AND co_codigo_tipo_documento = @cod
      AND co_num_comprobante = @Num 
    ORDER BY co_hora_in DESC;

    SELECT * FROM #duplicados;

    -- 5. Resumen de duplicados en los últimos 3 meses
    SELECT COUNT(1) AS comprobantes, co_fecha_in, co_pais, co_id_emisor, co_codigo_tipo_documento, co_num_comprobante    
    FROM #duplicados
    WHERE co_id_emisor = @IdEmisor
      AND co_codigo_tipo_documento = @cod
      AND co_num_comprobante = @Num
      AND co_hora_in > DATEADD(MONTH, -3, GETDATE())
    GROUP BY co_fecha_in, co_pais, co_id_emisor, co_codigo_tipo_documento, co_num_comprobante, co_fecha_in;

    -- 6. Visualización de información de reportes según el país del comprobante
    -- Basado en las reglas de consulta_tablero_pendiente_info_reportes_2026
    IF @co_pais = 507 -- Panamá
    BEGIN
        SELECT 'com_aux_reportes_PA' AS tabla, * 
        FROM sat_comprobante.dbo.com_aux_reportes_PA WITH (NOLOCK) 
        WHERE Id = @Id;
    END
    ELSE IF @co_pais = 593 -- Ecuador
    BEGIN
        SELECT 'com_aux_reportes_SRI' AS tabla, * 
        FROM sat_comprobante.dbo.com_aux_reportes_SRI WITH (NOLOCK) 
        WHERE Id = @Id;
    END
    ELSE IF @co_pais = 506 -- Costa Rica
    BEGIN
        SELECT 'com_aux_resumen_CR' AS tabla, * 
        FROM sat_comprobante.dbo.com_aux_resumen_CR WITH (NOLOCK) 
        WHERE Id = @Id;
    END
    ELSE IF @co_pais = 57 -- Colombia
    BEGIN
        SELECT 'com_aux_resumen_CO' AS tabla, * 
        FROM sat_comprobante.dbo.com_aux_resumen_CO WITH (NOLOCK) 
        WHERE Id = @Id;

        SELECT 'com_informacion_impuestos' AS tabla, * 
        FROM sat_comprobante.dbo.com_informacion_impuestos WITH (NOLOCK) 
        WHERE im_id_comprobante = @Id;
    END
    ELSE IF @co_pais = 591 -- Bolivia
    BEGIN
        SELECT 'com_aux_resumen_BO' AS tabla, * 
        FROM sat_comprobante.dbo.com_aux_resumen_BO WITH (NOLOCK) 
        WHERE Id = @Id;
    END

    -- 7. Consultar logs de MySatcom si @Log = 1
    IF (@Log = 1)
    BEGIN
        SELECT TOP 100 [log_guid], [log_canal], [log_id_comprobante], [log_hora], 
                       CAST(DECOMPRESS(log_trama) AS NVARCHAR(MAX)) AS log_trama,
                       CAST(DECOMPRESS(log_trama2) AS NVARCHAR(MAX)) AS log_trama2,
                       [log_detalle_proceso], em_nemonico, em_pais, [log_id_emisor], 
                       [log_hostname], [log_usuario], [log_appname], em_razon_social
        FROM sat_logging.dbo.log_mysatcom WITH (NOLOCK)
        LEFT OUTER JOIN sat_catalogo.dbo.sc_emisor ON em_id_emisor = log_id_emisor
        WHERE [log_id_comprobante] = @Id
        ORDER BY log_hora DESC;
    END

    -- 8. Consultar detalle de logs si @Detalle > 0
    IF (@Detalle > 0)
    BEGIN
        SELECT TOP (@Detalle) dl_id_detalle_log, dl_hora, dl_hora_bdd, dl_evento, dl_app_name,
                             DATEDIFF(SECOND, dl_hora, dl_hora_bdd) AS TiempoEnColas,            
                             LAG(dl_hora) OVER (ORDER BY dl_hora) AS Anterior,
                             DATEDIFF(SECOND, LAG(dl_hora) OVER (ORDER BY dl_hora), dl_hora) AS [TProcesoPrevio(Seg)],
                             dl_id_comprobante, dl_tipo_evento, dl_mensaje,
                             CAST(DECOMPRESS(dl_detalle_evento_cp) AS NVARCHAR(MAX)) AS detalle_xml_descomprimido,        
                             dl_detalle_vento, dl_detalle_evento_cp, dl_host_name, dl_version, dl_tiempo_proceso         
        INTO #DetallesAux
        FROM sat_comprobante.dbo.com_detalle_log WITH (NOLOCK)
        WHERE dl_id_comprobante = @Id
        ORDER BY dl_hora DESC;

        SELECT MIN(dl_hora) AS HoraMinima,
               MAX(dl_hora) AS HoraMaxima,
               DATEDIFF(SECOND, MIN(dl_hora), MAX(dl_hora)) AS TiempoTranscurridoSegundos
        FROM #DetallesAux;

        SELECT * FROM #DetallesAux ORDER BY dl_hora;
    END
END
GO
