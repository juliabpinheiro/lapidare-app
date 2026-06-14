-- Tabela de alimentos digitados manualmente pela nutricionista
create table if not exists public.alimentos_personalizados (
  id         uuid        primary key default gen_random_uuid(),
  nutri_id   uuid        not null references public.nutris(id) on delete cascade,
  nome       text        not null,
  qty        text        not null default '',
  kcal       numeric(8,1),
  prot_g     numeric(8,1),
  cho_g      numeric(8,1),
  lip_g      numeric(8,1),
  created_at timestamptz not null default now()
);

create index if not exists alimentos_personalizados_nutri_idx
  on public.alimentos_personalizados(nutri_id, created_at desc);

alter table public.alimentos_personalizados enable row level security;

drop policy if exists alimentos_personalizados_own on public.alimentos_personalizados;
create policy alimentos_personalizados_own on public.alimentos_personalizados
  for all using (nutri_id = auth.uid());
