-- =============================================================
-- Migration 2026-06-03c
-- Cadastro direto de paciente (sem convite / sem senha imediata)
-- =============================================================
-- A nutri preenche todos os dados e salva direto.
-- A paciente pode criar a senha depois via "Esqueci minha senha".
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

-- 1. obs na tabela pacientes (já existe em pacientes_pendentes, agora vai pra pacientes também)
alter table public.pacientes add column if not exists obs text;

-- 2. Função principal: cria o usuário auth + identidade + paciente em uma transação
--    Roda como postgres (security definer) pra ter acesso ao schema auth.
create or replace function public.cadastrar_paciente_direto(
  p_nome       text,
  p_email      text,
  p_nascimento date    default null,
  p_objetivo   text    default null,
  p_tipo_plano text    default null,
  p_modalidade text    default null,
  p_obs        text    default null
)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_nutri_id uuid := auth.uid();
  v_user_id  uuid := gen_random_uuid();
  -- Senha aleatória forte — a paciente nunca a vê; usa "Esqueci minha senha" quando quiser acessar
  v_senha    text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  -- Só nutri pode chamar esta função
  if not exists (select 1 from public.nutris where id = v_nutri_id) then
    raise exception 'Apenas nutricionistas podem cadastrar pacientes.';
  end if;

  -- Impede duplicata de email para a mesma nutri
  if exists (
    select 1 from public.pacientes
    where nutri_id = v_nutri_id and lower(email) = lower(p_email)
  ) then
    raise exception 'Já existe uma paciente cadastrada com este email.';
  end if;

  -- Impede duplicata global em auth.users
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Este email já possui uma conta no sistema.';
  end if;

  -- Cria usuário no Supabase Auth diretamente (sem enviar email de confirmação)
  -- email_confirmed_at = now() → conta já confirmada, pronta para "Esqueci minha senha"
  insert into auth.users (
    id, aud, role, email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(v_senha, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'role',       'paciente',
      'nutri_id',   v_nutri_id,
      'nome',       p_nome,
      'nascimento', p_nascimento,
      'objetivo',   p_objetivo,
      'tipo_plano', p_tipo_plano,
      'modalidade', p_modalidade
    ),
    now(), now()
  );

  -- Cria a identidade de email — necessário para o fluxo de "Esqueci minha senha"
  -- Tenta a coluna provider_id (Supabase GoTrue ≥ v2); fallback ignora erro
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
      'email',
      now(), now(), now()
    );
  exception when others then
    -- Schema de identities mais antigo (coluna "id" ao invés de "provider_id")
    begin
      insert into auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
        'email',
        now(), now(), now()
      );
    exception when others then
      null; -- identities falhou mas o usuário já foi criado; continua
    end;
  end;

  -- O trigger handle_new_user acabou de criar o row em public.pacientes.
  -- Atualiza obs (que o trigger não cobre).
  if p_obs is not null and p_obs <> '' then
    update public.pacientes set obs = p_obs where id = v_user_id;
  end if;

  return jsonb_build_object('id', v_user_id, 'email', lower(p_email), 'nome', p_nome);
end;
$$;

grant execute on function public.cadastrar_paciente_direto(text, text, date, text, text, text, text)
  to authenticated;
