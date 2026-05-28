USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spct_reporte_ec_venta_pos]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spct_reporte_ec_venta_pos_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spct_reporte_ec_venta_pos', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spct_reporte_ec_venta_pos];
    END
END
GO

CREATE PROCEDURE [dbo].[spct_reporte_ec_venta_pos]      
    @i_IdEmisor VARCHAR(MAX) = NULL,      
    @i_CodigoEstablecimiento VARCHAR(3) = NULL,      
    @i_CodigoPunto VARCHAR(3) = NULL,      
    -- fechas      
    @i_HoraInicio DATE = NULL,      
    @i_HoraFin DATE = NULL       
    -- exec spct_reporte_ec_venta_pos 2143,null,null,'2026-02-23','2026-02-23'    
AS      
BEGIN      
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;      

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = DB_NAME() + '.dbo.' + OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX);

    -- Construir cadena de parámetros para logs
    SET @params = CONCAT(
        '->spct_reporte_ec_venta_pos ',
        '@i_IdEmisor: ', ISNULL(@i_IdEmisor, 'NULL'),
        ', @i_CodigoEstablecimiento: ', ISNULL(@i_CodigoEstablecimiento, 'NULL'),
        ', @i_CodigoPunto: ', ISNULL(@i_CodigoPunto, 'NULL'),
        ', @i_HoraInicio: ', ISNULL(CONVERT(VARCHAR, @i_HoraInicio, 120), 'NULL'),
        ', @i_HoraFin: ', ISNULL(CONVERT(VARCHAR, @i_HoraFin, 120), 'NULL')
    );

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY

        -- Validación de parámetro obligatorio
        IF (@i_IdEmisor IS NULL)
        BEGIN
            SET @error_msg = 'rows:0 - Emitter ID is NULL';
            GOTO REGISTRAR_LOGS;
        END

        -- Variables internas
        DECLARE @t_Comprobantes AS ComprobanteXML;        
           
        -- Limpieza de tabla temporal
        IF (OBJECT_ID('tempdb.dbo.#consultaPos','U')) IS NOT NULL 
            DROP TABLE #consultaPos;      
        
        CREATE TABLE #consultaPos (      
            Num DECIMAL(30,0) IDENTITY(1,1),      
            IdReq VARCHAR(20),      
            IdCli DECIMAL(18,0),      
            IdEstado INT,      
            Cedula_RUC VARCHAR(100),      
            RazonSocial VARCHAR(300),      
            Estab VARCHAR(10),      
            Punto VARCHAR(10),      
            Documento VARCHAR(20),      
            HoraIn DATETIME,      
            Fecha DATETIME,      
            TipoDocumento VARCHAR(100),      
            Subtotal DECIMAL(18,2),      
            Base0 DECIMAL(18,2),      
            Base12 DECIMAL(18,2),      
            Base14 DECIMAL(18,2),      
            BaseNoSujeto DECIMAL(18,2),      
            BaseExenta DECIMAL(18,2),      
            IVA DECIMAL(18,2),      
            ICE DECIMAL(18,2),      
            Propina DECIMAL(18,2),      
            Total DECIMAL(18,2),      
            Gratificacion DECIMAL(18,2),      
            ImporteTotal DECIMAL(18,2),      
            Estado VARCHAR(100),      
            NumAutorizacion VARCHAR(60),      
            FechaAutorizacion VARCHAR(50),      
            SinUtilizacionSistemaFinanciero DECIMAL(18,2),      
            ConUtilizacionSistemaFinanciero DECIMAL(18,2),      
            TarjetaCredito DECIMAL(18,2),      
            TarjetaPrepago DECIMAL(18,2),      
            DineroElectronico DECIMAL(18,2),      
            TarjetaDebito DECIMAL(18,2),      
            CompensacionDeDeudas DECIMAL(18,2),      
            Descuento DECIMAL(18,2),      
            [CheckMicros] VARCHAR(200),      
            NotaCredito VARCHAR(30),      
            IdEmi DECIMAL(18,0),      
            Base8 DECIMAL(18,2),      
            Folio VARCHAR(100),      
            Base5 DECIMAL(18,2),      
            Base13 DECIMAL(18,2),      
            Base15 DECIMAL(18,2),      
            OtrosRubros DECIMAL(18,2)      
        );      
        
        CREATE INDEX ix_temp_1 ON #consultaPos(IdReq);      
        CREATE INDEX ix_temp_2 ON #consultaPos(IdCli);      
        
        -- Ejecución del SP de consulta base
        INSERT INTO @t_Comprobantes (      
            [IdComprobante], 
            [HoraIn], 
            [Estatus], 
            [IdEmisor], 
            [NumComprobante], 
            [TipoComprobante], 
            [CodigoTipoDocumento], 
            [DescripcionTipoDocumento],       
            [HoraReproceso], 
            [IdLicencia], 
            [IdCliente], 
            [NumAutorizacion], 
            [FechaAutorizacion], 
            [NumComprobanteAsociado], 
            [TotalComprobante], 
            [FechaIn],       
            [Canal], 
            [HoraExportImport], 
            [IdPunto], 
            [Pais], 
            [FechaEmision], 
            [AnioEmi], 
            [MesEmi], 
            [DiaEmi], 
            [Establecimiento], 
            [PuntoEmision], 
            [Secuencia],       
            [Respuesta], 
            [Detalle], 
            [Control], 
            [Id], 
            [Notificacion], 
            [UsuarioProceso], 
            [Version], 
            [HostProceso], 
            [CondicionVenta], 
            [Concepto], 
            [MailNotificacion],       
            [Nemonico], 
            [IdentificacionCliente], 
            [RazonSocialCliente], 
            [DescripcionEstatus], 
            [TipoIdentificacion],
            Propina      
        )                 
        EXEC spco_consulta_comprobantes_base_reportes_2024  
            @i_HoraFin, 
            @i_HoraInicio,
            @i_IdEmisor,
            @i_CodigoEstablecimiento,
            @i_CodigoPunto,
            NULL;

        -- Inserción inicial en tabla temporal
        INSERT INTO #consultaPos (      
            IdReq, 
            Estab,
            Punto,
            Documento,
            IdCli,
            Estado,
            Fecha,
            TipoDocumento,
            FechaAutorizacion,
            NumAutorizacion,
            Cedula_RUC,
            RazonSocial,
            Propina,
            HoraIn, 
            NotaCredito
        )      
        SELECT DISTINCT 
            a.IdComprobante,
            a.Establecimiento,
            a.PuntoEmision,
            a.Secuencia,
            a.IdCliente,
            a.DescripcionEstatus,
            a.FechaEmision,
            a.DescripcionTipoDocumento,
            a.FechaAutorizacion,
            a.NumAutorizacion,
            a.IdentificacionCliente,
            a.RazonSocialCliente,
            a.Propina,
            a.HoraIn, 
            a.NumComprobanteAsociado      
        FROM @t_Comprobantes a      
        WHERE a.TipoComprobante IN ('1', '2') 
          AND a.Estatus NOT IN (14, 30)      
          AND (CONVERT(DATE, a.FechaEmision) BETWEEN @i_HoraInicio AND @i_HoraFin);

        PRINT '   1. Info inicial insertada en #consultaPos: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';
        
        -- Relación con documento asociado (Nota de Crédito)
        UPDATE #consultaPos 
        SET NotaCredito = doc.NumDocSustento      
        FROM com_informacion_documento_asociado doc      
        WHERE #consultaPos.IdReq = doc.IdComprobante      
          AND (#consultaPos.TipoDocumento = 'NOTA DE CREDITO' OR (#consultaPos.TipoDocumento = 'FACTURA' AND #consultaPos.Estado = 'Emision_NC'));

        PRINT '   2. Documento sustento modificado: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';
          
        -- Formas de Pago
        SELECT 
            fp_id_comprobante,
            fp_forma_pago,
            fp_valor_pago       
        INTO #TempPagosEc      
        FROM com_informacion_formas_pago WITH(NOLOCK)      
        INNER JOIN #consultaPos ON IdReq = fp_id_comprobante;

        CREATE INDEX ix_id_im_1 ON #TempPagosEc(fp_id_comprobante);      
        CREATE INDEX ix_id_im_2 ON #TempPagosEc(fp_forma_pago);      

        PRINT '   3. Formas de pago cargadas: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';
        
        UPDATE #consultaPos      
        SET SinUtilizacionSistemaFinanciero = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('SIN_UTILIZACION_DEL_SISTEMA_FINANCIERO_01', 'SIN UTILIZACION DEL SISTEMA FINANCIERO', 'Efectivo');
        
        UPDATE #consultaPos      
        SET ConUtilizacionSistemaFinanciero = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('OTROS_CON_UTILIZACION_DEL_SISTEMA_FINANCIERO_20', 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO', 'Transferencia - deposito bancario', 'Transferencia_Deposito');
        
        UPDATE #consultaPos      
        SET TarjetaCredito = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('TARJETA_DE_CREDITO_19', 'TARJETA DE CREDITO');
        
        UPDATE #consultaPos      
        SET TarjetaPrepago = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('TARJETA_PREPAGO_18', 'TARJETA PREPAGO');
        
        UPDATE #consultaPos      
        SET DineroElectronico = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('DINERO_ELECTRONICO_17', 'DINERO ELECTRONICO');
        
        UPDATE #consultaPos      
        SET TarjetaDebito = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('TARJETA_DE_DEBITO_16', 'TARJETA DE DEBITO');
        
        UPDATE #consultaPos      
        SET CompensacionDeDeudas = fp.fp_valor_pago      
        FROM #TempPagosEc fp      
        WHERE IdReq = fp.fp_id_comprobante      
          AND fp.fp_forma_pago IN ('COMPENSACION_DE_DEUDAS_15', 'COMPENSACION DE DEUDAS');
           
        PRINT '   4. Formas de pago actualizadas.';

        -- Actualización de totales
        UPDATE #consultaPos      
        SET Subtotal = TRY_CONVERT(DECIMAL(18,2), ISNULL(aux.SubTotal, 0)),      
            Propina = ISNULL(TRY_CONVERT(DECIMAL(18,2), aux.Propina), 0),      
            Total = aux.Total,      
            Descuento = aux.TotalDescuento,      
            OtrosRubros = aux.OtrosRubros      
        FROM com_aux_reportes_SRI aux WITH(NOLOCK)      
        WHERE IdReq = aux.Id;

        PRINT '   5. Totales desde aux_reportes_SRI actualizados: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';

        -- Impuestos
        SELECT 
            im_id_comprobante,
            im_codigo_impuesto,
            im_codigo_tarifa,
            im_base_imponible,
            im_valor_impuesto      
        INTO #TempimpuestosEc      
        FROM com_informacion_impuestos WITH(NOLOCK)      
        INNER JOIN #consultaPos ON IdReq = im_id_comprobante;

        CREATE INDEX ix_id_im_1 ON #TempimpuestosEc(im_id_comprobante);      
        CREATE INDEX ix_id_im_2 ON #TempimpuestosEc(im_codigo_impuesto);      
        CREATE INDEX ix_id_im_3 ON #TempimpuestosEc(im_codigo_tarifa);      

        PRINT '   6. Impuestos cargados en temporal: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';

        UPDATE #consultaPos 
        SET Base0 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa = '00' OR im_codigo_tarifa = '0');
        
        UPDATE #consultaPos 
        SET Base12 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('12', '2'));
        
        UPDATE #consultaPos 
        SET Base14 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('14', '3'));
        
        UPDATE #consultaPos 
        SET Base15 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('15', '4'));
        
        UPDATE #consultaPos 
        SET Base13 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('13', '10'));
        
        UPDATE #consultaPos 
        SET Base5 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('5'));
        
        UPDATE #consultaPos 
        SET Base8 = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('8'));
        
        UPDATE #consultaPos 
        SET BaseNoSujeto = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('6'));
        
        UPDATE #consultaPos 
        SET BaseExenta = im_base_imponible      
        FROM #TempimpuestosEc      
        WHERE im_id_comprobante = IdReq AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('7'));
        
        UPDATE #consultaPos      
        SET IVA = TRY_CONVERT(DECIMAL(18,2), ISNULL(aux.im_valor_impuesto, 0))      
        FROM #TempimpuestosEc aux      
        WHERE aux.im_id_comprobante = IdReq      
          AND ISNULL(IVA, 0) = 0       
          AND im_codigo_impuesto = '2'      
          AND (im_codigo_tarifa IN ('2', '3', '4', '5', '8', '10'));
            
        PRINT '   7. Bases imponibles e IVA calculados.';
            
        UPDATE #consultaPos      
        SET ICE = TRY_CONVERT(DECIMAL(18,2), ISNULL(aux.im_valor_impuesto, 0))      
        FROM #TempimpuestosEc aux       
        WHERE aux.im_id_comprobante = IdReq      
          AND im_codigo_impuesto = '3';
          
        PRINT '   8. ICE actualizado.';

        -- Información Adicional
        SELECT 
            ia_id_comprobante,
            ia_nombre_campo,
            ia_valor_campo,
            ia_pais      
        INTO #TempInfoAdicionalEC      
        FROM com_informacion_adicional_XML WITH(NOLOCK)      
        INNER JOIN #consultaPos ON IdReq = ia_id_comprobante;      

        CREATE INDEX ix_id_ia_1 ON #TempInfoAdicionalEC(ia_id_comprobante);      
        CREATE INDEX ix_id_ia_2 ON #TempInfoAdicionalEC(ia_nombre_campo);      
          
        -- Gratificación
        DECLARE @campoGrat AS VARCHAR(50) = 'GRATIFICACION,extraTip';  

        UPDATE #consultaPos      
        SET Gratificacion = via.ia_valor_campo      
        FROM #TempInfoAdicionalEC via      
        WHERE IdReq = via.ia_id_comprobante      
          AND via.ia_nombre_campo IN (SELECT valor FROM sat_comprobante.dbo.fn_split_string(@campoGrat, ','));    
        
        UPDATE #consultaPos      
        SET Folio = via.ia_valor_campo      
        FROM #TempInfoAdicionalEC via      
        WHERE IdReq = via.ia_id_comprobante      
          AND via.ia_nombre_campo LIKE 'FOLIO%';
        
        DECLARE @campotemp AS VARCHAR(50) = 'CHECK,CHECKMICROS,CHECKNUMBER,Fact_Fidelio,MEWS BILL NUMBER,LIGHTSPEED SERVER ID';      
          
        UPDATE #consultaPos      
        SET [CheckMicros] = via.ia_valor_campo      
        FROM #TempInfoAdicionalEC via      
        WHERE IdReq = via.ia_id_comprobante      
          AND via.ia_nombre_campo IN (SELECT valor FROM sat_comprobante.dbo.fn_split_string(@campotemp, ','));   
       
        PRINT '   9. Info Adicional (Gratificacion, Folio, CheckMicros) procesada.';
          
        UPDATE #consultaPos       
        SET TipoDocumento = UPPER(TipoDocumento);      
        
        -- Propina en caso de ser NC o vacía
        UPDATE #consultaPos      
        SET Propina = via.ia_valor_campo      
        FROM #TempInfoAdicionalEC via      
        WHERE IdReq = via.ia_id_comprobante      
          AND (ISNULL(Propina, 0) = 0 OR TipoDocumento = 'NotaCredito' OR TipoDocumento = 'NOTA DE CREDITO')      
          AND via.ia_nombre_campo LIKE 'PROPINA%';      
        
        -- Cálculos de Subtotal y Total en cero / NC
        UPDATE #consultaPos      
        SET Subtotal = TRY_CONVERT(DECIMAL(18,2), ISNULL(Base0, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base5, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base8, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base12, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base13, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base14, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base15, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseNoSujeto, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseExenta, 0))      
        WHERE ISNULL(Subtotal, 0) = 0;      
        
        UPDATE #consultaPos      
        SET Total = TRY_CONVERT(DECIMAL(18,2), ISNULL(Base0, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base5, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base8, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base12, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base13, 0))      
          + try_convert(DECIMAL(18,2), ISNULL(Base14, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Base15, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseNoSujeto, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseExenta, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(IVA, 0))      
          + TRY_CONVERT(DECIMAL(18,2), ISNULL(Propina, 0))      
        WHERE (ISNULL(Total, 0) = 0 OR TipoDocumento = 'NotaCredito' OR TipoDocumento = 'NOTA DE CREDITO');      
        
        -- Limpieza de Duplicados
        DELETE T      
        FROM (      
            SELECT *,      
                   DupRank = ROW_NUMBER() OVER (      
                                PARTITION BY Estab, Punto, Documento, TipoDocumento      
                                ORDER BY (HoraIn) DESC      
                             )      
            FROM #consultaPos      
            WHERE Estado NOT IN ('PendienteValidacionSATCOM', 'DuplicadoSatcom', 'ErrorSecuencialDocumento', 'ImportadoDuplicado')      
        ) AS T      
        WHERE DupRank > 1;

        PRINT '   10. Duplicados eliminados: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';
        
        -- Negatividad de Notas de Crédito
        UPDATE #consultaPos      
        SET Subtotal = ISNULL(Subtotal, 0) * (-1),      
            Base0 = ISNULL(Base0, 0) * (-1),      
            Base5 = ISNULL(Base5, 0) * (-1),      
            Base8 = ISNULL(Base8, 0) * (-1),      
            Base12 = ISNULL(Base12, 0) * (-1),      
            Base13 = ISNULL(Base13, 0) * (-1),      
            Base14 = ISNULL(Base14, 0) * (-1),      
            Base15 = ISNULL(Base15, 0) * (-1),        
            BaseNoSujeto = ISNULL(BaseNoSujeto, 0) * (-1),      
            BaseExenta = ISNULL(BaseExenta, 0) * (-1),      
            IVA = ISNULL(IVA, 0) * (-1),      
            Propina = ISNULL(Propina, 0) * (-1),      
            Gratificacion = ISNULL(Gratificacion, 0) * (-1),      
            Descuento = ISNULL(Descuento, 0) * (-1),      
            OtrosRubros = ISNULL(OtrosRubros, 0) * (-1),      
            Total = ISNULL(Total, 0) * (-1),      
            SinUtilizacionSistemaFinanciero = ISNULL(SinUtilizacionSistemaFinanciero, 0) * (-1),      
            ConUtilizacionSistemaFinanciero = ISNULL(ConUtilizacionSistemaFinanciero, 0) * (-1),      
            TarjetaCredito = ISNULL(TarjetaCredito, 0) * (-1),      
            TarjetaPrepago = ISNULL(TarjetaPrepago, 0) * (-1),      
            DineroElectronico = ISNULL(DineroElectronico, 0) * (-1),      
            TarjetaDebito = ISNULL(TarjetaDebito, 0) * (-1),      
            CompensacionDeDeudas = ISNULL(CompensacionDeDeudas, 0) * (-1)      
        WHERE TipoDocumento IN ('NotaCredito', 'NOTA DE CREDITO');      
          
        PRINT '   11. Negatividad de notas de crédito completada: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' filas.';
        
        -- Capturar filas del procesamiento principal
        DECLARE @rows_procesados INT;
        SELECT @rows_procesados = COUNT(1) FROM #consultaPos;
        SET @error_msg = 'rows:' + CAST(@rows_procesados AS VARCHAR);

        -- Resultado
        SELECT      
            ROW_NUMBER() OVER(ORDER BY Fecha DESC) AS Num,      
            IdReq,      
            Cedula_RUC,      
            RazonSocial,      
            Estab,      
            Punto,      
            Documento,      
            [CheckMicros],      
            Folio,      
            HoraIn,      
            Fecha AS FechaEmision,      
            TipoDocumento,      
            ISNULL(Subtotal, 0) AS Subtotal,      
            ISNULL(Base0, 0) AS Base0,      
            ISNULL(Base5, 0) AS Base5,      
            ISNULL(Base8, 0) AS BaseIvaVariable,      
            ISNULL(Base12, 0) AS Base12,      
            ISNULL(Base13, 0) AS Base13,      
            ISNULL(Base14, 0) AS Base14,      
            ISNULL(Base15, 0) AS Base15,      
            ISNULL(BaseNoSujeto, 0) AS BaseNoSujeto,      
            ISNULL(BaseExenta, 0) AS BaseExenta,      
            ISNULL(IVA, 0) AS IVA,      
            ISNULL(ICE, 0) AS ICE,      
            ISNULL(Propina, 0) AS [Servicio10%],      
            ISNULL(OtrosRubros, 0) AS OtrosRubrosTerceros,      
            ISNULL(Descuento, 0) AS Descuento,      
            ISNULL(Total, 0) AS Total,   
            ISNULL(Gratificacion, 0) AS Gratificacion,      
            (ISNULL(Gratificacion, 0) + ISNULL(Total, 0)) AS ImporteTotal,    
            Estado,      
            NotaCredito,      
            NumAutorizacion,      
            FechaAutorizacion,      
            ISNULL(SinUtilizacionSistemaFinanciero, 0) AS SinUtilizacionSistemaFinanciero,      
            ISNULL(ConUtilizacionSistemaFinanciero, 0) AS ConUtilizacionSistemaFinanciero,      
            ISNULL(TarjetaCredito, 0) AS TarjetaCredito,      
            ISNULL(TarjetaPrepago, 0) AS TarjetaPrepago,      
            ISNULL(DineroElectronico, 0) AS DineroElectronico,      
            ISNULL(TarjetaDebito, 0) AS TarjetaDebito,      
            ISNULL(CompensacionDeDeudas, 0) AS CompensacionDeDeudas  
        FROM #consultaPos      
        ORDER BY Num ASC;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- Alerta obligatoria a Postgres
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = 'spct_reporte_ec_venta_pos',
            @country = NULL,
            @issuing = @i_IdEmisor,
            @message = @ErrorMessage,
            @extra_info = '{"Error": "Error en reporte venta pos"}';

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;

        -- Limpieza de temporales en caso de fallo
        IF (OBJECT_ID('tempdb.dbo.#consultaPos','U')) IS NOT NULL 
            DROP TABLE #consultaPos;      

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH

REGISTRAR_LOGS:
    -- Limpieza final de temporales
    IF (OBJECT_ID('tempdb.dbo.#consultaPos','U')) IS NOT NULL 
        DROP TABLE #consultaPos;      

    SET @fin = GETDATE();

    -- Intento de parsear el Emisor si es numérico para la bitácora
    DECLARE @emisor_int INT = 0;
    IF ISNUMERIC(@i_IdEmisor) = 1
        SET @emisor_int = TRY_CAST(@i_IdEmisor AS INT);

    EXEC [dbo].[spco_crear_log_consulta] 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_hostname = NULL,
        @i_lc_appname = 'BATCH',
        @i_lc_emisor = @emisor_int,
        @i_lc_parametros = @params,
        @i_lc_origen = 'Bitacora',
        @i_lc_inicio = @inicio,
        @i_lc_fin = @fin,
        @i_lc_error = @error_msg,
        @i_lc_usuario = NULL;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';

    RETURN 0;
END
GO
