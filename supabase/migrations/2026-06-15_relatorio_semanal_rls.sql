-- RLS para relatorio_semanal
-- Cole no SQL Editor do Supabase e clique em Run.

alter table public.relatorio_semanal enable row level security;

-- Paciente pode inserir e ler seus próprios relatórios
create policy "paciente pode inserir seu relatorio"
  on public.relatorio_semanal for insert
  with check (auth.uid() = paciente_id);

create policy "paciente pode ler seu relatorio"
  on public.relatorio_semanal for select
  using (auth.uid() = paciente_id);

-- Nutri pode ler relatórios de suas pacientes
create policy "nutri pode ler relatorios de suas pacientes"
  on public.relatorio_semanal for select
  using (auth.uid() = nutri_id);
