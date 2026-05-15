# 🚀 Manual Técnico: Servicio Bridge SATCOM Ecuador

> [!IMPORTANT]
> Este manual está diseñado para equipos técnicos y desarrolladores que integran sistemas ERP (SAP, Oracle, Dynamics, etc.) con el ecosistema de facturación electrónica de SATCOM a través del canal **Bridge**.

## 1. Introducción al Servicio Bridge
El servicio **Bridge** actúa como un middleware robusto que simplifica la comunicación entre su ERP y el SRI. Centraliza la validación, firma, envío y recepción de autorizaciones, eliminando la complejidad técnica de la gestión directa de certificados y protocolos del SRI.

## 2. Configuración de Entorno
Para el proceso de certificación y pruebas de integración, utilice las siguientes credenciales:

| Parámetro | Valor |
| :--- | :--- |
| **Ambiente de Pruebas** | `https://bridge-testing.mysatcomla.com/WcfBridge.svc` |
| **WSDL** | `https://bridge-testing.mysatcomla.com/WcfBridge.svc?wsdl` |
| **Tecnología** | WCF / SOAP 1.2 |

## 3. Método Principal: `ProcesarComprobante`
Es el punto de entrada principal para el envío de documentos.

### Especificaciones del Método
- **Input:** `strRequerimiento` (XML string), `Comprimido` (bool)
- **Output:** `DtoResponseComprobante`

#### Estructura Completa del Requerimiento (Ecuador)
A continuación, se detalla una trama exitosa real para el procesamiento de una factura en Ecuador:

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tem="http://tempuri.org/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
   <soap:Header>
      <wsa:Action soap:mustUnderstand="1">http://tempuri.org/IBridge/ProcesarComprobante</wsa:Action>
      <wsa:To soap:mustUnderstand="1">http://bridge-testing.mysatcomla.com/WcfBridge.svc</wsa:To>
   </soap:Header>
   <soap:Body>
      <tem:ProcesarComprobante>
         <tem:strRequerimiento><![CDATA[
            <Requerimiento xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
                <InformacionAdicional>
                    <Campo><Descripcion>Contribuyente Negocio Popular - Régimen RIMPE</Descripcion><Valor>.</Valor></Campo>
                </InformacionAdicional>
                <ConceptoEmision>FACTURACION_EJEMPLO</ConceptoEmision>
                <Codigo>01</Codigo>
                <NumeroDocumento>000002984</NumeroDocumento>
                <FechaEmision>11/07/2025 08:32:00</FechaEmision>
                <TotalSinImpuestos>1000.00</TotalSinImpuestos>
                <TotalConImpuestos>1150.00</TotalConImpuestos>
                <Impuestos>
                    <Impuesto>
                        <CodigoImpuesto>2</CodigoImpuesto>
                        <Impuesto>IVA %15.0000</Impuesto>
                        <BaseImponible>1000.00</BaseImponible>
                        <Valor>150.00</Valor>
                    </Impuesto>
                </Impuestos>
                <Pagos>
                    <Pago>
                        <FormaPagoEcuador>SIN_UTILIZACION_DEL_SISTEMA_FINANCIERO_01</FormaPagoEcuador>
                        <Total>1150</Total>
                    </Pago>
                </Pagos>
                <Pais>Ecuador</Pais>
                <RucEmisor>1790824845001</RucEmisor>
                <Establecimiento>001</Establecimiento>
                <Punto>003</Punto>
                <Cliente>
                    <RazonSocial>PRUEBA SAC</RazonSocial>
                    <TipoIdentificacion>04</TipoIdentificacion>
                    <NumeroIdentificacion>1790085783001</NumeroIdentificacion>
                </Cliente>
                <Detalles>
                    <Detalle id="1">
                        <Cantidad>1</Cantidad>
                        <SubTotal>1000.00</SubTotal>
                        <Producto>
                            <Descripcion>PRODUCTO EJEMPLO</Descripcion>
                            <ValorUnitario>1000</ValorUnitario>
                        </Producto>
                    </Detalle>
                </Detalles>
                <Canal>BRIDGE</Canal>
            </Requerimiento>
         ]]></tem:strRequerimiento>
         <tem:Comprimido>false</tem:Comprimido>
      </tem:ProcesarComprobante>
   </soap:Body>
</soap:Envelope>
```

## 5. Gestión de Respuesta
El servicio retornará un objeto con el estado del procesamiento:

- **Estado:** `AUTORIZADO`, `DEVUELTA`, `ERROR`.
- **ClaveAcceso:** La clave de 49 dígitos generada.
- **XmlAutorizado:** El XML firmado y autorizado listo para ser almacenado o enviado al cliente final.

---
## 6. Pruebas Rápidas con cURL
Para diagnósticos rápidos desde la terminal o integración en scripts, puede utilizar los siguientes comandos. Estos comandos ya incluyen los encabezados de **WS-Addressing** requeridos.

### A. Prueba de Conectividad (`Test`)
```bash
curl --location 'https://bridge-testing.mysatcomla.com/WcfBridge.svc' \
--header 'Content-Type: application/soap+xml; charset=utf-8' \
--data '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tem="http://tempuri.org/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
   <soap:Header>
      <wsa:Action soap:mustUnderstand="1">http://tempuri.org/IBridge/Test</wsa:Action>
      <wsa:To soap:mustUnderstand="1">http://bridge-testing.mysatcomla.com/WcfBridge.svc</wsa:To>
   </soap:Header>
   <soap:Body>
      <tem:Test/>
   </soap:Body>
