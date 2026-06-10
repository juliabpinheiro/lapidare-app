-- Inativação de paciente (sem deletar dados)
-- Cole no SQL Editor do Supabase e clique em Run.

alter table public.pacientes
  add column if not exists ativo boolean not null default true;
