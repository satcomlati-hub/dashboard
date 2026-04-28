# SKILL: Desarrollo y Modificación de Flujos n8n

**Contexto:** Eres un experto en n8n. Aplica rigurosamente las siguientes directrices cada vez que el usuario te solicite diseñar, modificar, analizar o interactuar con flujos de n8n.

## 1. Prohibición de Creación Autónoma
- **NUNCA** crees un flujo nuevo por tu cuenta.
- Si el requerimiento exige un nuevo flujo, debes **solicitar al usuario** que lo cree en la plataforma de n8n (sea Cloud o Auto-hosteada) y te proporcione el **ID del flujo** para que comiences a trabajar sobre él.

## 2. Nomenclatura y Control de Versiones
- **Versionado Obligatorio:** Todo flujo modificado debe incluir un control de versiones en su nombre desde el primer cambio.
  - *Formato:* `NombreDescriptivo_<V1>`. Ejemplo: `SincronizacionCRM_<V1>`.
  - Incrementa la versión en cambios sustanciales.
- **Nombres de Nodos:** Está terminantemente **PROHIBIDO** usar nombres por defecto (ej. "HTTP Request 1", "Code"). Renombra cada nodo según su funcionalidad exacta y en español (ej. "Obtener Datos de Cliente", "Filtrar JSON").

## 3. Arquitectura y Legibilidad
- **Claridad Visual:** El flujo debe ser fácil de entender a primera vista. Evita el cruce caótico de líneas y mantén una secuencia lógica (generalmente de izquierda a derecha).
- **Modularidad:** Si un flujo supera los 15-20 nodos, sugiere dividirlo usando el nodo `Execute Workflow`.
- **Anotaciones (Sticky Notes):** Utiliza notas visuales en el lienzo de n8n para agrupar lógica, delinear fases (ej. "Extracción", "Transformación") y explicar lógicas complejas.

## 4. Documentación y Dependencias
- Documenta explícitamente en el flujo cualquier dependencia.
- Si llamas a otros flujos, incluye en las notas el **Nombre y el ID del flujo** invocado.
- Si el flujo es accionado por un sistema externo (Supabase, Webhook, Chatbot), debe estar documentado en una nota junto al nodo Trigger.

## 5. Mejores Prácticas de Rendimiento y Seguridad
- **Cero Credenciales "Quemadas":** NUNCA pongas API Keys, contraseñas o tokens directamente en el texto o código de los nodos. Exige y utiliza siempre el gestor de Credenciales de n8n o variables de entorno.
- **Manejo de Datos (Pruning):** Limpia los datos de salida (elimina basura o datos pesados no necesarios) antes de pasarlos a ciclos (Loops) para evitar consumir la memoria del sistema.
- **Manejo de Errores (Error Handling):** Considera nodos `Error Trigger` para fallos globales y la opción `Continue On Fail` para llamadas a APIs inestables.
- **Testing Inteligente:** Recomienda anclar datos ("Pin Data") en los nodos iniciales durante las pruebas para evitar ejecuciones innecesarias contra APIs externas.

## 6. Estándares de Base de Datos para Monitoreo
- **Nomenclatura de Stored Procedures (SPs):** Todo SP que sea consumido desde n8n para propósitos de monitoreo o dashboard **DEBE** seguir estrictamente la siguiente estructura:
  - `consulta_tablero_<proceso>_2026`
  - Ejemplo: `consulta_tablero_emisores_2026`, `consulta_tablero_iva_ec_2026`.
- **Nombres de Columnas:** Los resultados devueltos por el SP deben usar alias amigables y legibles (UpperCamelCase) para facilitar su mapeo en los nodos de n8n (ej. `NombreComercial`, `FechaUltimaEmision`).

**Ejecución:** Lee siempre estas reglas antes de proponer código JavaScript para un nodo `Code` o antes de guiar al usuario en la interfaz de n8n. No asumas flujos, pregunta por los IDs y nombres.
