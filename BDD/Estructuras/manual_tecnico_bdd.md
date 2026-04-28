# Manual Técnico de Referencia - BDD Satcom

Este documento sirve como base de conocimiento para la estructura, lógica y procesos de la base de datos de Satcom. Se actualiza con el conocimiento adquirido durante las tareas de desarrollo y mantenimiento.

## 1. Arquitectura de Base de Datos (Esquemas)

> [!NOTE]
> Las estructuras de las bases de datos detalladas a continuación son **universales** para todos los entornos de Satcom (V5, AWS, On-Premise). El dashboard y los procesos de monitoreo operan sobre esta misma base estructural independientemente del despliegue.

| Esquema | Propósito |
| :--- | :--- |
| `sat_comprobante` | Almacena la bitácora operativa de comprobantes (`com_log_comprobante_xml`). |
| `sat_catalogo` | Contiene maestros de emisores, catálogos de países y vistas de estados/tipos. |
| `sat_logging` | Almacena resúmenes históricos de licencias, auditoría y tablas de procesos auxiliares. |

---

## 2. Estándares de Desarrollo y Nomenclatura

> [!IMPORTANT]
> Todo objeto de base de datos que interactúe con el Dashboard de monitoreo vía n8n debe seguir estas reglas:

- **Procedimientos Almacenados (SPs)**: Deben usar el prefijo `consulta_tablero_` seguido del proceso y el sufijo `_2026`.
  - Estructura: `consulta_tablero_<proceso>_2026`
  - Ejemplo: `consulta_tablero_emisores_2026`.
- **Resultados (Datasets)**: Las columnas devueltas deben tener alias amigables en **UpperCamelCase** (ej: `IdEmisor`, `FechaUltimaAccion`).
- **Comentarios**: Todo SP debe incluir una cabecera documentando el propósito y el esquema de destino.

---

## 3. Integración con Dashboard (n8n Webhooks)

> [!NOTE]
> La disponibilización de datos para el Dashboard se realiza mediante el Webhook centralizado en SARA.

- **URL Webhook**: `https://sara.mysatcomla.com/webhook/GetData`
- **Mecanismo**: El dashboard solicita datos a través del proceso `Monitoreo Procesos Consulta SP (VOfL2rAriW1s0TeQ)`.
- **SPs de Base**: Los siguientes procedimientos son los pilares para el cruce de información:
  1. `consulta_tablero_emisores_2026`
  2. `consulta_tablero_tipos_documento_2026`
  3. `consulta_tablero_estados_documento_2026`

---

## 4. Procesos de Automatización (SPs)

### 4.1 `splog_poblar_actividad_emisor`
*   **Ubicación**: `sat_logging`
*   **Propósito**: Consolida una vez al día la actividad de todos los emisores en la tabla física `log_actividad_emisor`.
*   **Funcionamiento**:
    1. Verifica si ya se ejecutó hoy mediante `Fecha_Proceso`.
    2. Si no, trunca la tabla.
    3. Cruza la bitácora del último mes con el histórico de licencias para obtener totales y la última fecha de autorización.

---

## 5. Objetos de BDD Creados / Modificados (Sinceramiento 2026)

Esta sección lista los objetos específicos creados para el proceso de auditoría, monitoreo y sinceramiento de contadores.

| Objeto | Tipo | Esquema | Propósito |
| :--- | :--- | :--- | :--- |
| `log_actividad_emisor` | Tabla | `sat_logging` | Tabla física que almacena el consolidado diario de actividad por punto de emisión. |
| `splog_poblar_actividad_emisor` | SP | `sat_logging` | Proceso diario que calcula y puebla la tabla `log_actividad_emisor`. |
| `v_ultima_actividad_emisor` | Vista | `sat_logging` | Resumen ejecutivo de la última fecha de autorización global por emisor. |
| `splog_depurar_historia_licencia` | SP | `sat_logging` | Lógica de depuración PEPS para eliminar registros históricos excedentes. |
| `consulta_tablero_emisores_2026` | SP | `sat_catalogo` | Interfaz simplificada para el catálogo de emisores. |
| `consulta_tablero_tipos_doc_2026` | SP | `sat_catalogo` | Catálogo de tipos de documentos por país. |
| `consulta_tablero_estados_doc_2026` | SP | `sat_catalogo` | Catálogo de estados de autorización. |
| `consulta_tablero_actividad_emisor_2026` | SP | `sat_logging` | Consolidado de actividad con cruce de catálogos para Analytics. |
| `consulta_tablero_alertas_inactividad_2026` | SP | `sat_logging` | Detección de caída de actividad en emisores recurrentes. |
| `consulta_tablero_ranking_errores_2026` | SP | `sat_logging` | Top de puntos de emisión con mayores fallos técnicos. |

