-- Migración para el sistema de alertas de RabbitMQ
-- Ejecutar en el SQL Editor de Supabase (Dashboard Web)

CREATE TABLE IF NOT EXISTS sat_monitoreo.rabbit_alertas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente TEXT NOT NULL,          -- Ej: 'V5-EC', 'Testing', 'ColombiaAWS'
  nombre_cola TEXT NOT NULL,       -- Nombre de la cola o '*' para un límite genérico
  limite_mensajes INTEGER NOT NULL DEFAULT 100,
  esta_activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE sat_monitoreo.rabbit_alertas_config ENABLE ROW LEVEL SECURITY;

-- Política permisiva
CREATE POLICY "Permitir acceso total rabbit" ON sat_monitoreo.rabbit_alertas_config FOR ALL USING (true) WITH CHECK (true);
