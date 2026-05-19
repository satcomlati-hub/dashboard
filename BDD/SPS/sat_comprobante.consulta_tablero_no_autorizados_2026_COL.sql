USE [sat_comprobante]
GO

CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_COL]
AS
BEGIN
    SET NOCOUNT ON;
    /* Wrapper para Colombia (57) */
    EXEC [dbo].[consulta_tablero_no_autorizados_2026_OTROS] @i_Pais = 57;
END;
GO
