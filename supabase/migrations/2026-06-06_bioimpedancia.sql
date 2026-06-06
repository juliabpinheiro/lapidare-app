-- Adiciona campos de bioimpedância em peso_registros
ALTER TABLE peso_registros
  ADD COLUMN IF NOT EXISTS agua_corporal  numeric,      -- % água corporal
  ADD COLUMN IF NOT EXISTS idade_metabolica int,        -- idade metabólica (anos)
  ADD COLUMN IF NOT EXISTS laudo_url       text;        -- URL do laudo (foto/PDF no storage)

-- Bucket para laudos de bioimpedância (executar também no dashboard Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('laudos','laudos',false)
-- ON CONFLICT (id) DO NOTHING;

-- Policy: nutri faz upload/leitura dos laudos dos seus pacientes
-- (Adicionar via dashboard Supabase > Storage > Policies)
