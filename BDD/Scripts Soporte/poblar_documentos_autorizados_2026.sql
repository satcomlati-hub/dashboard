USE [sat_catalogo]
GO

SET NOCOUNT ON;

DECLARE @FechaActual DATE = CAST(GETDATE() AS DATE);
DECLARE @FechaLimite DATE = DATEADD(year, -1, @FechaActual); -- Configurable: 1 año hacia atrás por defecto

DECLARE @FilasInsertadas INT;
DECLARE @Msj VARCHAR(500);

PRINT 'Iniciando proceso de carga para sc_documentos_autorizados_2026...';
PRINT 'Desde: ' + CONVERT(VARCHAR, @FechaActual, 120) + ' hasta ' + CONVERT(VARCHAR, @FechaLimite, 120);
PRINT '-------------------------------------------------------------------------';

WHILE @FechaActual >= @FechaLimite
BEGIN
    BEGIN TRY
        INSERT INTO [sat_catalogo].[dbo].[sc_documentos_autorizados_2026] (
            [IdComprobante],
            [HoraIn],
            [HoraReproceso],
            [Reprocesos],
            [Estatus],
            [IdEmisor],
            [NumComprobante],
            [TipoComprobante],
            [CodigoTipoComprobante],
            [NumComprobanteAsociado],
            [TotalComprobante],
            [Canal],
            [Pais],
            [ClaveAcceso],
            [Anio],
            [FechaEmision]
        )
        SELECT 
            l.[co_id_comprobante],
            l.[co_hora_in],
            l.[co_hora_reproceso],
            l.[co_numero_reprocesos],
            l.[co_estatus],
            l.[co_id_emisor],
            l.[co_num_comprobante],
            l.[co_tipo_comprobante],
            l.[co_codigo_tipo_documento],
            l.[co_num_comprobante_asociado],
            l.[co_total_comprobante],
            l.[co_canal],
            l.[co_pais],
            l.[co_clave_acceso],
            DATEPART(year, l.[co_fecha_emision]),
            CAST(l.[co_fecha_emision] AS DATE)
        FROM [sat_comprobante].[dbo].[com_log_comprobante_xml] l WITH (NOLOCK)
        WHERE l.[co_fecha_in] = @FechaActual
          AND l.[co_estatus] IN (SELECT Codigo FROM [sat_catalogo].[dbo].[sc_vista_estados_autorizados] WITH (NOLOCK))
          AND NOT EXISTS (
              SELECT 1 
              FROM [sat_catalogo].[dbo].[sc_documentos_autorizados_2026] d WITH (NOLOCK)
              WHERE d.[IdComprobante] = l.[co_id_comprobante]
          );

        SET @FilasInsertadas = @@ROWCOUNT;

        SET @Msj = 'Fecha: ' + CONVERT(VARCHAR, @FechaActual, 120) + ' | Registros insertados: ' + CAST(@FilasInsertadas AS VARCHAR);
        PRINT @Msj;

    END TRY
    BEGIN CATCH
        SET @Msj = 'ERROR en Fecha: ' + CONVERT(VARCHAR, @FechaActual, 120) + ' | Mensaje: ' + ERROR_MESSAGE();
        PRINT @Msj;
    END CATCH;

    -- Decrementar un día
    SET @FechaActual = DATEADD(day, -1, @FechaActual);
END;

PRINT '-------------------------------------------------------------------------';
PRINT 'Proceso de carga finalizado.';
GO
