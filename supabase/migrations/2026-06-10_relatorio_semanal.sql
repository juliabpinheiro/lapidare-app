-- Relatório semanal automático (toda semana, resposta livre da paciente)
-- Cole no SQL Editor do Supabase e clique em Run.

create table if not exists public.relatorio_semanal (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null,
  nutri_id      uuid,
  semana_inicio date not null,
  pergunta      text not null,
  resposta      text,
  respondido_em timestamptz,
  created_at    timestamptz not null default now(),
  unique (paciente_id, semana_inicio)
);
