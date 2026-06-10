USE [sat_comprobante]
GO

IF OBJECT_ID('[dbo].[spct_reporte_co_compras_2025]') IS NOT NULL
BEGIN
    -- Generar nombre de backup con formato: NombreSP_BK_DD_Mon_YYYY
    DECLARE @NombreBK NVARCHAR(255) = 'spct_reporte_co_compras_2025_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    
    -- Solo creamos el backup si no existe uno para el día de hoy (preservamos la primera versión del día)
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spct_reporte_co_compras_2025', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spct_reporte_co_compras_2025];
    END
END
GO

CREATE PROCEDURE [dbo].[spct_reporte_co_compras_2025]       
------------------------------         
--Jaime Lucas 3/12/2025 ------------------  
    @i_IdEmisor varchar(max) = null,        
    --fechas        
    @i_HoraInicio date = null,        
    @i_HoraFin date = null        
AS        
BEGIN        
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    -- VARIABLES LOGGING
    DECLARE @NombreSP VARCHAR(200) = DB_NAME() + '.' + OBJECT_NAME(@@PROCID);
    DECLARE @inicio DATETIME = GETDATE();
    DECLARE @fin DATETIME;
    DECLARE @params VARCHAR(MAX);
    DECLARE @error_msg NVARCHAR(MAX); -- Para conteo de filas o errores

    -- LOG EJECUTIVO: Construir la cadena para poder replicar la ejecución exacta
    SET @params = CONCAT(
        'EXEC [dbo].[spct_reporte_co_compras_2025] ',
        '@i_IdEmisor = ', ISNULL('''' + @i_IdEmisor + '''', 'NULL'), ', ',
        '@i_HoraInicio = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraInicio, 120) + '''', 'NULL'), ', ',
        '@i_HoraFin = ', ISNULL('''' + CONVERT(VARCHAR, @i_HoraFin, 120) + '''', 'NULL')
    );

    PRINT '--- INICIO PROCESO: ' + @NombreSP + ' [' + CONVERT(VARCHAR, @inicio, 120) + '] ---';

    BEGIN TRY
        PRINT '1. [Preparación] - Creando tablas temporales de catálogos y estados...';

        SELECT         
            CodigoNegocio,            
            Pais,        
            DescripcionTipoDocumento        
        INTO #tmp_tipo_documentos            
        FROM sat_catalogo.dbo.sc_vista_tipo_documetos;              
        
        SELECT             
            Codigo AS Codigo_ed,            
            Descripcion AS Descripcion_ed            
        INTO #tmp_estados_documentos       
        FROM sat_catalogo.dbo.sc_vista_estados_autorizacion;       
        
        SELECT             
            Codigo AS Codigo_eau,            
            Descripcion AS Descripcion_eau           
        INTO #tmp_estados_autorizador            
        FROM sat_catalogo.dbo.sc_vista_estados_documentos;      
        
        SELECT             
            Codigo AS Codigo_eap,            
            Descripcion  AS Descripcion_eap          
        INTO #tmp_estados_aprobacion            
        FROM sat_catalogo.dbo.sc_vista_estados_aprobacion;      
        
        DECLARE @inicio_proceso DATETIME = GETDATE();

        IF (OBJECT_ID('tempdb.dbo.#consultaREC','U')) IS NOT NULL 
            DROP TABLE #consultaREC;        
        
        CREATE TABLE #consultaREC (   
            Num decimal(30,0) IDENTITY(1,1),        
            IdReq varchar(20),        
            IdCli decimal(18,0),          
            Cedula_RUC varchar(200),        
            RazonSocial varchar(200),       
            Documento varchar(30),        
            Fecha datetime,        
            TipoDocumento varchar(100),      
            Moneda varchar(10),      
            TasaCambio decimal(18,2),      
            Subtotal decimal(18,2),        
            DescuentoDetalle decimal(18,2),       
            RecargoDetalle decimal(18,2),      
            TotalNeto decimal(18,2),      
            IVA decimal(18,2),      
            INC decimal(18,2),      
            Bolsas decimal(18,2),        
            OtrosImpuestos decimal(18,2),        
            DescuentoGlobal decimal(18,2),       
            RecargoGlobal decimal(18,2),      
            TotalFactura decimal(18,2),        
            EstadomySatcom varchar(100),      
            EstadoDIAN varchar(100),      
            EstadoAprobacion varchar(100),      
            CUFE varchar(120),        
            FechaAutorizacion varchar(50),      
            BaseNoTax decimal(18,2),      
            BaseIVA decimal(18,2),      
            BaseExcento decimal(18,2),      
            BaseICA decimal(18,2),      
            BaseINC decimal(18,2),      
            BaseICL decimal(18,2),      
            BaseIBUA decimal(18,2),      
            BaseICUI decimal(18,2),      
            BaseIC decimal(18,2),      
            ICA decimal(18,2),      
            IC decimal(18,2),      
            ICL decimal(18,2),      
            IBUA decimal(18,2),      
            ICUI decimal(18,2),      
            TotalTemp decimal(18,2),
            CodigoFormaPago varchar(50),
            CodigoMedioPago varchar(50),
            FormaPagoColombia varchar(100),
            Plazo int,
            MedioPagoColombia varchar(100),
            TramaXML XML  
        );        
        
        CREATE INDEX ix_temp_1 ON #consultaREC(IdReq);        
        CREATE INDEX ix_temp_2 ON #consultaREC(IdCli);        
             
        IF (@i_IdEmisor IS NULL) 
        BEGIN
            SET @error_msg = 'rows:0 (Emisor nulo)';
            RETURN 0;        
        END

        PRINT '2. [Extracción] - Insertando registros en #consultaREC...';

        INSERT INTO #consultaREC (
            IdReq,
            Documento,
            TipoDocumento,
            IdCli,
            CUFE,
            FechaAutorizacion,
            Fecha,
            EstadoDIAN,
            EstadomySatcom,
            EstadoAprobacion,
            TotalTemp,
            TramaXML
        )      
        SELECT            
            co_id_autorizacion, 
            co_num_comprobante, 
            DescripcionTipoDocumento, 
            co_id_proveedor, 
            ISNULL(co_clave_acceso, co_num_autorizacion), 
            co_fecha_autorizacion,        
            co_fecha_emision,
            Descripcion_eau,
            Descripcion_ed,
            Descripcion_eap,
            co_importe_total,
            co_trama_DTO  
        FROM com_log_autorizacion WITH(NOLOCK)             
        INNER JOIN #tmp_tipo_documentos AS tipo 
            ON CodigoNegocio = co_tipo_comprobante 
            AND co_pais = Pais              
        LEFT OUTER JOIN #tmp_estados_documentos 
            ON Codigo_ed = co_estatus        
        LEFT OUTER JOIN #tmp_estados_autorizador 
            ON Codigo_eau = co_estatus_sri       
        LEFT OUTER JOIN #tmp_estados_aprobacion 
            ON Codigo_eap = co_estatus_aprobacion       
        WHERE co_id_emisor = @i_IdEmisor             
            AND co_estatus_sri NOT IN (14, 57, 16) -- No duplicados
            AND co_estatus NOT IN (9)
            AND CONVERT(DATE, co_fecha_emision) BETWEEN @i_HoraInicio AND @i_HoraFin;

        PRINT '   Registros insertados: ' + CAST(@@ROWCOUNT AS VARCHAR);

        IF (OBJECT_ID('tempdb.dbo.#CLiente','U')) IS NOT NULL 
            DROP TABLE #CLiente;   
        
        PRINT '3. [Procesamiento XML] - Extrayendo información de clientes...';

        SELECT 
            t1.IdReq AS IdRequerimiento,  
            Req.data.value('RucEmisor[1]', 'varchar(20)') AS RucEmisor,  
            Req.data.value('TipoIdentificacionEmisor[1]', 'varchar(5)') AS TipoIdentificacionEmisor,  
            Req.data.value('RazonSocialEmisor[1]', 'varchar(200)') AS RazonSocialEmisor,   
            Req.data.value('RazonComercialEmisor[1]', 'varchar(200)') AS RazonComercialEmisor,  
            Req.data.value('DireccionEmisor[1]', 'varchar(200)') AS DireccionEmisor  
        INTO #CLiente    
        FROM #consultaREC t1 WITH(NOLOCK)  
        CROSS APPLY t1.TramaXML.nodes('/Requerimiento') Req(data);
        
        PRINT '4. [Actualización] - Modificando datos de proveedor en #consultaREC...';
        PRINT '   Clientes extraídos: ' + CAST(@@ROWCOUNT AS VARCHAR);

        UPDATE #consultaREC 
        SET        
            Cedula_RUC = cli.RucEmisor,
            RazonSocial = RazonSocialEmisor         
        FROM #CLiente cli WITH(NOLOCK) 
        WHERE IdReq = IdRequerimiento;       
        
        PRINT '   Proveedores actualizados: ' + CAST(@@ROWCOUNT AS VARCHAR);

        PRINT '4.1 [Forma y Medio de Pago] - Extrayendo datos del XML...';

        UPDATE t1
        SET 
            t1.CodigoFormaPago = Pagos.CodigoFormaPago,
            t1.FormaPagoColombia = Pagos.FormaPagoColombia,
            t1.Plazo = Pagos.Plazo,
            t1.CodigoMedioPago = Medios.CodigoMedioPago,
            t1.MedioPagoColombia = Medios.MedioPagoColombia
        FROM #consultaREC t1
        OUTER APPLY (
            SELECT TOP 1 
                p.data.value('(CodigoFormaPago/text())[1]', 'varchar(50)') AS CodigoFormaPago,
                p.data.value('(FormaPagoColombia/text())[1]', 'varchar(100)') AS FormaPagoColombia,
                p.data.value('(Plazo/text())[1]', 'int') AS Plazo
            FROM t1.TramaXML.nodes('/Requerimiento/Pagos/Pago') p(data)
        ) Pagos
        OUTER APPLY (
            SELECT TOP 1 
                m.data.value('(CodigoMedioPago/text())[1]', 'varchar(50)') AS CodigoMedioPago,
                m.data.value('(MedioPagoColombia/text())[1]', 'varchar(100)') AS MedioPagoColombia
            FROM t1.TramaXML.nodes('/Requerimiento/MedioPagos/MedioPago') m(data)
        ) Medios;

        PRINT '   Formas y medios de pago extraídos: ' + CAST(@@ROWCOUNT AS VARCHAR);

        PRINT '5. [Impuestos XML] - Extrayendo impuestos de la trama XML...';

        IF (OBJECT_ID('tempdb.dbo.#TempImpuestosR','U')) IS NOT NULL 
            DROP TABLE #TempImpuestosR;

        SELECT 
            t1.IdReq AS IdRequerimiento,  
            imp.data.value('CodigoImpuesto[1]','varchar(5)') AS CodigoImpuesto,  
            ISNULL(Imp.data.value('CodigoPorcentaje[1]','varchar(5)'), Imp.data.value('Porcentaje[1]','varchar(5)')) AS CodigoPorcentaje,  
            Imp.data.value('Impuesto[1]','varchar(20)') AS Impuesto,  
            Imp.data.value('Porcentaje[1]','varchar(5)') AS Porcentaje,  
            Imp.data.value('BaseImponible[1]','varchar(30)') AS BaseImponible,  
            Imp.data.value('Valor[1]','varchar(30)') AS ValorImpuesto,
            Imp.data.value('UnidadMedida[1]','varchar(30)') AS UnidadMedida   
        INTO #TempImpuestosR         
        FROM #consultaREC t1 WITH(NOLOCK)     
        CROSS APPLY t1.TramaXML.nodes('/Requerimiento/Impuestos/Impuesto') Imp(data);

        CREATE INDEX ix_id_ia_1 ON #TempImpuestosR(IdRequerimiento);          
        CREATE INDEX ix_id_ia_2 ON #TempImpuestosR(CodigoImpuesto);          
        
        PRINT '   Impuestos extraídos: ' + CAST(@@ROWCOUNT AS VARCHAR);
            
        PRINT '6. [Cálculos Impuestos] - Procesando base y valores de impuestos...';

        UPDATE #consultaREC 
        SET BaseNoTax = BaseImponible        
        FROM #TempImpuestosR        
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '00'        
            AND ISNULL(BaseNoTax, 0) = 0;        
        
        UPDATE #consultaREC 
        SET 
            BaseIva = BaseImponible,
            IVA = ValorImpuesto        
        FROM #TempImpuestosR        
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '01' 
            AND CodigoPorcentaje IN ('01', '19', '5.00', '5', '19.00');       
        
        UPDATE #consultaREC 
        SET BaseExcento = BaseImponible        
        FROM #TempImpuestosR        
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '01'        
            AND ISNULL(valorImpuesto, '0') IN ('0', '0.0', '0.00');        
        
        UPDATE #consultaREC 
        SET BaseICA = BaseImponible        
        FROM #TempImpuestosR        
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '03';        
           
        UPDATE #consultaREC 
        SET 
            BaseINC = BaseImponible,
            INC = valorimpuesto        
        FROM #TempImpuestosR        
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '04';        
        
        UPDATE #consultaREC 
        SET 
            BaseIC = BaseImponible,
            IC = ValorImpuesto          
        FROM #TempImpuestosR          
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '02' 
            AND ISNULL(UnidadMedida, '') = '';

        UPDATE #consultaREC 
        SET IC = ValorImpuesto          
        FROM #TempImpuestosR          
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '02'; 
        
        UPDATE #consultaREC 
        SET 
            BaseICUI = BaseImponible,
            ICUI = valorimpuesto          
        FROM #TempImpuestosR          
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = 'ZZ'          
            AND CodigoPorcentaje = '35';          
        
        UPDATE #consultaREC 
        SET 
            BaseIBUA = BaseImponible,
            IBUA = valorimpuesto          
        FROM #TempImpuestosR          
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = 'ZZ'          
            AND CodigoPorcentaje = '34';          
        
        UPDATE #consultaREC 
        SET 
            BaseICL = BaseImponible,
            ICL = valorimpuesto          
        FROM #TempImpuestosR          
        WHERE IdRequerimiento = IdReq 
            AND CodigoImpuesto = '32'          
            AND CodigoPorcentaje = '200';          
          
        PRINT '7. [Totales] - Calculando y actualizando totales...';

        UPDATE #consultaREC 
        SET 
            TotalNeto = TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseNoTax, 0)) +         
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIC, 0)) +         
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICA, 0)) +         
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseINC, 0)) +         
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIva, 0)) +       
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIBUA, 0)) +       
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICL, 0)) +      
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICUI, 0)) +      
                        TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseExcento, 0)) +      
                        ISNULL(IVA, 0) +         
                        ISNULL(INC, 0) +        
                        ISNULL(ICA, 0) +      
                        ISNULL(IC, 0) +      
                        ISNULL(ICL, 0) +      
                        ISNULL(ICUI, 0) +      
                        ISNULL(IBUA, 0);      
           
        UPDATE #consultaREC 
        SET BaseNoTax = ISNULL(BaseNoTax, 0) + (TotalTemp - ISNULL(TotalNeto, 0))        
        WHERE ISNULL(TotalTemp, 0) > ISNULL(TotalNeto, 0);        
        
        UPDATE #consultaREC 
        SET 
            Subtotal = TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseNoTax, 0)) +         
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIC, 0)) +         
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICA, 0)) +         
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseINC, 0)) +         
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIva, 0)) +       
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseIBUA, 0)) +       
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICL, 0)) +      
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseICUI, 0)) +      
                       TRY_CONVERT(DECIMAL(18,2), ISNULL(BaseExcento, 0));         
           
        UPDATE #consultaREC 
        SET           
            TotalFactura = TRY_CONVERT(DECIMAL(18,2), ISNULL(Subtotal, 0)) +         
                           ISNULL(IVA, 0) +         
                           ISNULL(INC, 0) +        
                           ISNULL(ICA, 0) +      
                           ISNULL(IC, 0) +      
                           ISNULL(ICL, 0) +      
                           ISNULL(ICUI, 0) +      
                           ISNULL(IBUA, 0)       
        WHERE ISNULL(TotalFactura, 0) = 0;       

        PRINT '8. [Duplicados] - Eliminando duplicados autorizados...';

        SELECT 
            Documento AS DocumentoAux, 
            Fecha AS FechaAux,
            EstadomySatcom AS Estado 
        INTO #DuplicadosFull 
        FROM #consultaREC         
        WHERE EstadomySatcom = 'Autorizado' 
        GROUP BY Documento, Fecha, EstadomySatcom 
        HAVING COUNT(Documento) > 1;        
             
        WHILE EXISTS(SELECT 1 FROM #DuplicadosFull)        
        BEGIN        
            DECLARE @documento VARCHAR(50);        
            DECLARE @fecha DATETIME;        
                 
            SELECT TOP 1 
                @documento = DocumentoAux, 
                @fecha = FechaAux 
            FROM #DuplicadosFull;        
            
            DELETE TOP (1) #consultaREC 
            WHERE Documento = @documento AND Fecha = @fecha;        
            
            DELETE #DuplicadosFull 
            WHERE DocumentoAux = @documento AND FechaAux = @fecha;        
        END        

        PRINT '9. [Resultados] - Retornando la información final de compras...';

        SELECT        
            ROW_NUMBER() OVER(ORDER BY Fecha DESC) AS Num,        
            IdReq,        
            Cedula_RUC AS NIT,        
            RazonSocial,        
            Documento AS Secuencia,           
            Fecha AS FechaEmision,          
            TipoDocumento,        
            BaseNoTax,       
            BaseExcento,      
            BaseIVA,   
            BaseIC,
            BaseICA,
            BaseINC,      
            BaseICL,      
            BaseICUI,      
            BaseIBUA,      
            Subtotal,        
            DescuentoGlobal AS Descuento,        
            IVA,
            IC,
            ICA,
            INC,
            ICL,
            ICUI,
            IBUA,      
            RecargoGlobal,         
            TotalFactura AS Tota,        
            EstadomySatcom AS Estado,        
            CUFE,       
            EstadoDIAN,      
            FechaAutorizacion,      
            EstadoAprobacion,
            CodigoFormaPago,
            CodigoMedioPago,
            FormaPagoColombia,
            Plazo,
            MedioPagoColombia
        FROM #consultaREC          
        ORDER BY Num ASC;        
        
        -- Capturar filas procesadas
        SET @error_msg = 'rows:' + CAST(@@ROWCOUNT AS VARCHAR);

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        
        -- Formatear error para el log de auditoría
        SET @error_msg = 'rows:Error - ' + @ErrorMessage;

        -- ALERTA OBLIGATORIA A POSTGRES EN CASO DE ERROR (Dashboard de Monitoreo)
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process = @NombreSP,
            @message = @ErrorMessage;

        PRINT 'ERROR CRÍTICO EN ' + @NombreSP + ': ' + @ErrorMessage;
        THROW; 
    END CATCH

    -- Log de Auditoría Final
    SET @fin = GETDATE();
    
    -- Invocamos el log de consulta centralizado
    EXEC sat_comprobante.dbo.spco_crear_log_consulta 
        @i_lc_nombre_sp = @NombreSP,
        @i_lc_appname   = 'BATCH',
        @i_lc_emisor    = @i_IdEmisor,
        @i_lc_parametros = @params,
        @i_lc_origen    = 'BDD',
        @i_lc_inicio    = @inicio,
        @i_lc_fin       = @fin,
        @i_lc_error     = @error_msg;

    PRINT '--- FIN PROCESO: ' + @NombreSP + ' [Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio, @fin) AS VARCHAR) + 's] ---';

    -- Limpieza de tablas temporales
    IF (OBJECT_ID('tempdb.dbo.#consultaREC','U')) IS NOT NULL 
        DROP TABLE #consultaREC;
    IF (OBJECT_ID('tempdb.dbo.#CLiente','U')) IS NOT NULL 
        DROP TABLE #CLiente;
    IF (OBJECT_ID('tempdb.dbo.#TempImpuestosR','U')) IS NOT NULL 
        DROP TABLE #TempImpuestosR;
    IF (OBJECT_ID('tempdb.dbo.#DuplicadosFull','U')) IS NOT NULL 
        DROP TABLE #DuplicadosFull;

    RETURN 0;        
END
GO
