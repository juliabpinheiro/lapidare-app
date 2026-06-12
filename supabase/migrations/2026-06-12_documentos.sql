-- ── 1. Tabela de metadados ──────────────────────────────────────────────
create table if not exists public.documentos_nutri (
  id          uuid        primary key default gen_random_uuid(),
  nutri_id    uuid        not null references public.nutris(id) on delete cascade,
  nome        text        not null,
  arquivo     text        not null,
  path        text        not null unique,
  mime_type   text,
  tamanho     bigint,
  created_at  timestamptz not null default now()
);

create index if not exists documentos_nutri_idx
  on public.documentos_nutri(nutri_id, created_at desc);

alter table public.documentos_nutri enable row level security;

drop policy if exists documentos_nutri_own on public.documentos_nutri;
create policy documentos_nutri_own on public.documentos_nutri
  for all using (nutri_id = auth.uid());

-- ── 2. Storage bucket (privado, 50 MB) ──────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-nutri',
  'documentos-nutri',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- ── 3. Storage RLS: nutri acessa apenas a própria pasta (path = nutri_id/…) ──
drop policy if exists "Nutri acessa próprios documentos" on storage.objects;
create policy "Nutri acessa próprios documentos"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'documentos-nutri'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documentos-nutri'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
