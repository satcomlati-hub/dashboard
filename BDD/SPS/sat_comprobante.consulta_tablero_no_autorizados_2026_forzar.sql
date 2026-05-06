USE [sat_comprobante]
GO

CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_forzar]
AS
BEGIN
    SET NOCOUNT ON;
    /* 
    Propósito: Forzar la actualización manual de la tabla co_comprobante_rechazado.
    Este procedimiento invoca al motor de procesamiento global.
    */
    PRINT '>>> Iniciando actualización forzada de comprobantes...';
    
    -- Nota: Se asume que el SP base 'consulta_tablero_no_autorizados_2026' 
    -- existe en el motor de BD aunque se haya removido del repo por obsolescencia en el dashboard.
    EXEC [dbo].[consulta_tablero_no_autorizados_2026];
    
    PRINT '>>> Actualización completada.';
END;
GO
