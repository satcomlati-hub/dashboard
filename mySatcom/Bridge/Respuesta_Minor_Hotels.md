# Borrador de Respuesta Técnica: Migración SAP S/4 HANA - Minor Hotels

**Asunto:** Re: FW: MINOR HOTEL - Migración a SAP4 HANA - conexión test SATCOM

Estimados colegas de Minor Hotels,

Es un gusto saludarles. En relación a la migración de sus sistemas a **SAP S/4 HANA** y la integración con nuestros servicios de facturación electrónica, les proporcionamos la información técnica necesaria para el ambiente de pruebas.

### 1. Endpoint de Pruebas
El canal de comunicación recomendado para integraciones desde ERPs de alto nivel es nuestro servicio **Bridge (WCF/SOAP)**:
- **URL:** `https://bridge-testing.mysatcomla.com/WcfBridge.svc`
- **WSDL:** `https://bridge-testing.mysatcomla.com/WcfBridge.svc?wsdl`

### 2. Especificaciones Técnicas (WS-Addressing)
Nuestro servicio requiere la implementación de **WS-Addressing**. Es fundamental que el encabezado `wsa:To` apunte a la dirección `http` (sin S) para cumplir con las políticas de filtrado del despachador WCF, incluso si la conexión física es por HTTPS.

### 3. Trama de Ejemplo (Factura Ecuador)
A continuación, adjuntamos la estructura SOAP recomendada para el método `ProcesarComprobante`. Esta trama ya incluye un ejemplo de mapeo exitoso:

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tem="http://tempuri.org/" xmlns:wsa="http://www.w3.org/2005/08/addressing">
   <soap:Header>
      <wsa:Action soap:mustUnderstand="1">http://tempuri.org/IBridge/ProcesarComprobante</wsa:Action>
      <wsa:To soap:mustUnderstand="1">http://bridge-testing.mysatcomla.com/WcfBridge.svc</wsa:To>
   </soap:Header>
   <soap:Body>
      <tem:ProcesarComprobante>
         <tem:strRequerimiento><![CDATA[
            <!-- Aquí deben mapear su estructura de Requerimiento según el estándar adjunto -->
         ]]></tem:strRequerimiento>
         <tem:Comprimido>false</tem:Comprimido>
      </tem:ProcesarComprobante>
   </soap:Body>
</soap:Envelope>
```

### 4. Herramienta de Validación
Hemos preparado una consola de pruebas interactiva local (`TestBridge.html`) que les permitirá realizar pruebas de conectividad de forma inmediata sin necesidad de desarrollo previo.

Quedamos a su disposición para cualquier duda técnica durante el proceso de integración.

Atentamente,

**Equipo de Soporte Técnico SATCOM**
