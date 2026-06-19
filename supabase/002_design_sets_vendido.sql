-- supabase/002_design_sets_vendido.sql
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Distingue disenos generados (siempre se guardan) de los efectivamente vendidos.

ALTER TABLE design_sets ADD COLUMN IF NOT EXISTS vendido BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dsn_vendido ON design_sets(vendido);
