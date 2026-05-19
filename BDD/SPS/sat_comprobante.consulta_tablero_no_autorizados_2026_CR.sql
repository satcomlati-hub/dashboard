USE [sat_comprobante]
GO

CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_CR]
AS
BEGIN
    SET NOCOUNT ON;
    /* Wrapper para Costa Rica (506) */
    EXEC [dbo].[consulta_tablero_no_autorizados_2026_OTROS] @i_Pais = 506;
END;
GO
