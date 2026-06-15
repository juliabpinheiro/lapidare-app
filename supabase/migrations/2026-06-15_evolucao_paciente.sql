-- RLS e storage para pacientes enviarem fotos de evolução

-- ── Table RLS ──────────────────────────────────────────────────

drop policy if exists "evolucao_paciente_select" on public.fotos_evolucao;
create policy "evolucao_paciente_select"
  on public.fotos_evolucao for select
  using (auth.uid() = paciente_id);

drop policy if exists "evolucao_paciente_insert" on public.fotos_evolucao;
create policy "evolucao_paciente_insert"
  on public.fotos_evolucao for insert
  with check (
    auth.uid() = paciente_id
    and nutri_id = (select nutri_id from public.pacientes where id = auth.uid())
  );

drop policy if exists "evolucao_paciente_delete" on public.fotos_evolucao;
create policy "evolucao_paciente_delete"
  on public.fotos_evolucao for delete
  using (auth.uid() = paciente_id);

-- ── Ampliar CHECK constraint de tipo (adiciona 'lado') ─────────

do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'fotos_evolucao_tipo_check'
    and constraint_schema = 'public'
  ) then
    alter table public.fotos_evolucao drop constraint fotos_evolucao_tipo_check;
    alter table public.fotos_evolucao
      add constraint fotos_evolucao_tipo_check
      check (tipo in ('frente', 'lado', 'costas', 'perfil_direito', 'perfil_esquerdo', 'livre'));
  end if;
end $$;

-- ── Storage policies ────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('fotos_evolucao', 'fotos_evolucao', false)
  on conflict (id) do nothing;

drop policy if exists "evolucao_storage_paciente_insert" on storage.objects;
create policy "evolucao_storage_paciente_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos_evolucao'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "evolucao_storage_paciente_select" on storage.objects;
create policy "evolucao_storage_paciente_select"
  on storage.objects for select
  using (
    bucket_id = 'fotos_evolucao'
    and (
      auth.uid()::text = (string_to_array(name, '/'))[1]
      or exists (
        select 1 from public.pacientes p
        where p.id::text = (string_to_array(name, '/'))[1]
          and p.nutri_id = auth.uid()
      )
    )
  );

drop policy if exists "evolucao_storage_paciente_update" on storage.objects;
create policy "evolucao_storage_paciente_update"
  on storage.objects for update
  using (
    bucket_id = 'fotos_evolucao'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
