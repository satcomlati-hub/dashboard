/* 
=========================================================================================
SCRIPT BASE: Monitoreo de Errores en Comprobantes (SATCOM)
Propósito: Identificar comprobantes no autorizados con errores de conexión.
=========================================================================================
*/

SELECT  
    Autorizado, 
    DescripcionEstatus, 
    DescripcionTipoDocumento, 
    co_pais, 
    co_nemonico, 
    co_id_comprobante, 
    co_numero_reprocesos, 
    co_hora_reproceso, 
    co_num_comprobante, 
    co_hora_in, 
    co_fecha_emision, 
    co_identificacion, 
    co_tipo_identificacion, 
    co_detalle, 
    co_trama_dto  -- Campo XML para análisis profundo
FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK)
LEFT JOIN sat_catalogo..sc_vista_estados_documentos 
    ON co_estatus = CodigoEstatus  
LEFT JOIN sat_catalogo..sc_vista_tipo_documetos 
    ON co_codigo_tipo_documento = CodigoNegocio AND Pais = co_pais  
WHERE co_id_comprobante > 0
    AND co_pais = 593 -- ECUADOR (Cambiar según necesidad)
    AND DescripcionEstatus = 'ErrorConexionAutorizador' -- Filtrar por estado específico
    
    /* Filtros de Tiempo: Se recomienda usar co_mes_emi para mejorar el rendimiento (particionamiento) */
    AND co_fecha_in >= DATEADD(DAY, -2, GETDATE()) -- Últimos 2 días
    AND co_hora_in >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE)) -- Desde el inicio del día anterior
    
    /* Filtro por subconsulta de errores temporales */
    AND co_id_comprobante IN (SELECT dl_id_comprobante FROM #tempError)
    
    /* Filtro de Autorización */
    AND Autorizado = 0 

    /* Filtros Opcionales (Descomentar para usar) */
    -- AND co_id_comprobante = 263148017435577807   
    -- AND co_detalle LIKE '%Está utilizando el tipo de moneda%'  

ORDER BY co_hora_in DESC;
