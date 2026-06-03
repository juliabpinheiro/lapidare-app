-- =============================================================
-- Migration 2026-06-03
-- Adiciona cor_texto à tabela nutris
-- Controla a cor do texto principal (--ink) em todo o app
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

-- 1. Nova coluna
alter table public.nutris
  add column if not exists cor_texto text default '#000000';

-- 2. Atualiza nutris já existentes que não têm valor definido
update public.nutris
  set cor_texto = '#000000'
  where cor_texto is null;

-- 3. Recria buscar_personalizacao_nutri incluindo cor_texto
drop function if exists public.buscar_personalizacao_nutri(uuid);
create or replace function public.buscar_personalizacao_nutri(p_nutri_id uuid)
returns table(
  marca_nome text, marca_subtitulo text, logo_url text,
  cor_primaria text, cor_secundaria text, cor_texto text, tipografia text,
  mensagem_login text, mensagem_termo text, cor_texto_sidebar text,
  nutri_nome text, nutri_foto_url text
)
language sql security definer set search_path = public
as $$
  select
    coalesce(marca_nome,    'Lapidare')  as marca_nome,
    marca_subtitulo,
    logo_url,
    coalesce(cor_primaria,   '#a08456')  as cor_primaria,
    coalesce(cor_secundaria, '#c9a96e')  as cor_secundaria,
    coalesce(cor_texto,      '#000000')  as cor_texto,
    coalesce(tipografia,     'classica') as tipografia,
    mensagem_login,
    mensagem_termo,
    cor_texto_sidebar,
    coalesce(nome, 'Sua nutri')          as nutri_nome,
    foto_url                             as nutri_foto_url
  from public.nutris
  where id = p_nutri_id
  limit 1;
$$;
grant execute on function public.buscar_personalizacao_nutri(uuid) to anon, authenticated;

-- 4. Recria buscar_marca_principal incluindo cor_texto
drop function if exists public.buscar_marca_principal();
create or replace function public.buscar_marca_principal()
returns table(
  marca_nome text, marca_subtitulo text, logo_url text,
  cor_primaria text, cor_secundaria text, cor_texto text, tipografia text,
  mensagem_login text, cor_texto_sidebar text
)
language sql security definer set search_path = public
as $$
  select
    coalesce(marca_nome,    'Lapidare')  as marca_nome,
    marca_subtitulo,
    logo_url,
    coalesce(cor_primaria,   '#a08456')  as cor_primaria,
    coalesce(cor_secundaria, '#c9a96e')  as cor_secundaria,
    coalesce(cor_texto,      '#000000')  as cor_texto,
    coalesce(tipografia,     'classica') as tipografia,
    mensagem_login,
    cor_texto_sidebar
  from public.nutris
  order by created_at
  limit 1;
$$;
grant execute on function public.buscar_marca_principal() to anon, authenticated;
