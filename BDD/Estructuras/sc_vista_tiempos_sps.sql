USE [sat_logging]
GO

IF OBJECT_ID('[dbo].[sc_vista_tiempos_sps]') IS NOT NULL
BEGIN
    DROP VIEW [dbo].[sc_vista_tiempos_sps];
    PRINT '>>> VISTA [sc_vista_tiempos_sps] ELIMINADA PARA ACTUALIZACIÓN.';
END
GO

/****** Objeto:  View [dbo].[sc_vista_tiempos_sps]    Fecha: 21/05/2026 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

-- =========================================================================================
-- Vista: [dbo].[sc_vista_tiempos_sps]
-- Propósito: Analizar el consumo de tiempo de los Procedimientos Almacenados (SPs) y sus
--            parámetros en los últimos 2 días de ejecución.
--            Agrupa y totaliza métricas clave de rendimiento por SP, parámetros y emisor.
-- =========================================================================================
create VIEW [dbo].[sc_vista_tiempos_sps] AS
SELECT 
    L.lc_nombre_sp AS [StoredProcedure],    
    L.lc_emisor AS [IdEmisor],
    VUA.Nemonico AS [Nemonico],
    VUA.Pais_ID AS [PaisId],
    COUNT(1) AS [TotalEjecuciones],
    SUM(DATEDIFF(MILLISECOND, L.lc_inicio, L.lc_fin)) AS [TiempoTotal_ms],
    AVG(DATEDIFF(MILLISECOND, L.lc_inicio, L.lc_fin)) AS [TiempoPromedio_ms],
    MAX(DATEDIFF(MILLISECOND, L.lc_inicio, L.lc_fin)) AS [TiempoMaximo_ms],
    MIN(DATEDIFF(MILLISECOND, L.lc_inicio, L.lc_fin)) AS [TiempoMinimo_ms],
    SUM(CASE WHEN L.lc_origen =  'Bloqueado' THEN 1 ELSE 0 END) AS [TotalBloqueos],  --[TotalErrores]
    MAX(VUA.Ultima_Fecha_Autorizacion_Global) AS [UltimaTrxAutorizada],
    MAX(VUA.Ultima_Hora_Ingreso_Global) AS [HoraUltimaTrx]
FROM sat_logging.dbo.com_log_consultas_bdd L WITH(NOLOCK)
LEFT OUTER JOIN sat_logging.dbo.log_vista_ultima_actividad_emisor VUA ON VUA.ID_Emisor = L.lc_emisor
WHERE L.lc_hora_registro >= DATEADD(DAY, -3, GETDATE())
GROUP BY 
    L.lc_nombre_sp,     
    L.lc_emisor,
    VUA.Nemonico,
    VUA.Pais_ID;


