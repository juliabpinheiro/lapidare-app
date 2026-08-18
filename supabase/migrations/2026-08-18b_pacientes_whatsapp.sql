-- =============================================================
-- Migration 2026-08-18b
-- Adiciona campo de WhatsApp em public.pacientes, usado pelo
-- botão de WhatsApp na listagem de pacientes (Pacientes.jsx).
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

alter table public.pacientes add column if not exists whatsapp text;
