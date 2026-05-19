USE sat_logging;
GO

/* 
=========================================================================================
SCRIPT: Consolidado de Actividad para Satcom Analytics
Propósito: Definición del SP de consulta enriquecida y KPIs para el dashboard.
=========================================================================================
*/


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