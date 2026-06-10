-- Tabela de recibos enviados pela nutri para a paciente
-- Cole no SQL Editor do Supabase e clique em Run.

create table if not exists public.recibos_paciente (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null,
  nutri_id    uuid not null,
  nome        text not null,
  arquivo_url text not null,
  created_at  timestamptz not null default now()
);
