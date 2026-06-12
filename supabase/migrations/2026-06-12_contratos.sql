-- ── 1. Campos novos em pacientes ───────────────────────────────────────
alter table public.pacientes
  add column if not exists valor_plano numeric(10,2);

-- ── 2. Tabela de contratos ──────────────────────────────────────────────
create table if not exists public.contratos_pacientes (
  id           uuid        primary key default gen_random_uuid(),
  paciente_id  uuid        not null references public.pacientes(id) on delete cascade,
  nutri_id     uuid        not null references public.nutris(id) on delete cascade,
  tipo_plano   text        not null check (tipo_plano in ('avulso', 'trimestral', 'semestral')),
  valor        numeric(10,2) not null,
  data_inicio  date        not null,
  data_aceite  timestamptz,
  ip_aceite    text,
  aceito       boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists contratos_paciente_idx
  on public.contratos_pacientes(paciente_id, created_at desc);

-- ── 3. RLS ──────────────────────────────────────────────────────────────
alter table public.contratos_pacientes enable row level security;

-- Paciente: lê e aceita o próprio contrato
drop policy if exists contratos_paciente_select on public.contratos_pacientes;
create policy contratos_paciente_select on public.contratos_pacientes
  for select using (paciente_id = auth.uid());

drop policy if exists contratos_paciente_update on public.contratos_pacientes;
create policy contratos_paciente_update on public.contratos_pacientes
  for update using (paciente_id = auth.uid());

-- Nutri: total das próprias pacientes
drop policy if exists contratos_nutri_all on public.contratos_pacientes;
create policy contratos_nutri_all on public.contratos_pacientes
  for all using (nutri_id = auth.uid());