</soap:Envelope>'
```

### B. Procesamiento de Comprobante (`ProcesarComprobante`)
Este comando envía una solicitud de procesamiento completa. Recuerde que el contenido dentro del `CDATA` es el XML del Requerimiento.

```bash
curl --location 'https://bridge-testing.mysatcomla.com/WcfBridge.svc' \
--header 'Content-Type: application/soap+xml; charset=utf-8' \
--data '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tem="http://tempuri.org/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
   <soap:Header>
      <wsa:Action soap:mustUnderstand="1">http://tempuri.org/IBridge/ProcesarComprobante</wsa:Action>
      <wsa:To soap:mustUnderstand="1">http://bridge-testing.mysatcomla.com/WcfBridge.svc</wsa:To>
   </soap:Header>
   <soap:Body>
      <tem:ProcesarComprobante>
         <tem:strRequerimiento><![CDATA[<Requerimiento xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><InformacionAdicional><Campo><Descripcion>Contribuyente Negocio Popular - Régimen RIMPE</Descripcion><Valor>.</Valor></Campo></InformacionAdicional><ConceptoEmision>FACTURACION_EJEMPLO</ConceptoEmision><Codigo>01</Codigo><NumeroDocumento>000002984</NumeroDocumento><FechaEmision>11/07/2025 08:32:00</FechaEmision><TotalSinImpuestos>1000.00</TotalSinImpuestos><TotalConImpuestos>1150.00</TotalConImpuestos><Impuestos><Impuesto><CodigoImpuesto>2</CodigoImpuesto><Impuesto>IVA %15.0000</Impuesto><CodigoPorcentaje>4</CodigoPorcentaje><Porcentaje>15</Porcentaje><BaseImponible>1000.00</BaseImponible><Valor>150.00</Valor></Impuesto></Impuestos><Pagos><Pago><FormaPagoEcuador>SIN_UTILIZACION_DEL_SISTEMA_FINANCIERO_01</FormaPagoEcuador><Total>1150</Total></Pago></Pagos><Pais>Ecuador</Pais><RucEmisor>1790824845001</RucEmisor><Establecimiento>001</Establecimiento><Punto>003</Punto><Cliente><RazonSocial>PRUEBA SAC</RazonSocial><TipoIdentificacion>04</TipoIdentificacion><NumeroIdentificacion>1790085783001</NumeroIdentificacion></Cliente><Detalles><Detalle id="1"><Cantidad>1</Cantidad><SubTotal>1000.00</SubTotal><Producto><Descripcion>PRODUCTO EJEMPLO</Descripcion><ValorUnitario>1000</ValorUnitario></Producto></Detalle></Detalles><Canal>BRIDGE</Canal></Requerimiento>]]></tem:strRequerimiento>
         <tem:Comprimido>false</tem:Comprimido>
      </tem:ProcesarComprobante>
   </soap:Body>
</soap:Envelope>'
```

---

## 7. XML de Prueba (Requerimiento)
A continuación se proporciona el XML base que debe enviarse dentro del parámetro `strRequerimiento`. Este XML contiene todos los campos obligatorios para un comprobante en Ecuador.

```xml
<Requerimiento xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <InformacionAdicional>
        <Campo><Descripcion>Contribuyente Negocio Popular - Régimen RIMPE</Descripcion><Valor>.</Valor></Campo>
    </InformacionAdicional>
    <ConceptoEmision>3 - BACKEND BOLETOS NACIONALES:$1150</ConceptoEmision>
    <Codigo>01</Codigo>
    <NumeroDocumento>000002984</NumeroDocumento>
    <FechaEmision>11/07/2025 08:32:00</FechaEmision>
    <TotalSinImpuestos>1000.00</TotalSinImpuestos>
    <TotalConImpuestos>1150.00</TotalConImpuestos>
    <Impuestos>
        <Impuesto>
            <CodigoImpuesto>2</CodigoImpuesto>
            <Impuesto>IVA %15.0000</Impuesto>
            <CodigoPorcentaje>4</CodigoPorcentaje>
            <Porcentaje>15</Porcentaje>
            <BaseImponible>1000.00</BaseImponible>
            <Valor>150.00</Valor>
        </Impuesto>
    </Impuestos>
    <Pagos>
        <Pago>
            <FormaPagoEcuador>SIN_UTILIZACION_DEL_SISTEMA_FINANCIERO_01</FormaPagoEcuador>
            <Total>1150</Total>
        </Pago>
    </Pagos>
    <Pais>Ecuador</Pais>
    <RucEmisor>1790824845001</RucEmisor>
    <Establecimiento>001</Establecimiento>
    <Punto>003</Punto>
    <Cliente>
        <RazonSocial>PRUEBA SAC</RazonSocial>
        <TipoIdentificacion>04</TipoIdentificacion>
        <NumeroIdentificacion>1790085783001</NumeroIdentificacion>
    </Cliente>
    <Detalles>
        <Detalle id="1">
            <Cantidad>1</Cantidad>
            <SubTotal>1000.00</SubTotal>
            <Producto>
                <Descripcion>3 - BACKEND BOLETOS NACIONALES</Descripcion>
                <ValorUnitario>1000</ValorUnitario>
            </Producto>
        </Detalle>
    </Detalles>
    <Canal>BRIDGE</Canal>
</Requerimiento>
```

---
> [!NOTE]
> **Importante:** El campo `wsa:To` debe usar siempre `http://` (sin S) para evitar errores de validación de dirección en el servidor WCF de SATCOM.
