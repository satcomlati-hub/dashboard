---
name: mapping-sri-to-requerimiento
description: Permite al agente analizar una factura autorizada del SRI de Ecuador y reconstruir el objeto Requerimiento original usado en mySatcom.
---

# Mapeo de SRI Factura a Requerimiento de mySatcom

Esta skill documenta las reglas y la estructura de mapeo para realizar la transformación inversa: tomar una **Factura XML del SRI (Ecuador)** autorizada y generar su estructura de **Requerimiento** correspondiente para mySatcom.

## Cuándo usar esta skill
- Al requerir la reconstrucción de tramas de prueba a partir de XMLs autorizados por el SRI.
- Para implementar scripts o flujos de integración que reciban XMLs del SRI y deban registrarlos en la base de datos de mySatcom.

## Estructura Comparativa de Datos

### 1. Datos Generales y del Emisor

| Campo en SRI (`/factura`) | Campo en Requerimiento (`/Requerimiento`) | Descripción / Regla |
| :--- | :--- | :--- |
| `infoTributaria/codDoc` | `Codigo` | Código del documento (ej. `01` para Factura). |
| `infoTributaria/secuencial` | `NumeroDocumento` | Número secuencial (ej. `000029521`). |
| `infoFactura/fechaEmision` | `FechaEmision` | Fecha de emisión (formato `DD/MM/AAAA`). |
| `infoTributaria/claveAcceso` | `ClaveAcceso` | Clave de acceso generada de 49 dígitos. |
| `infoTributaria/claveAcceso` | `NumeroAutorizacion` | Número de autorización (suele coincidir con la clave de acceso). |
| `infoTributaria/ruc` | `RucEmisor` | RUC del emisor. |
| `infoTributaria/razonSocial` | `RazonSocialEmisor` | Razón social del emisor. |
| `infoTributaria/estab` | `Establecimiento` | Código de establecimiento (ej. `003`). |
| `infoTributaria/ptoEmi` | `Punto` | Punto de emisión (ej. `100`). |
| `infoTributaria/ambiente` | `Ambiente` | Ambiente del SRI (`1` = Pruebas, `2` = Producción). |
| `infoFactura/moneda` | `Moneda` | Moneda de transacción (ej. `USD`). |
| Constante `Ecuador` | `Pais` | País de origen de la transacción. |

### 2. Datos del Cliente / Comprador

| Campo en SRI (`/factura/infoFactura`) | Campo en Requerimiento (`/Requerimiento/Cliente`) | Descripción / Regla |
| :--- | :--- | :--- |
| `razonSocialComprador` | `RazonSocial` | Nombre o razón social del cliente. |
| `tipoIdentificacionComprador` | `TipoIdentificacion` | Código de tipo de identificación del SRI. |
| `identificacionComprador` | `NumeroIdentificacion` | RUC, cédula o pasaporte del cliente. |
| (Por defecto `0`) | `TipoCliente` | Tipo de cliente. |

### 3. Valores Totales y Resumen

| Campo en SRI (`/factura/infoFactura`) | Campo en Requerimiento (`/Requerimiento`) | Descripción / Regla |
| :--- | :--- | :--- |
| `totalSinImpuestos` | `TotalSinImpuestos` | Base imponible total sin impuestos. |
| `importeTotal` | `TotalConImpuestos` | Importe total con impuestos. |
| `importeTotal` | `ResumenComprobante/TotalVenta` | Total de la venta en el resumen. |
| `importeTotal` | `ResumenComprobante/TotalComprobante` | Total del comprobante en el resumen. |
| `moneda` | `ResumenComprobante/CodigoMoneda` | Moneda del comprobante. |

### 4. Impuestos del Comprobante

Mapear cada `<totalImpuesto>` dentro de `infoFactura/totalConImpuestos` a la lista `Requerimiento/Impuestos/Impuesto`:

| Campo en SRI (`totalImpuesto`) | Campo en Requerimiento (`Impuesto`) | Regla / Notas |
| :--- | :--- | :--- |
| `codigo` | `CodigoImpuesto` | Código de impuesto (ej. `2` para IVA). |
| `codigoPorcentaje` | `CodigoPorcentaje` | Código del porcentaje (ej. `4` para 15% IVA). |
| `tarifa` | `Porcentaje` | Porcentaje del impuesto (ej. `15.000000`). |
| `baseImponible` | `BaseImponible` | Base imponible para el cálculo. |
| `valor` | `Valor` | Monto calculado del impuesto. |
| (Concatenación) | `Impuesto` | Nombre descriptivo del impuesto (ej. `15%IVA`). |

