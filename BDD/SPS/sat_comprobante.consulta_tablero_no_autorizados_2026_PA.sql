USE [sat_comprobante]
GO

CREATE OR ALTER PROCEDURE [dbo].[consulta_tablero_no_autorizados_2026_PA]
AS
BEGIN
    SET NOCOUNT ON;
    /* Wrapper para Panamá (507) */
    EXEC [dbo].[consulta_tablero_no_autorizados_2026_OTROS] @i_Pais = 507;
END;
GO
