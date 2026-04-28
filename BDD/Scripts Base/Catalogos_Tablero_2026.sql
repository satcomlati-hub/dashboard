USE sat_catalogo;
GO

/* 
=========================================================================================
SP: Catálogo de Tipos de Documento (Reporte Tablero)
Propósito: Retornar los tipos de documentos por país con alias normalizados.
=========================================================================================
*/
CREATE OR ALTER PROCEDURE consulta_tablero_tipos_documento_2026
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        CodigoTipo AS IdTipo,
        CodigoNegocio AS CodigoNegocio,
        Documento AS TipoDocumento,
        Pais AS IdPais,
        DescripcionPais AS NombrePais
    FROM sat_catalogo..sc_vista_tipo_documetos;
END;
GO

/* 
=========================================================================================
SP: Catálogo de Estados de Documento (Reporte Tablero)
Propósito: Retornar los estados de autorización con alias normalizados.
=========================================================================================
*/
CREATE OR ALTER PROCEDURE consulta_tablero_estados_documento_2026
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        CodigoEstatus AS IdEstado,
        DescripcionEstatus AS NombreEstado,
        Autorizado AS EsAutorizado,
        Contador AS CategoriaContador
    FROM sat_catalogo..sc_vista_estados_documentos;
END;
GO
