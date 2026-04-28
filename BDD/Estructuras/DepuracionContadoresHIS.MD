# Manual de Depuración de Contadores Históricos (HIS)

Este manual documenta el proceso único de "sinceramiento" de la tabla `log_resumen_licencias_his`. El objetivo es eliminar la lógica de parches (descuentos porcentuales) en los procedimientos almacenados, ajustando la base de datos física para que el conteo real coincida con los acuerdos comerciales.

## 1. Contexto y Objetivo
El procedimiento `splog_poblar_licecias_diaria` aplicaba descuentos del 5%, 7%, 11.65%, 15.37% y 20% sobre el conteo de ciertos emisores para compensar migraciones o errores históricos. Para normalizar esto, se procede a eliminar de forma permanente los registros más antiguos hasta cubrir la cuota de "descuento" equivalente.

## 2. Datos de Cuotas de Depuración (Calculados al 2026-04-28)

| IdEmisor | Nemónico | Total OK Real | % Descuento | **Comprobantes a Eliminar** |
| :--- | :--- | :--- | :--- | :--- |
| 447 | AYA | 152 | 5.00% | **7** |
| 1913 | NAKI | 1,176 | 5.00% | **58** |
| 1960 | LABT | 2,457 | 5.00% | **122** |
| 1939 | COOK | 7,422 | 5.00% | **371** |
| 1934 | MGHG | 13,938 | 7.00% | **975** |
| 741 | REEI | 27,775 | 5.00% | **1,388** |
| 1726 | RJCC | 29,790 | 5.00% | **1,489** |
| 866 | METI | 38,536 | 5.00% | **1,926** |
| 1672 | GAST | 41,323 | 5.00% | **2,066** |
| 1723 | RMJA | 49,383 | 5.00% | **2,469** |
| 1811 | BPGA | 164,460 | 5.00% | **8,223** |
| 685 | JMAR | 183,506 | 5.00% | **9,175** |
| 930 | AERO | 199,295 | 5.00% | **9,964** |
| 2098 | YESP | 234,104 | 5.00% | **11,705** |
| 1583 | DLM | 88,854 | 15.37% | **13,656** |
| 1855 | KITA | 383,396 | 5.00% | **19,169** |
| 1858 | YOLA | 526,541 | 5.00% | **26,327** |
| 1758 | LABO | 169,189 | 20.00% | **33,837** |
| 1602 | SITR | 298,939 | 11.65% | **34,826** |
| 1948 | ALCO | 623,196 | 11.65% | **72,602** |
| 1747 | COFA | 1,869,694 | 5.00% | **93,484** |

## 3. Fase 1: Respaldo de Seguridad
Antes de cualquier modificación, se debe crear una copia de la tabla histórica.

```sql
SELECT * INTO sat_logging.dbo.log_resumen_licencias_his_PRE_DEPU 
FROM sat_logging.dbo.log_resumen_licencias_his;
```

## 4. Fase 2: Ejecución de Depuración (Emisor por Emisor)

El siguiente script debe ejecutarse de forma individual para cada emisor. Se debe configurar el `@IdEmisor` y la `@Cuota` según la tabla del punto 2.

```sql
DECLARE @IdEmisor INT = 1758; -- Cambiar según tabla
DECLARE @Cuota INT = 33837;   -- Cambiar según tabla

-- 1. Verificación previa de registros a eliminar
;WITH CTE_RunningTotal AS (
    SELECT 
        IdEmisor, Periodo, Establecimiento, Punto, ok,
        SUM(ok) OVER (ORDER BY Periodo ASC, Establecimiento, Punto) AS Acumulado
    FROM sat_logging.dbo.log_resumen_licencias_his
    WHERE IdEmisor = @IdEmisor
)
SELECT * FROM CTE_RunningTotal WHERE Acumulado <= @Cuota;

-- 2. Eliminación (Descomentar para ejecutar)
/*
DELETE FROM H
FROM sat_logging.dbo.log_resumen_licencias_his H
INNER JOIN (
    SELECT Periodo, Establecimiento, Punto
    FROM (
        SELECT Periodo, Establecimiento, Punto,
        SUM(ok) OVER (ORDER BY Periodo ASC, Establecimiento, Punto) AS Acumulado
        FROM sat_logging.dbo.log_resumen_licencias_his
        WHERE IdEmisor = @IdEmisor
    ) AS T
    WHERE T.Acumulado <= @Cuota
) AS Filtro ON H.Periodo = Filtro.Periodo 
           AND H.Establecimiento = Filtro.Establecimiento 
           AND H.Punto = Filtro.Punto
WHERE H.IdEmisor = @IdEmisor;
*/
```

## 5. Fase 3: Validación Final
Una vez terminada la depuración de todos los emisores, el SP `splog_poblar_licecias_diaria` ya no necesitará los multiplicadores de descuento (`*0.95`, etc.) y podrá ser actualizado a una lógica de suma directa (1.0).

---
*Manual generado el 2026-04-28 por Antigravity.*
