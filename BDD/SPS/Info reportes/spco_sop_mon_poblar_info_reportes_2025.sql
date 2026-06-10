USE [sat_comprobante]
GO

-- =============================================================================
-- BACKUP IDEMPOTENTE (deploy_sp_skill)
-- Preserva la primera versión del día. Si ya existe backup del día, solo DROP.
-- =============================================================================
IF OBJECT_ID('[dbo].[spco_sop_mon_poblar_info_reportes_2025]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spco_sop_mon_poblar_info_reportes_2025_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');

    IF OBJECT_ID(@NombreBK) IS NULL
    BEGIN
        EXEC sp_rename 'spco_sop_mon_poblar_info_reportes_2025', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spco_sop_mon_poblar_info_reportes_2025];
    END
END
GO

-- =============================================================================
-- CREACIÓN DEL PROCEDIMIENTO
-- =============================================================================
CREATE PROCEDURE [dbo].[spco_sop_mon_poblar_info_reportes_2025]
    @pais          INT          = NULL,
    @id_emisor     INT          = NULL,   -- Firma mantenida por compatibilidad
    @FechaProceso  DATE         = NULL,
    @BitBorrar     BIT          = 0,
    @IDs           VARCHAR(5000)= NULL    -- Lista de IDs separados por coma (modo reproceso puntual)
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    -- -------------------------------------------------------------------------
    -- VARIABLES DE TRAZABILIDAD (deploy_sp_skill)
    -- -------------------------------------------------------------------------
    DECLARE @inicio_proceso DATETIME    = GETDATE(),
            @sp_name        VARCHAR(200)= 'spco_sop_mon_poblar_info_reportes_2025',
            @params         NVARCHAR(MAX),
            @total_rows     INT         = 0,
            @error_msg      NVARCHAR(MAX),
            @modo_ids       BIT         = 0;   -- 1 = modo reproceso por IDs, 0 = modo normal

    -- LOG EJECUTIVO: cadena replicable
    SET @params =
        'EXEC [dbo].[' + @sp_name + '] ' +
        '@pais = '         + ISNULL(CAST(@pais         AS VARCHAR), 'NULL') + ', ' +
        '@FechaProceso = ' + ISNULL('''' + CAST(@FechaProceso AS VARCHAR) + '''', 'NULL') + ', ' +
        '@BitBorrar = '    + ISNULL(CAST(@BitBorrar     AS VARCHAR), 'NULL') + ', ' +
        '@IDs = '          + ISNULL('''' + @IDs + '''', 'NULL');

    PRINT '==========================================================================';
    PRINT '>>> INICIO: ' + @sp_name;
    PRINT '>>> Params: ' + @params;
    PRINT '>>> Hora  : ' + CONVERT(VARCHAR, @inicio_proceso, 120);
    PRINT '==========================================================================';

    -- -------------------------------------------------------------------------
    -- VALIDACIONES DE ENTRADA
    -- -------------------------------------------------------------------------

    -- Modo IDs: no se requiere @FechaProceso ni @pais
    IF @IDs IS NOT NULL AND LEN(LTRIM(RTRIM(@IDs))) > 0
    BEGIN
        SET @modo_ids = 1;
        PRINT '>>> MODO: Reproceso puntual por lista de IDs.';
    END
    ELSE
    BEGIN
        -- Modo normal: @FechaProceso es obligatoria
        IF @FechaProceso IS NULL
        BEGIN
            PRINT '>>> ERROR: La fecha de proceso es obligatoria en modo normal.';
            RETURN;
        END
        PRINT '>>> MODO: Proceso diario normal. Fecha: ' + CAST(@FechaProceso AS VARCHAR);
    END

    -- =========================================================================
    BEGIN TRY

        DECLARE @inicio    DATETIME = GETDATE(),
                @LoteSize  INT      = 2000,
                @Contador  INT      = 1,
                @mes_emi   INT      = ISNULL(MONTH(@FechaProceso), 0),
                @FechaDesde DATETIME= CAST(@FechaProceso AS DATETIME),
                @FechaHasta DATETIME= DATEADD(DAY, 1, CAST(@FechaProceso AS DATETIME));

        -- Tabla temporal principal de comprobantes a procesar
        CREATE TABLE #t_ComprobantesAll (
            IdComprobante BIGINT PRIMARY KEY,
            au_pais       INT,
            au_tipo       INT
        );

        -- =====================================================================
        -- BLOQUE A: MODO IDs — Carga desde lista de IDs recibida
        -- =====================================================================
        IF @modo_ids = 1
        BEGIN
            PRINT '--- [PASO A] Parseando lista de IDs recibida ---';

            -- Tabla temporal para los IDs del parámetro
            CREATE TABLE #t_IDsEntrada (
                IdComprobante BIGINT
            );

            -- Parseo de la cadena separada por comas usando STRING_SPLIT
            INSERT INTO #t_IDsEntrada (IdComprobante)
            SELECT CAST(LTRIM(RTRIM(value)) AS BIGINT)
            FROM STRING_SPLIT(@IDs, ',')
            WHERE LTRIM(RTRIM(value)) <> '';

            DECLARE @cant_ids INT = @@ROWCOUNT;
            PRINT '    IDs recibidos y parseados: ' + CAST(@cant_ids AS VARCHAR);

            -- -----------------------------------------------------------------
            -- IDENTIFICAR EL PAÍS DE LOS IDs RECIBIDOS
            -- Regla: todos los comprobantes deben pertenecer al mismo país
            -- -----------------------------------------------------------------
            PRINT '--- [PASO A.1] Identificando país de los comprobantes recibidos ---';

            DECLARE @paises_encontrados INT,
                    @pais_detectado     INT;

            SELECT @paises_encontrados = COUNT(DISTINCT co_pais),
                   @pais_detectado     = MAX(co_pais)          -- MAX solo para capturar el valor si es único
            FROM sat_comprobante.dbo.com_log_comprobante_xml WITH (NOLOCK)
            WHERE co_id_comprobante IN (SELECT IdComprobante FROM #t_IDsEntrada);

            PRINT '    Países distintos encontrados: ' + CAST(ISNULL(@paises_encontrados, 0) AS VARCHAR);

            -- Validación: deben ser del mismo país
            IF @paises_encontrados > 1
            BEGIN
                PRINT '>>> ADVERTENCIA: Todos los comprobantes deben ser del mismo país.';
                RAISERROR('Todos los comprobantes deben ser del mismo país.', 16, 1);
                RETURN;
            END

            IF @paises_encontrados = 0
            BEGIN
                PRINT '>>> ADVERTENCIA: No se encontraron comprobantes en com_log_comprobante_xml para los IDs proporcionados.';
                RETURN;
            END

            -- Si @pais vino como parámetro, validar consistencia
            IF @pais IS NOT NULL AND @pais <> @pais_detectado
            BEGIN
                PRINT '>>> ADVERTENCIA: El @pais informado (' + CAST(@pais AS VARCHAR) + ') difiere del país detectado (' + CAST(@pais_detectado AS VARCHAR) + '). Se usará el país detectado.';
            END

            -- El país queda definido por los IDs
            SET @pais    = @pais_detectado;
            SET @mes_emi = NULL; -- No aplica filtro de mes en modo IDs

            PRINT '    País detectado y asignado: ' + CAST(@pais AS VARCHAR);

            -- -----------------------------------------------------------------
            -- CARGAR LOS COMPROBANTES DE LOS IDs EN LA TABLA TEMPORAL
            -- -----------------------------------------------------------------
            PRINT '--- [PASO A.2] Cargando comprobantes de los IDs en #t_ComprobantesAll ---';

            INSERT INTO #t_ComprobantesAll (
                IdComprobante,
                au_pais,
                au_tipo
            )
            SELECT DISTINCT
                a.co_id_comprobante,
                a.co_pais,
                ISNULL(a.co_codigo_tipo_documento, a.co_tipo_comprobante)
            FROM sat_comprobante.dbo.com_log_comprobante_xml a WITH (NOLOCK)
            INNER JOIN #t_IDsEntrada ids ON a.co_id_comprobante = ids.IdComprobante
            WHERE a.co_pais = @pais;

            SET @total_rows = @@ROWCOUNT;
            PRINT dbo.fn_get_text_dif(@inicio, @total_rows, 'Carga modo IDs completada');

            -- IDs no encontrados (trazabilidad)
            DECLARE @ids_no_encontrados INT;
            SELECT @ids_no_encontrados = COUNT(*)
            FROM #t_IDsEntrada e
            WHERE NOT EXISTS (
                SELECT 1 FROM #t_ComprobantesAll c WHERE c.IdComprobante = e.IdComprobante
            );
            IF @ids_no_encontrados > 0
                PRINT '    AVISO: ' + CAST(@ids_no_encontrados AS VARCHAR) + ' IDs no encontrados en com_log_comprobante_xml.';

            DROP TABLE #t_IDsEntrada;
        END

        -- =====================================================================
        -- BLOQUE B: MODO NORMAL — Identificación por fecha (lógica original)
        -- =====================================================================
        ELSE
        BEGIN
            PRINT '--- [PASO B] Identificación de comprobantes por fecha (modo normal) ---';
            PRINT '    Fecha   : ' + CAST(@FechaProceso AS VARCHAR);
            PRINT '    Mes_emi : ' + CAST(@mes_emi AS VARCHAR);
            PRINT '    Ventana : ' + CONVERT(VARCHAR, @FechaDesde, 120) + ' -> ' + CONVERT(VARCHAR, @FechaHasta, 120);

            -- -----------------------------------------------------------------
            -- COLOMBIA (57)
            -- -----------------------------------------------------------------
            IF (@pais = 57 OR @pais IS NULL)
            BEGIN
                INSERT INTO #t_ComprobantesAll (
                    IdComprobante,
                    au_pais,
                    au_tipo
                )
                SELECT DISTINCT
                    a.co_id_comprobante,
                    a.co_pais,
                    a.co_codigo_tipo_documento
                FROM com_log_comprobante_xml a WITH (NOLOCK)
                LEFT JOIN com_aux_resumen_CO b WITH (NOLOCK)
                    ON a.co_id_comprobante = b.Id
                LEFT JOIN com_informacion_impuestos c WITH (NOLOCK)
                    ON a.co_id_comprobante = c.im_id_comprobante
                WHERE a.co_pais = 57
                  AND a.co_mes_emi = @mes_emi
                  AND a.co_fecha_in >= @FechaDesde
                  AND a.co_fecha_in <  @FechaHasta
                  AND a.co_estatus IN (SELECT codigo FROM sat_catalogo..sc_vista_estados_autorizados)
                  AND (b.Id IS NULL OR c.im_id_comprobante IS NULL);

                PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Consulta COLOMBIA Día ', @FechaProceso));
                SET @total_rows += @@ROWCOUNT;
            END

            -- -----------------------------------------------------------------
            -- ECUADOR (593)
            -- -----------------------------------------------------------------
            IF (@pais = 593 OR @pais IS NULL)
            BEGIN
                INSERT INTO #t_ComprobantesAll (
                    IdComprobante,
                    au_pais,
                    au_tipo
                )
                SELECT DISTINCT
                    a.co_id_comprobante,
                    a.co_pais,
                    a.co_tipo_comprobante
                FROM com_log_comprobante_xml a WITH (NOLOCK)
                LEFT JOIN com_aux_reportes_SRI b WITH (NOLOCK)
                    ON a.co_id_comprobante = b.Id
                WHERE a.co_pais = 593
                  AND a.co_mes_emi = @mes_emi
                  AND a.co_fecha_in >= @FechaDesde
                  AND a.co_fecha_in <  @FechaHasta
                  AND a.co_estatus IN (SELECT codigo FROM sat_catalogo..sc_vista_estados_autorizados)
                  AND b.Id IS NULL;

                PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Consulta ECUADOR Día ', @FechaProceso));
                SET @total_rows += @@ROWCOUNT;
            END

            -- -----------------------------------------------------------------
            -- COSTA RICA (506)
            -- -----------------------------------------------------------------
            IF (@pais = 506 OR @pais IS NULL)
            BEGIN
                INSERT INTO #t_ComprobantesAll (
                    IdComprobante,
                    au_pais,
                    au_tipo
                )
                SELECT DISTINCT
                    a.co_id_comprobante,
                    a.co_pais,
                    a.co_tipo_comprobante
                FROM com_log_comprobante_xml a WITH (NOLOCK)
                LEFT JOIN com_aux_resumen_CR b WITH (NOLOCK)
                    ON a.co_id_comprobante = b.Id
                WHERE a.co_pais = 506
                  AND a.co_mes_emi = @mes_emi
                  AND a.co_fecha_in >= @FechaDesde
                  AND a.co_fecha_in <  @FechaHasta
                  AND a.co_estatus IN (SELECT codigo FROM sat_catalogo..sc_vista_estados_autorizados)
                  AND b.Id IS NULL;

                PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Consulta CR Día ', @FechaProceso));
                SET @total_rows += @@ROWCOUNT;
            END

            -- -----------------------------------------------------------------
            -- PANAMÁ (507)
            -- -----------------------------------------------------------------
            IF (@pais = 507 OR @pais IS NULL)
            BEGIN
                INSERT INTO #t_ComprobantesAll (
                    IdComprobante,
                    au_pais,
                    au_tipo
                )
                SELECT DISTINCT
                    a.co_id_comprobante,
                    a.co_pais,
                    a.co_tipo_comprobante
                FROM com_log_comprobante_xml a WITH (NOLOCK)
                LEFT JOIN com_aux_reportes_PA b WITH (NOLOCK)
                    ON a.co_id_comprobante = b.Id
                WHERE a.co_pais = 507
                  AND a.co_mes_emi = @mes_emi
                  AND a.co_fecha_in >= @FechaDesde
                  AND a.co_fecha_in <  @FechaHasta
                  AND a.co_estatus IN (SELECT codigo FROM sat_catalogo..sc_vista_estados_autorizados)
                  AND b.Id IS NULL;

                PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Consulta PA Día ', @FechaProceso));
                SET @total_rows += @@ROWCOUNT;
            END

            -- -----------------------------------------------------------------
            -- HONDURAS (504)
            -- -----------------------------------------------------------------
            IF (@pais = 504 OR @pais IS NULL)
            BEGIN
                INSERT INTO #t_ComprobantesAll (
                    IdComprobante,
                    au_pais,
                    au_tipo
                )
                SELECT DISTINCT
                    a.co_id_comprobante,
                    a.co_pais,
                    a.co_codigo_tipo_documento
                FROM com_log_comprobante_xml a WITH (NOLOCK)
                LEFT JOIN com_aux_reportes_HN b WITH (NOLOCK)
                    ON a.co_id_comprobante = b.Id
                WHERE a.co_pais = 504
                  AND a.co_mes_emi = @mes_emi
                  AND a.co_fecha_in >= @FechaDesde
                  AND a.co_fecha_in <  @FechaHasta
                  AND a.co_estatus NOT IN (14)
                  AND b.Id IS NULL;

                PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Consulta Honduras ', @FechaProceso));
                SET @total_rows += @@ROWCOUNT;
            END

        END -- FIN BLOQUE B

        -- =====================================================================
        -- PASO COMÚN: RESUMEN DE CARGA
        -- =====================================================================
        DECLARE @total_en_temp INT;
        SELECT @total_en_temp = COUNT(*) FROM #t_ComprobantesAll;
        PRINT '--- [RESUMEN CARGA] Total comprobantes en #t_ComprobantesAll: ' + CAST(@total_en_temp AS VARCHAR) + ' ---';

        IF @total_en_temp = 0
        BEGIN
            PRINT '>>> INFO: No hay comprobantes pendientes para procesar. Se finaliza sin ejecutar bucle.';
            SET @error_msg = 'rows:0';
            GOTO fin_proceso;
        END

        -- =====================================================================
        -- BUCLE DE PROCESAMIENTO POR LOTES
        -- =====================================================================
        PRINT '--- [PASO C] Iniciando bucle de procesamiento (LoteSize=' + CAST(@LoteSize AS VARCHAR) + ') ---';

        WHILE EXISTS (SELECT 1 FROM #t_ComprobantesAll)
        BEGIN
            SET @inicio = GETDATE();
            TRUNCATE TABLE com_comprobante_aux;

            PRINT '    -- Lote #' + CAST(@Contador AS VARCHAR) + ' - Inicio carga com_comprobante_aux ---';

            -- En modo IDs, el JOIN usa la PK directa sin filtro de mes_emi
            IF @modo_ids = 1
            BEGIN
                INSERT INTO com_comprobante_aux (
                    co_id_comprobante,
                    co_codigo_tipo_documento,
                    co_trama_dto,
                    co_id_emisor,
                    co_pais,
                    co_fecha_emision,
                    Info,
                    co_es_nota_credito,
                    co_num_comprobante,
                    co_clave_acceso,
                    co_num_autorizacion,
                    co_total_comprobante
                )
                SELECT TOP (@LoteSize)
                    com.co_id_comprobante,
                    com.co_codigo_tipo_documento,
                    com.co_trama_dto,
                    com.co_id_emisor,
                    com.co_pais,
                    com.co_fecha_emision,
                    CONCAT('Poblado IDs Bucle:', @Contador),
                    CASE
                        WHEN doc.Documento LIKE '%CREDITO%'
                          OR doc.Documento LIKE '%DEBITO%'
                          OR doc.Documento LIKE 'Recibo elect%'
                        THEN 1 ELSE 0
                    END,
                    com.co_num_comprobante,
                    com.co_clave_acceso,
                    com.co_num_autorizacion,
                    com.co_total_comprobante
                FROM #t_ComprobantesAll aux
                INNER JOIN com_log_comprobante_xml com WITH (NOLOCK)
                    ON com.co_id_comprobante = aux.IdComprobante
                LEFT JOIN sat_catalogo.dbo.sc_vista_tipo_documetos doc WITH (NOLOCK)
                    ON com.co_codigo_tipo_documento = doc.CodigoNegocio
                   AND com.co_pais                 = doc.Pais;
            END
            ELSE
            BEGIN
                INSERT INTO com_comprobante_aux (
                    co_id_comprobante,
                    co_codigo_tipo_documento,
                    co_trama_dto,
                    co_id_emisor,
                    co_pais,
                    co_fecha_emision,
                    Info,
                    co_es_nota_credito,
                    co_num_comprobante,
                    co_clave_acceso,
                    co_num_autorizacion,
                    co_total_comprobante
                )
                SELECT TOP (@LoteSize)
                    com.co_id_comprobante,
                    com.co_codigo_tipo_documento,
                    com.co_trama_dto,
                    com.co_id_emisor,
                    com.co_pais,
                    com.co_fecha_emision,
                    CONCAT('Poblado ', @FechaProceso, ' Bucle:', @Contador),
                    CASE
                        WHEN doc.Documento LIKE '%CREDITO%'
                          OR doc.Documento LIKE '%DEBITO%'
                          OR doc.Documento LIKE 'Recibo elect%'
                        THEN 1 ELSE 0
                    END,
                    com.co_num_comprobante,
                    com.co_clave_acceso,
                    com.co_num_autorizacion,
                    com.co_total_comprobante
                FROM #t_ComprobantesAll aux
                INNER JOIN com_log_comprobante_xml com WITH (NOLOCK)
                    ON com.co_id_comprobante = aux.IdComprobante
                   AND com.co_mes_emi        = @mes_emi
                LEFT JOIN sat_catalogo.dbo.sc_vista_tipo_documetos doc WITH (NOLOCK)
                    ON com.co_codigo_tipo_documento = doc.CodigoNegocio
                   AND com.co_pais                 = doc.Pais;
            END

            IF NOT EXISTS (SELECT 1 FROM com_comprobante_aux)
            BEGIN
                PRINT '    AVISO: com_comprobante_aux vacío en lote #' + CAST(@Contador AS VARCHAR) + '. Se detiene bucle.';
                BREAK;
            END

            PRINT dbo.fn_get_text_dif(@inicio, @@ROWCOUNT, CONCAT('Lote #', @Contador, ' - Cargado com_comprobante_aux'));

            -- Sub-procesos
            EXEC [spco_sop_mon_poblar_info_clientes_2025] @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') DatosCliente'));

            EXEC [spco_sop_mon_poblar_impuestos_todos_2025] @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Impuestos'));

            EXEC spco_sop_mon_poblar_fpagos_todos_2025 @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Formas de pago'));

            EXEC spco_sop_mon_poblar_info_adicional_todos_2025 @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Info Adicional'));

            EXEC spco_sop_mon_poblar_documento_asociado_todos_2025 @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Doc Asociado'));

            EXEC spco_sop_poblar_retenciones_aux_2025 @BitBorrar;
            PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Retenciones'));

            -- Sub-procesos por país
            IF (@pais IS NULL OR @pais = 57)
            BEGIN
                EXEC spco_sop_poblar_tabla_aux_col2025 @BitBorrar;
                PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Tabla Aux COL'));
            END
            IF (@pais IS NULL OR @pais = 593)
            BEGIN
                EXEC [spco_sop_poblar_tabla_aux_ec2025] @BitBorrar;
                PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Tabla Aux EC'));
            END
            IF (@pais IS NULL OR @pais = 506)
            BEGIN
                EXEC [spco_sop_poblar_tabla_aux_cr2025] @BitBorrar;
                PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Tabla Aux CR'));
            END
            IF (@pais IS NULL OR @pais = 507)
            BEGIN
                EXEC [spco_sop_poblar_tabla_aux_pa2025] @BitBorrar;
                PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Tabla Aux PA'));
            END
            IF (@pais IS NULL OR @pais = 504)
            BEGIN
                EXEC [spco_sop_poblar_tabla_aux_hn2025] @BitBorrar;
                PRINT dbo.fn_get_text_dif(@inicio, 0, CONCAT('#', @Contador, ') Tabla Aux HN'));
            END

            -- Eliminar procesados
            DELETE T1
            FROM #t_ComprobantesAll AS T1
            INNER JOIN com_comprobante_aux AS T2
                ON T1.IdComprobante = T2.co_id_comprobante;

            DECLARE @eliminados INT = @@ROWCOUNT;
            PRINT dbo.fn_get_text_dif(@inicio, @eliminados, CONCAT('Lote #', @Contador, ' - Comprobantes eliminados de temp'));

            SET @Contador = @Contador + 1;
        END -- FIN WHILE

        SET @error_msg = 'rows:' + CAST(@total_rows AS VARCHAR);

    END TRY
    BEGIN CATCH
        SET @error_msg = 'rows:Error - ' + ERROR_MESSAGE();
        PRINT '>>> ERROR CRITICO: ' + @error_msg;
        EXEC [master].[dbo].[spct_insertar_alerta_postgres]
            @severity = 'Error',
            @process  = @sp_name,
            @country  = @pais,
            @message  = @error_msg;
        RAISERROR(@error_msg, 16, 1);
    END CATCH

    -- =========================================================================
    -- LOG DE AUDITORÍA FINAL (deploy_sp_skill — evitar GETDATE() inline en EXEC)
    -- =========================================================================
    fin_proceso:
    DECLARE @fin_proceso DATETIME = GETDATE();

    EXEC [dbo].[spco_crear_log_consulta]
        @i_lc_nombre_sp  = @sp_name,
        @i_lc_emisor     = @id_emisor,
        @i_lc_parametros = @params,
        @i_lc_origen     = 'BDD',
        @i_lc_inicio     = @inicio_proceso,
        @i_lc_fin        = @fin_proceso,
        @i_lc_error      = @error_msg;

    PRINT '==========================================================================';
    PRINT '>>> FIN PROCESO: ' + @sp_name;
    PRINT '>>> Resultado  : ' + ISNULL(@error_msg, 'N/A');
    PRINT '>>> Tiempo Total: ' + CAST(DATEDIFF(SECOND, @inicio_proceso, @fin_proceso) AS VARCHAR) + 's';
    PRINT '==========================================================================';
END;
GO
