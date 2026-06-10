-- =============================================================
-- Migration 2026-06-10
-- Adiciona cor_input_text à tabela nutris
-- Controla a cor do texto digitado nos campos de formulário
-- via CSS variable --input-text-color
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

alter table public.nutris
  add column if not exists cor_input_text text;
