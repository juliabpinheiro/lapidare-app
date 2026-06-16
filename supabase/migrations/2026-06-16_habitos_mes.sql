-- =============================================================
-- Migration 2026-06-16
-- Tabela habitos_mes: grid de check diário mensal de hábitos
-- preenchido pela própria paciente, visível em modo leitura pela nutri.
-- =============================================================
-- Idempotente. Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

create table if not exists public.habitos_mes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  ano int not null,
  mes int not null,
  habitos jsonb not null default '[]',
  checks jsonb not null default '{}',
  campos jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(paciente_id, ano, mes)
);

alter table public.habitos_mes enable row level security;

drop policy if exists "habitos_paciente_all" on public.habitos_mes;
create policy "habitos_paciente_all" on public.habitos_mes
  for all to authenticated
  using (auth.uid() = paciente_id)
  with check (auth.uid() = paciente_id);

drop policy if exists "habitos_nutri_select" on public.habitos_mes;
create policy "habitos_nutri_select" on public.habitos_mes
  for select to authenticated
  using (exists (
    select 1 from public.pacientes p
    where p.id = paciente_id and p.nutri_id = auth.uid()
  ));
