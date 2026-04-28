USE sat_logging;
GO

/* 
=========================================================================================
SCRIPT: Consolidado de Actividad para Satcom Analytics
Propósito: Definición del SP de consulta enriquecida y KPIs para el dashboard.
=========================================================================================
*/

-- 1. Actualización de la estructura física para incluir el código del documento
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('log_actividad_emisor') AND name = 'CodigoTipoDocumento')
BEGIN
    ALTER TABLE log_actividad_emisor ADD CodigoTipoDocumento VARCHAR(10);
END
GO

-- 2. Procedimiento Almacenado Enriquecido
CREATE OR ALTER PROCEDURE consulta_tablero_actividad_emisor_2026
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        A.ID_Emisor,
        E.Nemonico,
        E.Identificacion,
        E.RazonSocial,
        E.CodigoPais AS Pais_ID,
        A.Establecimiento,
        A.Punto_Emision AS PuntoEmision,
        A.Estado_Reporte AS EstadoReporte,
        A.Total_Autorizados_Global AS TotalAutorizados,
        A.Total_Errores_Global AS TotalErrores,
        A.Ultima_Fecha_Autorizacion AS UltimaFechaAutorizacion,
        A.Hora_Ultimo_Ingreso_Reciente AS UltimaHoraIngreso,
        A.Ultima_Fecha_Error_Reciente AS UltimaFechaError,
        A.Hora_Ultimo_Error_Reciente AS UltimaHoraError,
        A.CodigoTipoDocumento,
        A.Fecha_Proceso AS FechaSincronizacion
    FROM sat_logging..log_actividad_emisor A
    LEFT JOIN sat_catalogo..sc_emisor EM ON EM.em_id_emisor = A.ID_Emisor
    -- Cruce con el SP de emisores (usando la lógica de la vista interna)
    OUTER APPLY (
        SELECT 
            em_nemonico AS Nemonico,
            em_identificacion_principal AS Identificacion,
            em_razon_social AS RazonSocial,
            em_pais AS CodigoPais
        FROM sat_catalogo..sc_emisor 
        WHERE em_id_emisor = A.ID_Emisor
    ) E
    ORDER BY A.Fecha_Proceso DESC, A.ID_Emisor;
END;
GO

-- 3. Queries para Indicadores Clave (KPIs)

/* 
KPI: Emisores con Autorizaciones por Periodo
Nota: Se asume que Fecha_Proceso o Ultima_Fecha_Autorizacion determinan el periodo.
*/

-- Ayer
SELECT COUNT(DISTINCT ID_Emisor) AS Emisores_Activos_Ayer
FROM sat_logging..log_actividad_emisor
WHERE CAST(Ultima_Fecha_Autorizacion AS DATE) = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
  AND Total_Autorizados_Global > 0;

-- Esta Semana
SELECT COUNT(DISTINCT ID_Emisor) AS Emisores_Activos_Semana
FROM sat_logging..log_actividad_emisor
WHERE Ultima_Fecha_Autorizacion >= DATEADD(DAY, -7, GETDATE())
  AND Total_Autorizados_Global > 0;

-- Este Mes
SELECT COUNT(DISTINCT ID_Emisor) AS Emisores_Activos_Mes
FROM sat_logging..log_actividad_emisor
WHERE MONTH(Ultima_Fecha_Autorizacion) = MONTH(GETDATE()) 
  AND YEAR(Ultima_Fecha_Autorizacion) = YEAR(GETDATE())
  AND Total_Autorizados_Global > 0;

-- Global
SELECT COUNT(DISTINCT ID_Emisor) AS Emisores_Activos_Global
FROM sat_logging..log_actividad_emisor
WHERE Total_Autorizados_Global > 0;

/* 
KPI: Línea de Tiempo de Comprobantes (Agrupado por Día)
*/
SELECT 
    CAST(Ultima_Fecha_Autorizacion AS DATE) AS Fecha,
    SUM(Total_Autorizados_Global) AS Total_Autorizados,
    SUM(Total_Errores_Global) AS Total_Errores
FROM sat_logging..log_actividad_emisor
WHERE Ultima_Fecha_Autorizacion IS NOT NULL
GROUP BY CAST(Ultima_Fecha_Autorizacion AS DATE)
ORDER BY Fecha DESC;