### 5. Pagos

Mapear cada `<pago>` dentro de `infoFactura/pagos` a la lista `Requerimiento/Pagos/Pago`:

| Campo en SRI (`pago`) | Campo en Requerimiento (`Pago`) | Regla / Notas |
| :--- | :--- | :--- |
| `formaPago` | `CodigoFormaPago` | Código de forma de pago del SRI (ej. `20`). |
| `total` | `Total` | Monto pagado con esta forma de pago. |
| `formaPago` | `FormaPagoEcuador` | Texto equivalente de la forma de pago (ej. `OTROS_CON_UTILIZACION_DEL_SISTEMA_FINANCIERO_20` si el código es `20`). |

### 6. Detalles de Items / Productos

Para cada elemento `<detalle>` en la lista de `detalles` de la factura SRI, generar un `<Detalle id="[Secuencia]">`:

| Campo en SRI (`detalle`) | Campo en Requerimiento (`Detalle`) | Regla / Notas |
| :--- | :--- | :--- |
| `cantidad` | `Cantidad` | Cantidad física vendida. |
| `precioTotalSinImpuesto` | `SubTotal` | Precio total de la línea sin impuestos. |
| `precioTotalSinImpuesto` + impuesto | `Total` | Total de la línea incluyendo impuestos. |
| `codigoPrincipal` | `Producto/Codigo` | Código interno del producto. |
| `descripcion` | `Producto/Descripcion` | Nombre o descripción del ítem. |
| `precioUnitario` | `Producto/ValorUnitario` | Precio unitario cobrado. |

#### Información Adicional del Item (Detalles Adicionales)
Mapear cada `<detAdicional>` a `<InformacionAdicional><Campo>` dentro del detalle:
- El atributo `nombre` se mapea a `<Descripcion>`.
- El atributo `valor` se mapea a `<Valor>`.

### 7. Información Adicional del Comprobante

El SRI almacena los datos no estructurados en `/factura/infoAdicional/campoAdicional`. Estos se deben mapear directamente a `/Requerimiento/InformacionAdicional/Campo` usando un contador secuencial para el atributo `id`:

- El atributo `nombre` se mapea a `<Descripcion>`.
- El texto del elemento se mapea a `<Valor>`.

*Nota:* Algunos campos de `infoAdicional` (como `Telefono`, `Email`, `CAJERO`, etc.) se mapean adicionalmente a sus respectivas etiquetas a nivel raíz si se requiere su uso directo en la aplicación.

---

## Script de Referencia (PowerShell)

Aquí se presenta una plantilla para realizar la conversión inversa leyendo el XML del SRI y extrayendo los datos al formato de Requerimiento de mySatcom:

