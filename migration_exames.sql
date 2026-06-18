CREATE TABLE IF NOT EXISTS exames_paciente (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data        date NOT NULL DEFAULT CURRENT_DATE,
  nome        text NOT NULL,
  texto       text,
  arquivo_url text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE exames_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutri_select_exame" ON exames_paciente
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = exames_paciente.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_insert_exame" ON exames_paciente
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = exames_paciente.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_update_exame" ON exames_paciente
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = exames_paciente.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_delete_exame" ON exames_paciente
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = exames_paciente.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS resultados_exames (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nutri_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome         text NOT NULL,
  arquivo_url  text,
  arquivo_path text,
  lido_nutri   boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE resultados_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_insert_resultado_exame" ON resultados_exames
  FOR INSERT TO authenticated
  WITH CHECK (paciente_id = auth.uid());

CREATE POLICY "paciente_select_resultado_exame" ON resultados_exames
  FOR SELECT TO authenticated
  USING (paciente_id = auth.uid());

CREATE POLICY "nutri_select_resultado_exame" ON resultados_exames
  FOR SELECT TO authenticated
  USING (nutri_id = auth.uid());

CREATE POLICY "nutri_update_resultado_exame" ON resultados_exames
  FOR UPDATE TO authenticated
  USING  (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "nutri_upload_exame" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] = 'exames'
    AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_read_exame_proprio" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] = 'exames'
    AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_read_resultado_exame" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "paciente_upload_resultado_exame" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] != 'exames'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = auth.uid()
        AND p.nutri_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "paciente_read_resultado_exame" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] != 'exames'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
