---
name: managing-bdd-emergencies
description: Guides the implementation and management of the database emergency control mechanism (emergencia_bdd) to disable non-critical procedures during crises.
---

# Gestión de Emergencias en BDD Satcom

## Cuándo usar esta Skill
- Cuando el usuario solicite implementar un control de apagado/deshabilitación de emergencia en nuevos procedimientos almacenados (SPs) de base de datos.
- Cuando se requiera validar o verificar la lógica de control de emergencias en la base de datos SQL Server de Satcom.

## Flujo de Trabajo
1. **Identificar los SPs objetivo**: Determinar qué procedimientos almacenados deben contar con el control de emergencia.
2. **Definir el punto de interrupción**: Ubicar el bloque inicial del procedimiento (`BEGIN`), preferentemente después de `SET NOCOUNT ON` y antes de cualquier transacción, mutex (AppLock) o inserción en tablas de logs/visibilidad.
3. **Implementar el bloque de código de control**: Insertar la lógica estándar de obtención de la variable `emergencia_bdd`.
4. **Verificar la sintaxis**: Asegurar que las variables de emergencia no colisionen con variables locales preexistentes.

## Instrucciones de Implementación

Para cada procedimiento almacenado a controlar, inserte la siguiente lógica estándar justo después de iniciar el cuerpo principal:

```sql
    -- CONTROL DE EMERGENCIA BDD
    DECLARE @aux_emergencia_1 VARCHAR(100), @aux_emergencia_2 VARCHAR(100);
    EXEC sat_catalogo.dbo.sp_get_valor_variable_app 'emergencia_bdd', @aux_emergencia_1 OUT, @aux_emergencia_2 OUT, 'false';
    IF UPPER(LTRIM(RTRIM(ISNULL(@aux_emergencia_1, '')))) IN ('SI', 'TRUE')
    BEGIN
        PRINT '>>> CONTROL DE EMERGENCIA BDD ACTIVO: Se cancela la ejecucion de <nombre_del_sp>.';
        RETURN 0;
    END
```

### Reglas de Diseño:
- **Nombres de variables locales**: Use `@aux_emergencia_1` y `@aux_emergencia_2` para evitar colisiones con variables `@aux` u otras comunes del procedimiento.
- **Normalización del valor**: Utilice siempre `UPPER(LTRIM(RTRIM(ISNULL(@aux_emergencia_1, ''))))` para garantizar que variaciones en mayúsculas, espacios en blanco o nulos se procesen de forma segura.
- **Mensaje de depuración**: Imprima siempre un mensaje descriptivo en consola (`PRINT`) con el nombre del procedimiento cancelado para que quede registrado en los históricos del batch execution engine o consola.

## Recursos
- Rutas de referencia modificadas:
  - [sat_comprobante.spco_get_comprobantes_full.sql](file:///c:/@Antigravity/Satcom/BDD/SPS/Reprocesos/sat_comprobante.spco_get_comprobantes_full.sql)
  - [sat_comprobante.spct_reproceso_resumen_by_pais_hosting.sql](file:///c:/@Antigravity/Satcom/BDD/SPS/Info%20reportes/sat_comprobante.spct_reproceso_resumen_by_pais_hosting.sql)