```powershell
function Convert-SriToRequerimiento {
    param (
        [string]$SriXmlPath,
        [string]$OutputPath
    )

    $sri = [xml](Get-Content -Path $SriXmlPath)
    
    # Crear nuevo documento de Requerimiento
    $req = New-Object System.Xml.XmlDocument
    $root = $req.CreateElement("Requerimiento")
    $req.AppendChild($root) > $null

    # 1. InformacionAdicional (mapear infoAdicional del SRI)
    $infoAdiNode = $req.CreateElement("InformacionAdicional")
    $root.AppendChild($infoAdiNode) > $null
    
    $id = 1
    foreach ($campo in $sri.factura.infoAdicional.campoAdicional) {
        $campoNode = $req.CreateElement("Campo")
        $campoNode.SetAttribute("id", $id++) > $null
        
        $descNode = $req.CreateElement("Descripcion")
        $descNode.InnerText = $campo.nombre
        $campoNode.AppendChild($descNode) > $null
        
        $valNode = $req.CreateElement("Valor")
        $valNode.InnerText = $campo.InnerText
        $campoNode.AppendChild($valNode) > $null
        
        $infoAdiNode.AppendChild($campoNode) > $null
    }

    # 2. Datos Generales
    $fields = @{
        "Codigo" = $sri.factura.infoTributaria.codDoc
        "NumeroDocumento" = $sri.factura.infoTributaria.secuencial
        "FechaEmision" = $sri.factura.infoFactura.fechaEmision
        "TotalSinImpuestos" = $sri.factura.infoFactura.totalSinImpuestos
        "TotalConImpuestos" = $sri.factura.infoFactura.importeTotal
        "ClaveAcceso" = $sri.factura.infoTributaria.claveAcceso
        "NumeroAutorizacion" = $sri.factura.infoTributaria.claveAcceso
        "Pais" = "Ecuador"
        "RucEmisor" = $sri.factura.infoTributaria.ruc
        "RazonSocialEmisor" = $sri.factura.infoTributaria.razonSocial
        "Establecimiento" = $sri.factura.infoTributaria.estab
        "Punto" = $sri.factura.infoTributaria.ptoEmi
        "Moneda" = $sri.factura.infoFactura.moneda
        "Ambiente" = $sri.factura.infoTributaria.ambiente
    }

    foreach ($key in $fields.Keys) {
        $node = $req.CreateElement($key)
        $node.InnerText = $fields[$key]
        $root.AppendChild($node) > $null
    }

    # 3. ResumenComprobante
    $resumen = $req.CreateElement("ResumenComprobante")
    
    $codMon = $req.CreateElement("CodigoMoneda")
    $codMon.InnerText = $sri.factura.infoFactura.moneda
    $resumen.AppendChild($codMon) > $null

    $totalVenta = $req.CreateElement("TotalVenta")
    $totalVenta.InnerText = $sri.factura.infoFactura.importeTotal
    $resumen.AppendChild($totalVenta) > $null

    $totalComp = $req.CreateElement("TotalComprobante")
    $totalComp.InnerText = $sri.factura.infoFactura.importeTotal
    $resumen.AppendChild($totalComp) > $null

    $root.AppendChild($resumen) > $null

    # 4. Cliente
    $cliente = $req.CreateElement("Cliente")
    
    $razon = $req.CreateElement("RazonSocial")
    $razon.InnerText = $sri.factura.infoFactura.razonSocialComprador
    $cliente.AppendChild($razon) > $null

    $tipoId = $req.CreateElement("TipoIdentificacion")
    $tipoId.InnerText = $sri.factura.infoFactura.tipoIdentificacionComprador
    $cliente.AppendChild($tipoId) > $null

    $numId = $req.CreateElement("NumeroIdentificacion")
    $numId.InnerText = $sri.factura.infoFactura.identificacionComprador
    $cliente.AppendChild($numId) > $null

    $root.AppendChild($cliente) > $null

    # 5. Detalles
    $detallesNode = $req.CreateElement("Detalles")
    $detId = 1
    foreach ($det in $sri.factura.detalles.detalle) {
        $detNode = $req.CreateElement("Detalle")
        $detNode.SetAttribute("id", $detId++) > $null
        
        $cantNode = $req.CreateElement("Cantidad")
        $cantNode.InnerText = $det.cantidad
        $detNode.AppendChild($cantNode) > $null

        $subNode = $req.CreateElement("SubTotal")
        $subNode.InnerText = $det.precioTotalSinImpuesto
        $detNode.AppendChild($subNode) > $null

        # Agregar info de Producto
        $prodNode = $req.CreateElement("Producto")
        $codNode = $req.CreateElement("Codigo")
        $codNode.InnerText = $det.codigoPrincipal
        $prodNode.AppendChild($codNode) > $null

        $descNode = $req.CreateElement("Descripcion")
        $descNode.InnerText = $det.descripcion
        $prodNode.AppendChild($descNode) > $null

        $valUnit = $req.CreateElement("ValorUnitario")
        $valUnit.InnerText = $det.precioUnitario
        $prodNode.AppendChild($valUnit) > $null
        $detNode.AppendChild($prodNode) > $null

        $detallesNode.AppendChild($detNode) > $null
    }
    $root.AppendChild($detallesNode) > $null

    # Guardar archivo formateado
    $sw = New-Object System.IO.StringWriter
    $writer = New-Object System.Xml.XmlTextWriter($sw)
    $writer.Formatting = [System.Xml.Formatting]::Indented
    $req.WriteTo($writer)
    $writer.Close()
    [System.IO.File]::WriteAllText($OutputPath, $sw.ToString())
}
```
