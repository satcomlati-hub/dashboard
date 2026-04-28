/* 
=========================================================================================
SCRIPT: Configuración Detallada Emisor Colombia (SODX)
Propósito: Desglosar el XML em_info_adicional específico para Colombia (57).
Nota: La estructura de este XML varía según el país del emisor.
=========================================================================================
*/

SELECT 
    em_fecha_creacion, 
    em_fecha_actualizacion,
    -- Campos de Configuración Técnica
    T.c.value('(Version/text())[1]', 'varchar(50)') AS Version,
    T.c.value('(ImprimirEnDesconexion/text())[1]', 'varchar(10)') AS ImprimirEnDesconexion,
    T.c.value('(ImprimirEnError/text())[1]', 'varchar(10)') AS ImprimirEnError,
    T.c.value('(ComisionUnclick/text())[1]', 'decimal(18,2)') AS ComisionUnclick,
    T.c.value('(TipoEmpresa/text())[1]', 'varchar(50)') AS TipoEmpresa,
    T.c.value('(AgrupacionProductos/text())[1]', 'varchar(10)') AS AgrupacionProductos,
    T.c.value('(ManejarPropina/text())[1]', 'varchar(10)') AS ManejarPropina,
    
    -- Configuración SFTP
    T.c.value('(SftpHost/text())[1]', 'varchar(100)') AS SftpHost,
    T.c.value('(SftpPort/text())[1]', 'varchar(10)') AS SftpPort,
    T.c.value('(SftpUser/text())[1]', 'varchar(100)') AS SftpUser,
    T.c.value('(SftpPassword/text())[1]', 'varchar(500)') AS SftpPassword,
    T.c.value('(SftpPathRemoto/text())[1]', 'varchar(200)') AS SftpPathRemoto,
    
    -- Datos Legales y Fiscales Colombia
    T.c.value('(TipoIdentificacion/text())[1]', 'varchar(20)') AS TipoIdentificacion,
    T.c.value('(Departamento/text())[1]', 'varchar(100)') AS Departamento,
    T.c.value('(CodigoDepartamento/text())[1]', 'varchar(10)') AS CodigoDepartamento,
    T.c.value('(Ciudad/text())[1]', 'varchar(100)') AS Ciudad,
    T.c.value('(CodigoMunicipio/text())[1]', 'varchar(10)') AS CodigoMunicipio,
    T.c.value('(Regimen/text())[1]', 'varchar(50)') AS Regimen,
    T.c.value('(ResponsabilidadFiscal/text())[1]', 'varchar(100)') AS ResponsabilidadFiscal,
    T.c.value('(OrganizacionJuridica/text())[1]', 'varchar(50)') AS OrganizacionJuridica,
    
    -- Datos de Contacto
    T.c.value('(Telefono/text())[1]', 'varchar(50)') AS Telefono,
    T.c.value('(Correo/text())[1]', 'varchar(200)') AS Correo,
    
    -- Configuración de Facturación 2.1 (DIAN)
    T.c.value('(IDSoftware21/text())[1]', 'varchar(100)') AS IDSoftware21,
    T.c.value('(NombreSoftware21/text())[1]', 'varchar(100)') AS NombreSoftware21,
    T.c.value('(TestIDPruebas/text())[1]', 'varchar(100)') AS TestIDPruebas,
    T.c.value('(Pin21/text())[1]', 'varchar(50)') AS Pin21,
    T.c.value('(CudePin/text())[1]', 'varchar(10)') AS CudePin,
    T.c.value('(PoliticaFirma/text())[1]', 'varchar(50)') AS PoliticaFirma,
    
    -- Otros
    T.c.value('(LeyendaDatosPersonales/text())[1]', 'varchar(max)') AS LeyendaDatosPersonales,
    T.c.value('(SecuencialArchivo/text())[1]', 'int') AS SecuencialArchivo

FROM sat_catalogo..sc_emisor
CROSS APPLY em_info_adicional.nodes('/DtoInfoAdicionalColombia') AS T(c)
WHERE em_nemonico = 'SODX';
