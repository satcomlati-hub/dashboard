---
name: formatting-desk-cases
description: Estrecha el formato de los reportes enviados a Zoho Desk u otros sistemas de ticketing, asegurando que la información se presente en un HTML estructurado, premium y altamente legible, diferenciando canales (Manual vs Monitoreo).
---

# Formatting Desk Cases (Premium HTML)

## When to use this skill
- Al generar el cuerpo (`description`) para un nuevo ticket en Zoho Desk.
- Al automatizar alertas de monitoreo que requieren una presentación profesional.
- Cuando se necesite desglosar datos técnicos de forma jerárquica y visual.

## Workflow

1. **Definición de Variables**: Identifica los datos clave (Regla, Ambiente, Afectación, Detalles técnicos e IDs de muestreo).
2. **Estructura Base**: Utiliza un contenedor `div` con fuente `Segoe UI` y bordes redondeados.
3. **Sección de Alerta**: Incluye un título con color corporativo de alerta (`#d9534f`).
4. **Bloque de Metadatos**: Usa un fondo gris claro (`#f8f9fa`) con un borde lateral acentuado para los datos de contexto.
5. **Diferenciación de Canales**:
    - **Dashboard-Monitoreo**: Para alertas automáticas generadas por n8n.
    - **Dashboard-Manual**: Para casos creados manualmente por el usuario desde la UI del Tablero.
6. **Tabla de Detalles**: Desglosa la información técnica en una tabla limpia para máxima legibilidad.
7. **Muestreo Técnico**: Presenta los IDs o logs en un bloque oscuro estilo consola (`#272822`).

## Instructions

### 🎨 Paleta de Colores y Estilos
- **Alerta/Error**: `#d9534f` (Rojo Intenso)
- **Acento/Links**: `#0052cc` (Azul Corporativo)
- **Resaltado**: `#ffeb3b` (Amarillo)
- **Bordes**: `1px solid #e1e4e8`
- **Fondo Consola**: `#272822` con texto `#f8f8f2`

### 🏗️ Plantilla de Código Sugerida
```javascript
const htmlCuerpo = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 800px; border: 1px solid #e1e4e8; padding: 20px; border-radius: 10px; background-color: #ffffff;">
  <!-- TÍTULO -->
  <h2 style="color: #d9534f; font-size: 20px; margin-top: 0; border-bottom: 2px solid #d9534f; padding-bottom: 10px;">
    🚨 TITULO_DEL_REPORTE
  </h2>
  
  <!-- CONTEXTO RÁPIDO -->
  <div style="margin: 15px 0; background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 5px solid #0052cc;">
    <p style="margin: 5px 0;"><strong>Generado por:</strong> <span style="color: #0052cc;">\${nombreUsuario}</span></p>
    <p style="margin: 5px 0;"><strong>Ambiente:</strong> <span style="color: #0052cc;">\${ambiente}</span></p>
    <p style="margin: 5px 0;"><strong>Afectación:</strong> <span style="background-color: #ffeb3b; padding: 2px 6px; border-radius: 4px; font-weight: bold;">\${conteo} documentos</span></p>
  </div>

  <!-- DETALLE ESTRUCTURADO -->
  <h3 style="color: #444; font-size: 16px; margin-top: 20px;">📝 DETALLE</h3>
  <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e1e4e8; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 4px 0; color: #666; width: 110px;"><b>Etiqueta 1:</b></td><td style="padding: 4px 0;">\${valor1}</td></tr>
      <tr><td style="padding: 4px 0; color: #666;"><b>Etiqueta 2:</b></td><td style="padding: 4px 0;">\${valor2}</td></tr>
    </table>
  </div>

  <!-- MUESTREO TÉCNICO -->
  <h3 style="color: #444; font-size: 16px; margin-top: 20px;">🔍 MUESTREO</h3>
  <div style="background: #272822; color: #f8f8f2; padding: 15px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 13px; overflow-x: auto;">
    \${ids.join('<br>')}
  </div>

  <!-- FOOTER -->
  <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0 10px 0;">
  <p style="font-style: italic; color: #888; font-size: 11px; text-align: right;">
    Generado por SARA Monitoring - \${new Date().toLocaleString('es-EC')}
  </p>
</div>
`.trim();
```

## Resources
- [Guía de Diseño Zoho Desk](https://help.zoho.com/portal/en/kb/desk)
- [Diferenciación de Canales Satcom](file:///c:/@Antigravity/Satcom/docs/monitoreo_sri.md)
