USE [sat_comprobante]
GO
IF OBJECT_ID('[dbo].[spco_sop_mon_consultas_recurrentes]') IS NOT NULL
BEGIN
    DECLARE @NombreBK NVARCHAR(255) = 'spco_sop_mon_consultas_recurrentes_BK_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 106), ' ', '_');
    IF OBJECT_ID(@NombreBK) IS NULL 
    BEGIN
        EXEC sp_rename 'spco_sop_mon_consultas_recurrentes', @NombreBK;
        PRINT '>>> BACKUP GENERADO: ' + @NombreBK;
    END
    ELSE
    BEGIN
        PRINT '>>> BACKUP EXISTENTE: ' + @NombreBK + ' (Se omite nuevo respaldo)';
        DROP PROCEDURE [dbo].[spco_sop_mon_consultas_recurrentes];
    END
END
GO

CREATE PROCEDURE [dbo].[spco_sop_mon_consultas_recurrentes]
@Fecha DATE = NULL,
@Emisor INT = NULL,
@SP VARCHAR(MAX) = NULL,
@SP_NO VARCHAR(MAX) = NULL
AS
BEGIN
    -- Configuración de fecha por defecto
    IF (@Fecha IS NULL) SELECT @Fecha = GETDATE();

    -- Configuración de lista de exclusión por defecto
    DECLARE @ExclusionDefault VARCHAR(MAX) = 'spco_mon_sop_busca_faltante_secuencias,spct_consultar_documentos_emisor,spct_obtener_secuencial_documento,spct_consultar_emision_documento';
    
    -- Si @SP_NO es NULL, usamos la lista por defecto. Si es '*', la vaciamos para mostrar todo.
    IF (@SP_NO IS NULL) SET @SP_NO = @ExclusionDefault;
    IF (@SP_NO = '*') SET @SP_NO = '';

    -- Tablas temporales para filtros
    DECLARE @TblSP TABLE (NombreSP VARCHAR(100));
    DECLARE @TblSP_NO TABLE (NombreSP VARCHAR(100));

    -- Llenar tablas de filtros
    IF (@SP IS NOT NULL AND @SP <> '')
        INSERT INTO @TblSP SELECT value FROM STRING_SPLIT(@SP, ',');

    IF (@SP_NO IS NOT NULL AND @SP_NO <> '')
        INSERT INTO @TblSP_NO SELECT value FROM STRING_SPLIT(@SP_NO, ',');

    ---------------------------------------------------------
    -- 1. Resumen Agrupado de Consultas
    ---------------------------------------------------------
    SELECT 
        COUNT(1) AS NumConsultas,
        em_nombre,
        em_nemonico,
        em_pais,
        VUA.Ultima_Fecha_Autorizacion_Global AS [Ultima_Trx_Autorizada],       
        VUA.Ultima_Hora_Ingreso_Global AS [Hora_Ultima_Trx], -- Incluimos la hora solicitada
        VUA.Estatus_Global,
        lc_nombre_sp,
        lc_emisor,
        lc_parametros,
        lc_usuario
    FROM sat_logging.dbo.com_log_consultas_bdd WITH(NOLOCK)
    LEFT JOIN sat_catalogo.dbo.sc_emisor ON lc_emisor = em_id_emisor
    LEFT JOIN sat_logging.dbo.log_vista_ultima_actividad_emisor VUA ON VUA.ID_Emisor = lc_emisor
    WHERE CONVERT(DATE, lc_hora_registro) = @Fecha
        AND (@Emisor IS NULL OR lc_emisor = @Emisor)
        -- Filtro de Inclusión (si se envía @SP)
        AND (@SP IS NULL OR lc_nombre_sp IN (SELECT NombreSP FROM @TblSP) OR EXISTS (SELECT 1 FROM @TblSP WHERE lc_nombre_sp LIKE '%' + NombreSP + '%'))
        -- Filtro de Exclusión (siempre activo a menos que se envíe '*')
        AND (lc_nombre_sp NOT IN (SELECT NombreSP FROM @TblSP_NO))
    GROUP BY 
        em_nombre, em_nemonico, em_pais, VUA.Ultima_Fecha_Autorizacion_Global, VUA.Ultima_Hora_Ingreso_Global, VUA.Estatus_Global, lc_nombre_sp, lc_emisor, lc_parametros, lc_usuario
    HAVING COUNT(1) > 3
    ORDER BY NumConsultas DESC;

    ---------------------------------------------------------
    -- 2. Detalle de Tiempos de Ejecución
    ---------------------------------------------------------
    SELECT 
        DATEDIFF(MILLISECOND, lc_inicio, lc_fin) AS [Tiempo (ms)], 
        VUA.Ultima_Fecha_Autorizacion_Global AS [Ultima_Trx_Autorizada],
        VUA.Ultima_Hora_Ingreso_Global AS [Hora_Ultima_Trx],
        VUA.Estatus_Global,
        L.*
    FROM sat_logging.dbo.com_log_consultas_bdd L WITH(NOLOCK)
    LEFT JOIN sat_logging.dbo.log_vista_ultima_actividad_emisor VUA ON VUA.ID_Emisor = L.lc_emisor
    WHERE CONVERT(DATE, lc_hora_registro) = @Fecha
        AND (@Emisor IS NULL OR L.lc_emisor = @Emisor)
        AND (@SP IS NULL OR L.lc_nombre_sp IN (SELECT NombreSP FROM @TblSP) OR EXISTS (SELECT 1 FROM @TblSP WHERE L.lc_nombre_sp LIKE '%' + NombreSP + '%'))
        AND (L.lc_nombre_sp NOT IN (SELECT NombreSP FROM @TblSP_NO))
    ORDER BY lc_hora_registro DESC;

END

