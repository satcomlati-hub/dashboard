USE [sat_comprobante]
GO

ALTER procedure [dbo].[spco_crear_log_consulta]  
@i_lc_nombre_sp varchar(200) = null,
@i_lc_hostname varchar(200) =null,
@i_lc_appname varchar(200) =null,
@i_lc_emisor int =null,
@i_lc_parametros varchar(8000) =null,
@i_lc_origen varchar(100)= null,
@i_lc_inicio datetime =null,
@i_lc_fin datetime =null,
@i_lc_error nvarchar(max) =null,
@i_lc_usuario varchar(100) = null,
@o_recurrencias int = null output
as
begin

insert into sat_logging.dbo.com_log_consultas_bdd(
lc_hora_registro,
lc_nombre_sp,
lc_hostname ,
lc_appname ,
lc_emisor ,
lc_parametros ,
lc_origen ,
lc_inicio ,
lc_fin ,
lc_error ,
lc_usuario
)
values
(
getdate(),
@i_lc_nombre_sp ,
@i_lc_hostname ,
isnull(@i_lc_appname, 'S/A') , -- Controlar NULL insertando 'S/A' (Sin Aplicación)
isnull(@i_lc_emisor, 0) , -- Controlar NULL insertando 0 (Sin Emisor)
isnull(@i_lc_parametros, 'S/P') , -- Controlar NULL insertando 'S/P' (Sin Parámetros)
isnull(@i_lc_origen, 'S/O') , -- Controlar NULL insertando 'S/O' (Sin Origen)
@i_lc_inicio ,
@i_lc_fin,
@i_lc_error,
isnull(@i_lc_usuario, 'S/U') -- Controlar NULL insertando 'S/U' (Sin Usuario)  
)

-- Calcular el número de recurrencias del día actual (intentos de consulta) si se requiere
if @i_lc_parametros is not null and @i_lc_parametros <> 'S/P' and @i_lc_parametros <> ''
begin
    select @o_recurrencias = count(1)
    from sat_logging.dbo.com_log_consultas_bdd with(nolock)
    where lc_nombre_sp = @i_lc_nombre_sp
      and lc_appname = isnull(@i_lc_appname, 'S/A')
      and lc_parametros = isnull(@i_lc_parametros, 'S/P') -- Controlar valor por defecto en la comparación
      and lc_origen = isnull(@i_lc_origen, 'S/O') -- Conteo dinámico y robusto por origen
      and lc_emisor = isnull(@i_lc_emisor, 0) -- Filtrar también por emisor para evitar falsos positivos cruzados
      and lc_usuario = isnull(@i_lc_usuario, 'S/U') -- Filtrar también por usuario para evitar falsos positivos cruzados
      and lc_hora_registro >= cast(getdate() as date);
end
else
begin
    set @o_recurrencias = 0;
end

--spco_crear_log_consulta 'sp_prueba',null,'batch',1,'sdfsfdf','BDD','2023-01-01','2023-01-01',null

end
GO
