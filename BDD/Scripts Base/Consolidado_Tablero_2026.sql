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
        E.IdEmisor AS ID_Emisor,
        E.Nemonico,
        E.Identificacion,
        E.RazonSocial,
        E.IdPais AS Pais_ID,
        E.NombrePais,
        ISNULL(A.Establecimiento, '001') AS Establecimiento,
        ISNULL(A.Punto_Emision, '---') AS PuntoEmision,
        ISNULL(A.Estado_Reporte, 'SIN ACTIVIDAD') AS EstadoReporte,
        ISNULL(A.Total_Autorizados_Global, 0) AS TotalAutorizados,
        ISNULL(A.Total_Errores_Global, 0) AS TotalErrores,
        A.Ultima_Fecha_Autorizacion AS UltimaFechaAutorizacion,
        A.Hora_Ultimo_Ingreso_Reciente AS UltimaHoraIngreso,
        A.Ultima_Fecha_Error_Reciente AS UltimaFechaError,
        A.Hora_Ultimo_Error_Reciente AS UltimaHoraError,
        A.CodigoTipoDocumento,
        A.Fecha_Proceso AS FechaSincronizacion
    FROM (
        SELECT 
            EM.em_id_emisor AS IdEmisor,
            EM.em_nemonico AS Nemonico,
            EM.em_identificacion_principal AS Identificacion,
            EM.em_razon_social AS RazonSocial,
            EM.em_pais AS IdPais,
            P.pa_nombre AS NombrePais
        FROM sat_catalogo..sc_emisor EM
        LEFT JOIN sat_catalogo..sc_pais P ON P.pa_id_pais = EM.em_pais
        WHERE EM.em_estado = 'ACTIVO'
    ) E
    LEFT JOIN sat_logging..log_actividad_emisor A ON A.ID_Emisor = E.IdEmisor
    ORDER BY E.Nemonico ASC, A.Establecimiento ASC;
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
