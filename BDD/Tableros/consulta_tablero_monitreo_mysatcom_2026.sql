USE sat_logging;
GO

/* 
=========================================================================================
SCRIPT: consulta_tablero_monitreo_mysatcom_2026
Propósito: Procedimiento almacenado para el tablero de monitoreo de transacciones.
           Modificado para incluir agrupamiento por canal (co_canal) y conteos individuales
           de Autorizados, Duplicados (estado 14) y No Autorizados.
=========================================================================================
*/

CREATE OR ALTER PROCEDURE dbo.consulta_tablero_monitreo_mysatcom_2026
AS
BEGIN
    -- Desactivar el conteo de filas afectadas para mejorar el rendimiento de la red
    SET NOCOUNT ON;

    SELECT 
        co_fecha_in AS Fecha,
        -- Extraemos la hora y le damos formato de texto 'HH:00' (ej. '09:00', '13:00')
        RIGHT('0' + CAST(DATEPART(HOUR, co_hora_in) AS VARCHAR(2)), 2) + ':00' AS Hora,
        co_id_emisor AS IdEmisor,
        co_canal AS Canal,
        
        -- Contadores condicionales individuales
        SUM(CASE WHEN Autorizado = 1 AND co_estatus <> 14 THEN 1 ELSE 0 END) AS Autorizados,
        SUM(CASE WHEN co_estatus = 14 THEN 1 ELSE 0 END) AS Duplicados,
        SUM(CASE WHEN Autorizado = 0 AND co_estatus <> 14 THEN 1 ELSE 0 END) AS NoAutorizados
    FROM sat_comprobante.dbo.com_log_comprobante_xml WITH(NOLOCK)
    INNER JOIN sat_catalogo..sc_vista_estados_documentos 
        ON co_estatus = CodigoEstatus  
    WHERE co_id_comprobante > 0
      -- AND co_pais = 593 -- Descomentar si se requiere filtrar solo por un país específico
      AND co_fecha_in >= DATEADD(day, -7, CAST(GETDATE() AS DATE)) -- Filtro de los últimos 7 días
    GROUP BY co_fecha_in, RIGHT('0' + CAST(DATEPART(HOUR, co_hora_in) AS VARCHAR(2)), 2) + ':00', co_id_emisor, co_canal;

END
GO
