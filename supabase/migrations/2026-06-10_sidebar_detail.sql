-- =============================================================
-- Migration 2026-06-10
-- Adiciona cor_sidebar_detail à tabela nutris
-- Controla textos e detalhes do menu lateral (marca, subtítulo,
-- rodapé, botão Sair, linha divisória superior e botão <)
-- via CSS variable --sidebar-detail-color
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

alter table public.nutris
  add column if not exists cor_sidebar_detail text;
