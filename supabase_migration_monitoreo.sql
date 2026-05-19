-- Migración para el sistema de Monitoreo (Reglas Automáticas)
-- Ejecutar en el SQL Editor de Supabase (Dashboard Web)

CREATE SCHEMA IF NOT EXISTS sat_monitoreo;

CREATE TABLE IF NOT EXISTS sat_monitoreo.reglas_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  ambiente TEXT NOT NULL, -- 'V5', 'Panama', 'Colombia', 'Todos'
  expresion_estado TEXT NOT NULL, -- Ej: 'PendienteValidacionSATCOM' o '*'
  expresion_motivo TEXT NOT NULL, -- Ej: 'Establecimiento/Punto no configurado' o '.*'
  minimo_eventos INTEGER DEFAULT 1,
  modo TEXT NOT NULL CHECK (modo IN ('POR_EMISOR', 'GLOBAL')),
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('DIARIO', 'SEMANAL', 'MENSUAL', 'HORARIO', 'TIEMPO_REAL')),
  prioridad_ticket TEXT NOT NULL DEFAULT 'Media',
  departamento_id TEXT NOT NULL DEFAULT '816030000000006907',
  area TEXT NOT NULL DEFAULT 'Soporte',
  esta_activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Opcional, recomendado para seguridad)
ALTER TABLE sat_monitoreo.reglas_alertas ENABLE ROW LEVEL SECURITY;

-- Política permisiva para lectura/escritura (ajustar según el rol de autenticación si se usa Auth de Supabase)
CREATE POLICY "Permitir acceso total" ON sat_monitoreo.reglas_alertas FOR ALL USING (true) WITH CHECK (true);
