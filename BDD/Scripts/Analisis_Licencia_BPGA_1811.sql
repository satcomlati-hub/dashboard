/*
================================================================================================
SCRIPT DE ANÁLISIS Y COMPARACIÓN DE LICENCIAS vs LOGS (EMISOR 1811 - BPGA)
================================================================================================
Propósito: Comparar el contador maestro de 'sc_licencia' con el detalle de 'log_resumen_licencias' 
           (Actual + Histórico) para validar el proceso de depuración (sinceramiento).
Fecha: 2026-05-07
Autor: Antigravity
================================================================================================
*/
--METI: 317 (383 Real)
--AVFR: 1377 (1200 REAL)

DECLARE @nemonico varchar(10) = 'AVFR';
DECLARE @IdEmisor INT ; -- ID del Emisor BPGA


select @IdEmisor = em_id_emisor 
from sat_catalogo..sc_emisor where em_nemonico = @nemonico

-- 1. CONSULTA DE ESTADO EN MAESTRO DE LICENCIAS
SELECT 
    lc_id_emisor AS IdEmisor,
    'BPGA' AS Nemonico,
    lc_max_comprobantes,
	lc_comprobantes_procesados,
	lc_fecha_creacion
FROM sat_catalogo..sc_licencia inner join sat_catalogo..sc_emisor on em_id_emisor = lc_id_emisor
WHERE em_nemonico = @nemonico; 

select lc_max_comprobantes, lc_comprobantes_procesados , *
from sat_catalogo..sc_licencia_his where lc_id_emisor = @IdEmisor

-- 2. DETALLE SUMADO POR BDD (ACTUAL + HISTÓRICO)
SELECT 
    BDD,
    SUM(OK) AS [Total_OK],
    SUM(Duplicados) AS [Total_Duplicados],
    SUM(Error) AS [Total_Error],
    SUM(Importados) AS [Total_Importados],
    SUM(Procesados) AS [Total_Procesados],
    CASE 
        WHEN BDD = 'sat_comprobante' THEN 'ACTUAL'
        ELSE 'HISTÓRICO'
    END AS [Origen]
FROM (
    -- Datos Actuales
    SELECT IdEmisor, OK, Duplicados, Error, Importados, Procesados, 'sat_comprobante' as BDD 
    FROM sat_logging.dbo.log_resumen_licencias
    WHERE IdEmisor = @IdEmisor
    
    UNION ALL
    
    -- Datos Históricos
    SELECT IdEmisor, OK, Duplicados, Error, Importados, Procesados, BDD 
    FROM sat_logging.dbo.log_resumen_licencias_his
    WHERE IdEmisor = @IdEmisor
) AS UnionLogs
GROUP BY BDD, CASE WHEN BDD = 'sat_comprobante' THEN 'ACTUAL' ELSE 'HISTÓRICO' END
ORDER BY [Origen] DESC;

select sum(ok) as OK, sum(error) as Error, sum(ok)+sum(error) as Total from sat_logging.dbo.log_resumen_licencias
where Periodo>= (select lc_fecha_creacion from sat_catalogo..sc_licencia where lc_id_emisor = @IdEmisor)  -- Creacion Historica
and IdEmisor = @IdEmisor

-- 3. COMPARACIÓN TOTAL Y ANÁLISIS DE DIFERENCIA (RECONCILIACIÓN)
;WITH CTE_LogsConsolidados AS (
    SELECT 
        SUM(OK) AS Total_Logs_OK
    FROM (
        SELECT OK FROM sat_logging.dbo.log_resumen_licencias WHERE IdEmisor = @IdEmisor
        UNION ALL
        SELECT OK FROM sat_logging.dbo.log_resumen_licencias_his WHERE IdEmisor = @IdEmisor
		and Periodo >='2023/01/01'
    ) AS T
),
CTE_Licencia AS (
    SELECT lc_comprobantes_procesados AS Contador_Licencia
    FROM sat_catalogo..sc_licencia 
    WHERE lc_id_emisor = @IdEmisor
)
SELECT 
    L.Contador_Licencia,
    C.Total_Logs_OK,
    (L.Contador_Licencia - C.Total_Logs_OK) AS [Diferencia (Gap)],
    CASE 
        WHEN (L.Contador_Licencia - C.Total_Logs_OK) = 0 THEN 'SINCERADO'
        WHEN (L.Contador_Licencia - C.Total_Logs_OK) > 0 THEN 'LOGS FALTANTES (Subconteo)'
        ELSE 'LICENCIA DESACTUALIZADA (Sobreconteo)'
    END AS [Estado_Reconciliacion]
FROM CTE_Licencia L, CTE_LogsConsolidados C;



select count(*) as comprobantes, co_estatus, DescripcionEstatus 
from sat_comprobante.dbo.com_log_comprobante_xml with(nolock)
inner join sat_catalogo..sc_vista_estados_documentos on co_estatus = Codigo
where co_hora_in>=(select lc_fecha_creacion from sat_catalogo..sc_licencia where lc_id_emisor = @IdEmisor)
and co_id_emisor = @IdEmisor
group by co_estatus,DescripcionEstatus
