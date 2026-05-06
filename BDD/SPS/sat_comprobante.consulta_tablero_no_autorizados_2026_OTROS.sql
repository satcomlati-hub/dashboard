CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_OTROS]
(
    @i_Pais int = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    /*
    Propósito: Consulta de comprobantes no autorizados para países que no tienen un SP especializado.
    Lógica de segmentación:
    - Si @i_Pais es NULL: Consulta todos los países EXCEPTO los especializados (EC, COL, PA, CR).
    - Si @i_Pais es NOT NULL: Consulta únicamente el país solicitado.
    */
    
    SELECT 
        ambiente,
        co_motivo,
        co_pais,
        co_nemonico,
        CAST(co_id_comprobante AS varchar(30)) AS Column1,
        CAST(co_id_comprobante AS varchar(30)) AS co_id_comprobante,
        co_hora_in,
        co_fecha_emision,
        co_num_comprobante,
        co_codigo_tipo_documento,
        co_establecimiento,
        co_punto_emision,
        Reprocesable,
        co_detalle,
        co_ultima_actualizacion,
        co_numero_reprocesos,
        co_hora_reproceso,
        DescripcionEstatus,
        DescripcionTipoDocumento
    FROM sat_comprobante.dbo.co_comprobante_rechazado
    WHERE 
        (@i_Pais IS NULL AND co_pais NOT IN (593, 57, 507, 506))
        OR 
        (@i_Pais IS NOT NULL AND co_pais = @i_Pais);
END;
GO
