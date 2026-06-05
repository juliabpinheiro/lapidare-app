-- =============================================================
-- LAPIDARE · Novas tabelas: mapa_geral + registro_consultas
-- =============================================================
-- Cole no Supabase → SQL Editor → New query → Run
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =============================================================


-- =============================================================
-- 1. MAPA GERAL DA PACIENTE
-- Uma linha por (paciente, nutri) — upsert no app.
-- Campos livres armazenados em `dados` (jsonb):
--   objetivo_principal, historico_relevante, restricoes,
--   medicamentos, outras_obs
-- =============================================================
create table if not exists public.mapa_geral (
  id           uuid        primary key default gen_random_uuid(),
  paciente_id  uuid        not null references public.pacientes(id) on delete cascade,
  nutri_id     uuid        not null references public.nutris(id)    on delete cascade,
  dados        jsonb       not null default '{}',
  updated_at   timestamptz not null default now(),
  constraint mapa_geral_paciente_nutri_uniq unique (paciente_id, nutri_id)
);
create index if not exists mapa_geral_paciente_idx on public.mapa_geral(paciente_id);
create index if not exists mapa_geral_nutri_idx    on public.mapa_geral(nutri_id);

alter table public.mapa_geral enable row level security;

-- Nutri cria/lê/atualiza o mapa das próprias pacientes
drop policy if exists "nutri gerencia mapa_geral"    on public.mapa_geral;
create policy "nutri gerencia mapa_geral"
  on public.mapa_geral for all
  using  (auth.uid() = nutri_id)
  with check (auth.uid() = nutri_id);


-- =============================================================
-- 2. REGISTRO DE CONSULTAS (histórico clínico estruturado)
-- Diferente de `consultas` (agenda/agendamento).
-- Esta tabela guarda o conteúdo clínico de cada sessão.
-- Campos opcionais de vínculo: anamnese_id, plano_id.
-- Conteúdo livre em `dados` (jsonb):
--   { obs, calculo, suplementos }
-- =============================================================
create table if not exists public.registro_consultas (
  id              uuid        primary key default gen_random_uuid(),
  paciente_id     uuid        not null references public.pacientes(id) on delete cascade,
  nutri_id        uuid        not null references public.nutris(id)    on delete cascade,
  data_consulta   date        not null default current_date,
  objetivo        text,
  peso_kg         numeric(5,2),
  anamnese_id     uuid        references public.anamneses(id)  on delete set null,
  plano_id        uuid        references public.planos(id)     on delete set null,
  dados           jsonb       not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists registro_consultas_paciente_idx
  on public.registro_consultas(paciente_id, data_consulta);
create index if not exists registro_consultas_nutri_idx
  on public.registro_consultas(nutri_id);

alter table public.registro_consultas enable row level security;

-- Nutri vê e gerencia consultas das próprias pacientes
drop policy if exists "nutri gerencia registro_consultas" on public.registro_consultas;
create policy "nutri gerencia registro_consultas"
  on public.registro_consultas for all
  using  (auth.uid() = nutri_id)
  with check (auth.uid() = nutri_id);

-- Paciente visualiza apenas as próprias consultas (read-only)
drop policy if exists "paciente vê registro_consultas" on public.registro_consultas;
create policy "paciente vê registro_consultas"
  on public.registro_consultas for select
  using (auth.uid() = paciente_id);
