USE [sat_comprobante]
GO

CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_EC]
AS
BEGIN
    SET NOCOUNT ON;
    /* Wrapper para Ecuador (593) */
    EXEC [dbo].[consulta_tablero_no_autorizados_2026_OTROS] @i_Pais = 593;
END;
GO
