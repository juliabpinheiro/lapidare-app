-- =============================================================
-- Migration 2026-06-10
-- Adiciona cor_nav_divider e cor_nav_active à tabela nutris
-- Controlam divisórias e item ativo do menu lateral da nutri
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

alter table public.nutris
  add column if not exists cor_nav_divider text,
  add column if not exists cor_nav_active  text;
