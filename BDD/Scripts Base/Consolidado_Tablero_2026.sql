

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
