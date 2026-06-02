-- =====================================================================
-- Migración: Tabla de reglas de alerta SEQ (usa seq_conexiones existente)
-- Proyecto: SATCOM - Monitoreo SEQ
-- =====================================================================

CREATE TABLE IF NOT EXISTS sat_monitoreo.seq_alertas_config (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT         NOT NULL,
  query_filter    TEXT         NOT NULL,
  -- Si es NULL o vacío, aplica a TODAS las conexiones de seq_conexiones
  -- Si contiene UUIDs, aplica solo a esas conexiones
  conexiones_ids  UUID[]       DEFAULT NULL,
  umbrales        JSONB        NOT NULL DEFAULT '{
    "timeWindowMinutes": 1,
    "clientEventsThreshold": 5,
    "serverEventsThreshold": 30,
    "serverClientsThreshold": 1
  }',
  es_activo       BOOLEAN      NOT NULL DEFAULT true,
  creado_por      TEXT         DEFAULT 'sistema@mysatcomla.com',
  actualizado_por TEXT         DEFAULT 'sistema@mysatcomla.com',
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seq_alertas_activo
  ON sat_monitoreo.seq_alertas_config(es_activo);

COMMENT ON TABLE sat_monitoreo.seq_alertas_config IS
  'Reglas de alerta para el workflow n8n SEQ - MonitoreoAlertas. Las conexiones provienen de seq_conexiones.';
COMMENT ON COLUMN sat_monitoreo.seq_alertas_config.conexiones_ids IS
  'NULL = aplica a todas las conexiones activas. Array de UUIDs = solo esas conexiones de seq_conexiones.';

-- =====================================================================
-- Regla de ejemplo
-- =====================================================================
INSERT INTO sat_monitoreo.seq_alertas_config (nombre, query_filter, umbrales)
VALUES (
  'Error Envio apiClientUrl',
  '@Message like ''%ERROR en la conexión al enviar comprobante%'' and @Timestamp >= Now() - 1h',
  '{"timeWindowMinutes": 60, "clientEventsThreshold": 5, "serverEventsThreshold": 30, "serverClientsThreshold": 1}'
)
ON CONFLICT DO NOTHING;
