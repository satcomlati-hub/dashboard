USE [sat_logging];
GO

-- 1. Eliminar el índice si existe para poder alterar la tabla
IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_com_log_consultas_bdd_rate_limiting' 
      AND object_id = OBJECT_ID('[dbo].[com_log_consultas_bdd]')
)
BEGIN
    DROP INDEX [IX_com_log_consultas_bdd_rate_limiting] ON [dbo].[com_log_consultas_bdd];
    PRINT '>>> INDICE IX_com_log_consultas_bdd_rate_limiting ELIMINADO PARA MIGRACION.';
END
GO

-- 2. Alterar la columna a varchar(8000)
PRINT '>>> ALTERANDO COLUMNA lc_parametros A varchar(8000)...';
ALTER TABLE [dbo].[com_log_consultas_bdd] 
ALTER COLUMN [lc_parametros] VARCHAR(8000) NULL;
PRINT '>>> COLUMNA lc_parametros ALTERADA EXITOSAMENTE A varchar(8000).';
GO

-- 3. Crear el nuevo índice optimizado de cobertura
PRINT '>>> CREANDO NUEVO INDICE IX_com_log_consultas_bdd_rate_limiting...';
CREATE NONCLUSTERED INDEX [IX_com_log_consultas_bdd_rate_limiting] 
ON [dbo].[com_log_consultas_bdd] 
(
    [lc_nombre_sp],
    [lc_appname],
    [lc_emisor],
    [lc_usuario],
    [lc_hora_registro]
)
INCLUDE ([lc_parametros], [lc_origen]);
PRINT '>>> INDICE IX_com_log_consultas_bdd_rate_limiting CREADO CON INCLUDE.';
GO
