# 🚀 Guía de Excelencia: Documentación para RAG (SATCOM)

Esta guía establece el estándar para crear y mejorar artículos en Zoho Learn. Una buena documentación no solo ayuda al equipo, sino que es el "combustible" que permite que nuestra IA (RAG) responda con precisión.

---

## 🛠 Flujo de Trabajo: Mejorando un Artículo Existente

Si tienes un artículo que está desordenado, desactualizado o es difícil de leer, sigue estos pasos utilizando **Gemini** (o ChatGPT):

### Paso 1: Extraer el contenido
1. Entra a **Zoho Learn** y abre el artículo que deseas mejorar.
2. Haz clic en **Editar**.
3. Selecciona todo el contenido (`Ctrl + A`) y cópialo (`Ctrl + C`).
    * *Nota: No te preocupes por el desorden del formato original, la IA lo limpiará.*

### Paso 2: Procesar con Gemini
Ve a [Gemini](https://gemini.google.com/) y utiliza el siguiente prompt (copia y pega):

> **Prompt Maestro:**
> *"Actúa como un experto en documentación técnica y sistemas RAG. Voy a pasarte un texto desordenado de nuestra base de conocimientos. Tu objetivo es:
> 1. Organizarlo usando jerarquía de Markdown (H1 para título, H2 para secciones).
> 2. Mejorar la redacción para que sea clara, directa y profesional.
> 3. Asegurarte de que la información sea 'atómica' (que cada sección explique un concepto completo).
> 4. Mantener todos los datos técnicos intactos.
> 5. Usar listas con viñetas para pasos o características.
>
> Aquí tienes el texto:"*
>
> `[PEGA AQUÍ TU TEXTO]`

### Paso 3: Revisión y Ajuste
La IA te entregará una versión mejorada. **Léela con cuidado.**
- ¿Falta algún paso importante?
- ¿El tono suena natural para SATCOM?
- Si algo no te gusta, pídele: *"Ajusta la sección X para que sea más breve"* o *"Explica mejor el paso Y"*.

### Paso 4: De vuelta a Zoho Learn
1. Copia el texto resultante de Gemini.
2. En el editor de **Zoho Learn**, borra el contenido viejo y pega el nuevo.
3. **⚠️ IMPORTANTE - Manejo Manual:**
    *   **Imágenes:** Las imágenes se pierden en el proceso de copiado a Gemini. Debes volver a insertarlas manualmente en sus posiciones correspondientes dentro de Zoho Learn.
    *   **Adjuntos:** Los archivos descargables también deben volver a subirse o vincularse después de pegar el nuevo texto.
    *   *Tip:* No cierres la pestaña del artículo original hasta haber verificado que todas las imágenes y adjuntos están en su lugar en la nueva versión.

---

## 📝 Reglas de Oro para Documentación RAG

Para que nuestra IA procese correctamente la información, debemos seguir estas especificaciones técnicas:

### 1. Jerarquía y Texto
*   **Niveles de Títulos:** Máximo 3 niveles de indentación (H1 -> H2 -> H3).
*   **Fuentes:** No incluyas fuentes externas a menos que sean oficiales y estén validadas.
*   **Terminología Coherente:** Usa siempre el mismo nombre para el mismo sistema o proceso (ej: siempre "n8n", no alternar con "servidor de flujos"). Esto ayuda a la IA a conectar ideas.

### 2. Imágenes Propias y Multimedia
En SATCOM usamos material propio (capturas de pantalla, flujos de n8n, capturas de consola). Como la IA no puede "ver" estas imágenes:
*   **Regla de Oro:** La imagen es un apoyo, pero el texto debe ser capaz de explicar el proceso por sí solo.
*   **Formato de imagen (Usa esta plantilla):** 
    1. **Título descriptivo** arriba en **Negrita** (No usar encabezados H1-H3 para esto).
    2. Inserta la imagen.
    3. **Nota explicativa** debajo en *Cursiva* (especialmente si hay números o etiquetas en la imagen).

> **Ejemplo de Plantilla:**
> 
> **Figura 1: Interfaz de procesamiento en Gemini**
> 
> (Aquí va la imagen)
> 
> *Nota: En la imagen se observa (1) el Prompt Maestro con las instrucciones y (2) el contenido técnico desordenado antes de ser procesado.*

*   **Manejo Manual:** Recuerda que al usar Gemini para mejorar el texto, las imágenes deben reinsertarse a mano en Zoho Learn.

### 3. Estilo y Legibilidad Visual (Menos es más)
Para mantener la limpieza de los datos y evitar errores en el RAG:
*   **Colores de texto:** **Prohibido** cambiar colores de fuente manualmente (no pintar texto de rojo, azul, etc.). 
*   **Cajas de Contexto (Callouts):** Si algo es crítico, usa las herramientas de Zoho Learn: *"Caja de Información"*, *"Caja de Advertencia"* o *"Nota"*. Para la IA, estas cajas tienen un valor semántico superior al texto pintado.
*   **Fuentes y Tamaños:** Usa siempre la fuente predeterminada del sistema. No fuerces tamaños de letra distintos; usa los niveles de encabezado (H1, H2, H3).
*   **Negritas:** Úsalas solo para resaltar términos técnicos, nombres de botones o pasos clave (ej: *"Haz clic en el botón **Guardar**"*).

### 4. Enlaces (Links) y Palabras Clave
*   **✅ Enlaces:** Escribe la dirección completa (URL) para que la IA la identifique claramente en su respuesta.
*   **❌ Hipervínculos ocultos:** No pongas links dentro de palabras (ej: [Clic aquí]). La IA no puede procesar la URL si no es visible.
*   **Keywords (Palabras Clave):** Al final de cada artículo, añade una pequeña lista de términos relacionados para ayudar al motor de búsqueda.
    * *Ejemplo:* `Keywords: Facturación electrónica, error SRI, firma digital.`

### 5. Archivos Adjuntos
*   **El RAG no lee adjuntos:** Los PDFs o Excel que subas no forman parte del conocimiento de la IA.
*   **Acción:** Trascribe el contenido relevante directamente en el cuerpo del artículo.

---

## 📊 Resumen de Formato Exigido (SATCOM)

| Elemento | Regla SATCOM |
| :--- | :--- |
| **Formato** | Exclusivamente **Markdown**. |
| **Enlaces** | Siempre la **URL completa** visible en el texto. |
| **Imágenes** | Deben llevar **Título y Descripción** textual. |
| **Jerarquía** | Máximo **3 niveles** de encabezados (H1-H3). |
| **Terminología** | Nombre **único y consistente** para cada sistema. |
| **Palabras Clave** | Añadir sección de **Keywords** al final del texto. |
| **Adjuntos** | **Trascribir contenido** relevante al artículo. |

---

## 💡 Herramientas Recomendadas

1. **Gemini / ChatGPT:** Tu editor personal. Úsalo para resumir, corregir gramática o cambiar el tono.
2. **Editor de Zoho Learn:** Aprovecha las opciones de "Información" (Callouts) para resaltar notas importantes.
3. **Markdown Guide:** Si quieres aprender más trucos de formato, busca "Markdown Cheatsheet" en internet.

---

## 🤖 ¿Por qué lo hacemos así?
Nuestro sistema RAG fragmenta estos artículos en pequeños trozos. Si un trozo dice *"Haz clic aquí"* pero no dice en qué sistema ni para qué, la IA no sabrá responder. **Si el documento es claro para un humano, será perfecto para la IA.**

---
*Documento propiedad de Satcom - Automatizaciones*
