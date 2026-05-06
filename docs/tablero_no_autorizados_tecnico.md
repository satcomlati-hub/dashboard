# Documentación Técnica: Tablero de Comprobantes No Autorizados 2026

## 1. Arquitectura de Consulta
El dashboard de "Comprobantes No Autorizados" utiliza una arquitectura segmentada en dos fases para optimizar el rendimiento y permitir la especialización por país/ambiente.

### Fase 1: Descubrimiento de Localidades
Se utiliza para poblar los filtros y el resumen por país según el ambiente seleccionado.
- **SP**: `consulta_tablero_paises_ambiente_2026`
- **Parámetros**: `@i_ambiente (VARCHAR)`
- **Salida**: Lista de países (`Pais` o `co_pais`) y conteo opcional de documentos.

### Fase 2: Consulta Detallada de Datos
Dependiendo del país seleccionado por el usuario, el frontend invoca dinámicamente uno de los siguientes procedimientos especializados:

| País / Grupo | Procedimiento Almacenado | Propósito |
| :--- | :--- | :--- |
| **Ecuador (593)** | `consulta_tablero_no_autorizados_2026_EC` | Consulta optimizada para esquemas de Ecuador (V5). |
| **Colombia (57)** | `consulta_tablero_no_autorizados_2026_COL` | Consulta para el ambiente de Colombia. |
| **Panamá (507)** | `consulta_tablero_no_autorizados_2026_PA` | Consulta para el ambiente de Panamá. |
| **Costa Rica (506)** | `consulta_tablero_no_autorizados_2026_CR` | Consulta para el ambiente de Costa Rica. |
| **OTROS** | `consulta_tablero_no_autorizados_2026_OTROS` | **Consolidador Global.** Atiende a todos los países que no tienen un SP específico. Si `@i_Pais` es NULL, excluye automáticamente a los 4 anteriores. |

---

## 2. Integración con n8n
Las consultas se realizan a través del webhook de integración de Satcom:
- **URL**: `https://sara.mysatcomla.com/webhook/GetData`
- **Parámetros Query**:
    - `Ambiente`: (V5, Panama, Colombia)
    - `Proceso`: Nombre del SP a ejecutar (ej: `consulta_tablero_no_autorizados_2026_EC`)
    - `Pais`: (Opcional) Código numérico del país.

---

## 3. Estándar de Observabilidad (Logging & Alertas)
Todos los SPs mencionados (en sus versiones optimizadas) incorporan:
1. **Try...Catch**: Captura de errores en tiempo de ejecución.
2. **Alertas proactivas**: Invocación a `spct_insertar_alerta_postgres` para notificar fallos críticos directamente a **Telegram**.
3. **Auditoría**: Registro en `spco_crear_log_consulta` detallando parámetros de entrada y tiempo de respuesta para análisis de performance.
4. **Backup Automático**: Antes de cualquier modificación, el sistema crea una copia de seguridad con el sufijo `_BK_DD_Mon_YYYY`.

---
**Última Actualización**: 2026-05-06
**Responsable**: Antigravity (AI Assistant)