---

## 6. Estructuras de Consultas para Dashboard

### 6.1 `consulta_tablero_emisores_2026`
Este procedimiento retorna el catálogo maestro con nombres de columna normalizados para facilitar la integración con herramientas de visualización y automatización (n8n).

```sql
SELECT 
    em_id_emisor AS IdEmisor,
    em_nemonico AS Nemonico,
    CASE em_estado 
        WHEN 0 THEN 'Activo' 
        WHEN 3 THEN 'Bloqueado' 
        ELSE CAST(em_estado AS VARCHAR) 
    END AS Estado,
    em_nombre AS NombreComercial,
    em_identificacion_principal AS Identificacion,
    em_razon_social AS RazonSocial,
    em_pais AS CodigoPais,
    em_fecha_creacion AS FechaCreacion,
    em_fecha_actualizacion AS FechaActualizacion
FROM sat_catalogo..sc_emisor;
```

### 6.2 `consulta_tablero_tipos_documento_2026`
Retorna los tipos de documentos con alias amigables.

```sql
SELECT 
    CodigoTipo AS IdTipo,
    CodigoNegocio AS CodigoNegocio,
    Documento AS TipoDocumento,
    Pais AS IdPais,
    DescripcionPais AS NombrePais
FROM sat_catalogo..sc_vista_tipo_documetos;
```

### 6.3 `consulta_tablero_estados_documento_2026`
Retorna el maestro de estados de autorización.

```sql
SELECT 
    CodigoEstatus AS IdEstado,
    DescripcionEstatus AS NombreEstado,
    Autorizado AS EsAutorizado,
    Contador AS CategoriaContador
FROM sat_catalogo..sc_vista_estados_documentos;
```

### 6.4 `consulta_tablero_actividad_emisor_2026`
Este procedimiento consolida la actividad diaria cruzando la tabla física `log_actividad_emisor` con los catálogos maestros para devolver un dataset enriquecido.

**Lógica de Cruce:**
- **Emisores**: `IdEmisor` (Actividad) -> `IdEmisor` (Catálogo).
- **Tipos de Documento**: `CodigoTipoDocumento` + `IdPais` (Actividad) -> `CodigoNegocio` + `IdPais` (Catálogo).

**Campos Enriquecidos**:
- `Nemonico`, `Identificacion`, `RazonSocial`, `Pais` (Nombre).

### 6.5 `consulta_tablero_alertas_inactividad_2026`
Identifica emisores con volumen histórico pero sin actividad en las últimas 24h.
- **Niveles**: ALERTA (>24h), CRITICO (>48h).

### 6.6 `consulta_tablero_ranking_errores_2026`
Top 20 de puntos de emisión con más errores, incluyendo el `% de error` sobre el total procesado.

---

## 7. Indicadores Clave (KPIs) - Analytics

El sistema debe permitir la visualización de los siguientes indicadores basados en la fecha de sincronización y autorización:

1. **Emisores Activos (Con Autorizaciones)**:
   - Conteo de emisores únicos con `TotalAutorizados > 0` en los periodos: Ayer, Esta Semana, Este Mes, Este Año, Global.
2. **Línea de Tiempo de Procesamiento**:
   - Evolución diaria de `TotalAutorizados` vs `TotalErrores`.
   - Capacidad de filtrado dinámico por `Nemonico`.

---

## 8. Roadmap y Objetos Pendientes (Próximos Pasos)

Para completar el proceso de sinceramiento y optimización del dashboard, se han identificado las siguientes tareas pendientes:

| Objeto / Tarea | Estado | Descripción |
| :--- | :--- | :--- |
| `splog_poblar_licecias_diaria` | **Pendiente** | Modificar para eliminar los parches de `0.95`, `0.80`, etc. Ahora debe tomar el valor físico real. |
| `Job_Poblar_Actividad` | **Pendiente** | Crear un Job de SQL Server para ejecutar `splog_poblar_actividad_emisor` automáticamente cada noche. |
| `v_dashboard_latencia` | **Pendiente** | Crear vista para medir el Gap de Emisión (`co_fecha_emision` vs `co_hora_in`) por emisor. |

---

## 9. Glosario de Términos
*   **Nemonico**: Identificador alfanumérico corto de un cliente/emisor.
*   **Gap de Emisión**: Diferencia entre `co_fecha_emision` y `co_hora_in`. Si es alta, indica problemas de sincronización o encolamiento.
*   **Punto de Emisión**: Identificador de la caja o terminal que genera el documento.

---
*Manual generado el 2026-04-28 por Antigravity.*
