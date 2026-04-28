
SELECT 
    BDD as 'BDD BK',
	SUM(BK.ok) AS Total_OK, 
    SUM(BK.Error) AS Total_Error, 
    SUM(BK.Importados) AS Total_Importados, 
    BK.IdEmisor, 
    EM.em_nemonico, 
    EM.em_pais,	
    -- Dato integrado de la nueva vista
    VUA.Ultima_Fecha_Autorizacion_Global AS Ultima_Autorizacion_Global,
    VUA.Estatus_Global
FROM sat_logging.dbo.log_resumen_licencias_bk_hitorico BK
INNER JOIN sat_catalogo..sc_emisor EM ON EM.em_id_emisor = BK.IdEmisor
LEFT JOIN sat_logging..log_vista_ultima_actividad_emisor VUA ON VUA.ID_Emisor = BK.IdEmisor
WHERE BK.FechaBK = '2026-04-28 08:15:11.257'
  AND BK.IdEmisor IN (1758)
GROUP BY 
    BK.IdEmisor, 
    EM.em_nemonico, 	BDD,
    EM.em_pais, 
    VUA.Ultima_Fecha_Autorizacion_Global,
    VUA.Estatus_Global
ORDER BY IdEmisor, BDD DESC;




/* 
=========================================================================================
SCRIPT 2: Consolidado Total (Licencias Actuales + Históricas)
Propósito: Sumarizar toda la actividad histórica y actual de los emisores seleccionados,
           integrando la fecha de última autorización de la nueva vista.
=========================================================================================
*/

WITH ActividadConsolidada AS (
    -- Fuente 1: Licencias Actuales (sat_comprobante)
    SELECT 
        IdEmisor, ok, Error, Importados, 'sat_comprobante' as BDD
    FROM sat_logging.dbo.log_resumen_licencias WITH(NOLOCK)
    WHERE IdEmisor IN (1758)

    UNION ALL

    -- Fuente 2: Licencias Históricas (Base Histórica)
    SELECT 
        IdEmisor, ok, Error, Importados, BDD
    FROM sat_logging.dbo.log_resumen_licencias_his WITH(NOLOCK)
    WHERE IdEmisor IN (1758)
	
)
SELECT 
	BDD,
    SUM(ACT.ok) AS Total_OK_Global, 
    SUM(ACT.Error) AS Total_Error_Global, 
    SUM(ACT.Importados) AS Total_Importados_Global, 
    ACT.IdEmisor, 
    EM.em_nemonico, 
    EM.em_pais,
    -- Integración con la nueva vista de actividad
    VUA.Ultima_Fecha_Autorizacion_Global AS Ultima_Autorizacion_Reportada,
    VUA.Estatus_Global
FROM ActividadConsolidada ACT
INNER JOIN sat_catalogo..sc_emisor EM ON EM.em_id_emisor = ACT.IdEmisor
LEFT JOIN sat_logging..log_vista_ultima_actividad_emisor VUA ON VUA.ID_Emisor = ACT.IdEmisor
GROUP BY 
	BDD,
    ACT.IdEmisor, 
    EM.em_nemonico, 
    EM.em_pais, 
    VUA.Ultima_Fecha_Autorizacion_Global,
    VUA.Estatus_Global
ORDER BY IdEmisor, BDD DESC;
