-- supabase/003_leads.sql
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Leads capturados por el gate de descarga/lectura de ebooks (/ebooks/**).
-- Se escribe solo desde api/notify.js (action=ebook_lead) con el service role.

CREATE TABLE IF NOT EXISTS leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                TEXT NOT NULL,
  apellido              TEXT NOT NULL,
  email                 TEXT NOT NULL,
  telefono              TEXT NOT NULL,
  origen                TEXT NOT NULL,            -- 'ebook'
  recurso_slug          TEXT,                     -- 'inteligencia-artificial'
  accion                TEXT,                     -- 'leer' | 'descargar'
  acepta_marketing      BOOLEAN NOT NULL DEFAULT FALSE,
  consent_texto_version TEXT,                     -- version del texto legal aceptado ('v1')
  ip                    TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Sin UNIQUE en email a proposito: la misma persona puede bajar varios ebooks y
-- cada descarga es una senal comercial distinta. Deduplicar en la consulta.
CREATE INDEX IF NOT EXISTS idx_leads_email  ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_origen ON leads(origen, recurso_slug);

-- Igual que clients/design_sets: el acceso es solo server-side (service role).
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
