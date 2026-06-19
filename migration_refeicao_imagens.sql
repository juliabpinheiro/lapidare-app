-- Bucket de imagens do plano: criar no Supabase Dashboard > Storage
-- Nome: plano-imagens  |  Público: true

CREATE TABLE IF NOT EXISTS refeicao_imagens (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  refeicao_id  text NOT NULL,
  nutri_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paciente_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url          text NOT NULL,
  path         text NOT NULL,
  ordem        int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE refeicao_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutri_select_refeicao_imagens" ON refeicao_imagens
  FOR SELECT TO authenticated USING (nutri_id = auth.uid());

CREATE POLICY "nutri_insert_refeicao_imagens" ON refeicao_imagens
  FOR INSERT TO authenticated WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "nutri_delete_refeicao_imagens" ON refeicao_imagens
  FOR DELETE TO authenticated USING (nutri_id = auth.uid());

CREATE POLICY "paciente_select_refeicao_imagens" ON refeicao_imagens
  FOR SELECT TO authenticated USING (paciente_id = auth.uid());
