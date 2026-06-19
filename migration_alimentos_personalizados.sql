-- Tabela de alimentos personalizados da nutricionista
CREATE TABLE IF NOT EXISTS alimentos_personalizados (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nutri_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome       text NOT NULL,
  qty        text,
  kcal       numeric,
  prot_g     numeric,
  cho_g      numeric,
  lip_g      numeric,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE alimentos_personalizados ENABLE ROW LEVEL SECURITY;

-- Nutricionista vê apenas seus próprios alimentos
CREATE POLICY "nutri_select_alimentos_personalizados" ON alimentos_personalizados
  FOR SELECT TO authenticated
  USING (nutri_id = auth.uid());

-- Nutricionista insere apenas para si mesma
CREATE POLICY "nutri_insert_alimentos_personalizados" ON alimentos_personalizados
  FOR INSERT TO authenticated
  WITH CHECK (nutri_id = auth.uid());

-- Nutricionista atualiza apenas seus próprios alimentos
CREATE POLICY "nutri_update_alimentos_personalizados" ON alimentos_personalizados
  FOR UPDATE TO authenticated
  USING  (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- Nutricionista exclui apenas seus próprios alimentos
CREATE POLICY "nutri_delete_alimentos_personalizados" ON alimentos_personalizados
  FOR DELETE TO authenticated
  USING (nutri_id = auth.uid());
