USE [sat_logging];
GO

IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_com_log_consultas_bdd_rate_limiting' 
      AND object_id = OBJECT_ID('[dbo].[com_log_consultas_bdd]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_com_log_consultas_bdd_rate_limiting] 
    ON [dbo].[com_log_consultas_bdd] 
    (
        [lc_nombre_sp],
        [lc_appname],
        [lc_origen],
        [lc_emisor],
        [lc_usuario],
        [lc_hora_registro]
    );
    PRINT '>>> INDICE IX_com_log_consultas_bdd_rate_limiting CREADO EXITOSAMENTE.';
END
ELSE
BEGIN
    PRINT '>>> EL INDICE IX_com_log_consultas_bdd_rate_limiting YA EXISTE.';
END
GO
