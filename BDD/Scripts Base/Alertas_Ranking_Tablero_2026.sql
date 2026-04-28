USE sat_logging;
GO

/* 
=========================================================================================
SP: Alertas de Inactividad Súbita
Propósito: Identificar emisores que usualmente tienen volumen pero no han emitido
           comprobantes autorizados en las últimas 24 horas.
=========================================================================================
*/
CREATE OR ALTER PROCEDURE consulta_tablero_alertas_inactividad_2026
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        ID_Emisor,
        Nemonico,
        Total_Autorizados_Global AS HistoricoTotal,
        Ultima_Fecha_Autorizacion AS UltimaVezAutorizado,
        DATEDIFF(HOUR, Ultima_Fecha_Autorizacion, GETDATE()) AS HorasInactivo,
        CASE 
            WHEN DATEDIFF(HOUR, Ultima_Fecha_Autorizacion, GETDATE()) > 48 THEN 'CRITICO'
            WHEN DATEDIFF(HOUR, Ultima_Fecha_Autorizacion, GETDATE()) > 24 THEN 'ALERTA'
            ELSE 'OK'
        END AS NivelAlerta
    FROM sat_logging..log_actividad_emisor
    WHERE Total_Autorizados_Global > 50 -- Filtro para ignorar emisores de prueba o muy bajo volumen
      AND Ultima_Fecha_Autorizacion < DATEADD(HOUR, -24, GETDATE())
    ORDER BY HorasInactivo DESC;
END;
GO

/* 
=========================================================================================
SP: Ranking de Errores por Punto de Emisión
Propósito: Identificar los puntos físicos (Establecimiento/Caja) con mayor incidencia
           de errores para mantenimiento preventivo.
=========================================================================================
*/
CREATE OR ALTER PROCEDURE consulta_tablero_ranking_errores_2026
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 20
        Nemonico,
        Establecimiento,
        Punto_Emision AS PuntoEmision,
        Total_Errores_Global AS TotalErrores,
        Ultima_Fecha_Error_Reciente AS FechaUltimoError,
        (CAST(Total_Errores_Global AS FLOAT) / NULLIF(Total_Autorizados_Global + Total_Errores_Global, 0)) * 100 AS PorcentajeError
    FROM sat_logging..log_actividad_emisor
    WHERE Total_Errores_Global > 0
    ORDER BY Total_Errores_Global DESC;
END;
GO
