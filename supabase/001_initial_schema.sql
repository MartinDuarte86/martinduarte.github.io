-- supabase/001_initial_schema.sql
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Reemplaza clientes.json y dsn/index.json del repo GitHub

-- ─── Tabla de clientes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           TEXT UNIQUE NOT NULL,
  email                TEXT,
  nombre_marca         TEXT,
  rubro                TEXT,
  template_elegido     TEXT,
  estado               TEXT DEFAULT 'iniciado',
  -- Estados posibles: iniciado | evaluando | onboarding | diseños_generados
  --                   pago_pendiente | pagado | aprobado | rechazado
  mp_external_reference TEXT,          -- para matchear pagos de MP manualmente
  full_brief           JSONB,          -- todos los datos recolectados del cliente
  gist_id              TEXT,           -- GitHub Gist del preview (si se usa)
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clients_email      ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_session_id ON clients(session_id);
CREATE INDEX IF NOT EXISTS idx_clients_estado      ON clients(estado);

-- Trigger para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Tabla de design sets (DSN — diseños anteriores) ──────────────────────
-- Reemplaza dsn/index.json + dsn/<id>/meta.json del repo
CREATE TABLE IF NOT EXISTS design_sets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  session_id   TEXT,
  rubro        TEXT NOT NULL,
  template_name TEXT NOT NULL,
  -- Los HTMLs se guardan en Redis (TTL 48h) mientras la sesión está activa.
  -- Al expirar la sesión, se mueven aquí como "diseños anteriores" para preview.
  -- Guardamos solo metadata + referencia; el HTML puede ir a Vercel Blob en v2.
  html_preview TEXT,       -- HTML del diseño (puede ser grande; migrar a Blob en v2)
  thumbnail_url TEXT,      -- URL de screenshot (opcional, para el carousel DSN)
  visible_en_carousel BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsn_rubro     ON design_sets(rubro);
CREATE INDEX IF NOT EXISTS idx_dsn_visible   ON design_sets(visible_en_carousel);
CREATE INDEX IF NOT EXISTS idx_dsn_client_id ON design_sets(client_id);

-- RLS (Row Level Security) — desactivado para acceso solo desde servidor
-- Las funciones serverless usan service_role key que bypasea RLS automáticamente.
-- Si en el futuro se usa desde el browser, activar RLS con políticas apropiadas.
ALTER TABLE clients     DISABLE ROW LEVEL SECURITY;
ALTER TABLE design_sets DISABLE ROW LEVEL SECURITY;
