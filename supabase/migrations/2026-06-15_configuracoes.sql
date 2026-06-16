-- =============================================================
-- Migration 2026-06-15
-- Tabela configuracoes: cores personalizadas do app da paciente
-- salvas pela nutricionista no painel de personalização.
-- =============================================================
-- Idempotente. Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

-- 1. Cria a tabela (caso não exista ainda)
create table if not exists public.configuracoes (
  id         uuid primary key default gen_random_uuid(),
  nutri_id   uuid not null unique references public.nutris(id) on delete cascade,
  tema       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 2. Habilita RLS
alter table public.configuracoes enable row level security;

-- 3. Nutri gerencia a própria linha
drop policy if exists "nutri gerencia suas configuracoes" on public.configuracoes;
create policy "nutri gerencia suas configuracoes"
  on public.configuracoes for all
  using  (auth.uid() = nutri_id)
  with check (auth.uid() = nutri_id);

-- 4. Paciente lê as configurações da nutri vinculada
drop policy if exists "paciente le configuracoes da nutri" on public.configuracoes;
create policy "paciente le configuracoes da nutri"
  on public.configuracoes for select
  using (
    exists (
      select 1 from public.pacientes
      where id = auth.uid()
        and nutri_id = configuracoes.nutri_id
    )
  );
