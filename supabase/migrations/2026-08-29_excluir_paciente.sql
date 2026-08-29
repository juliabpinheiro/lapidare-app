-- =============================================================
-- Migration 2026-08-29
-- Exclusão definitiva de paciente + mensagem de erro mais clara
-- quando o email já está em uso.
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

-- 1. cadastrar_paciente_direto: mensagem específica quando o email
--    já pertence a uma paciente da própria nutri (orienta a excluir
--    a paciente antiga em vez de só dizer "email já existe").
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
  v_nutri_id uuid;
  v_user_id  uuid := gen_random_uuid();
begin
  v_nutri_id := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';

  if v_nutri_id is null then
    raise exception 'Sessão inválida. Faça login novamente.';
  end if;

  if not exists (select 1 from public.nutris where id = v_nutri_id) then
    raise exception 'Apenas nutricionistas podem cadastrar pacientes.';
  end if;

  if exists (
    select 1 from public.pacientes
    where nutri_id = v_nutri_id and lower(email) = lower(p_email)
  ) then
    raise exception 'Já existe uma paciente cadastrada com este email.';
  end if;

  if exists (select 1 from auth.users where email = lower(p_email)) then
    if exists (
      select 1 from public.pacientes
      where lower(email) = lower(p_email) and nutri_id = v_nutri_id
    ) then
      raise exception 'Este email já pertence a uma paciente sua (pode estar inativa). Pra reaproveitar o email, exclua definitivamente a paciente antiga primeiro (perfil da paciente → menu → Excluir paciente).';
    else
      raise exception 'Este email já possui uma conta no sistema (de outra nutricionista ou paciente). Peça pra ela usar outro email.';
    end if;
  end if;

  -- Cria usuário no Auth com senha padrão 12345 e email já confirmado
  insert into auth.users (
    id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, 'authenticated', 'authenticated', lower(p_email),
    crypt('12345', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'paciente'),
    now(), now()
  );

  -- Cria identidade de email (necessário para "Esqueci minha senha")
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
      'email', now(), now(), now()
    );
  exception when others then
    begin
      insert into auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id::text, v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
        'email', now(), now(), now()
      );
    exception when others then null;
    end;
  end;

  -- Insere em public.pacientes com nutri_id garantido
  insert into public.pacientes (
    id, nutri_id, nome, email,
    objetivo, tipo_plano, modalidade, nascimento, obs
  ) values (
    v_user_id, v_nutri_id, p_nome, lower(p_email),
    p_objetivo, p_tipo_plano, p_modalidade, p_nascimento,
    nullif(trim(coalesce(p_obs, '')), '')
  )
  on conflict (id) do update set
    nutri_id   = excluded.nutri_id,
    nome       = excluded.nome,
    objetivo   = excluded.objetivo,
    tipo_plano = excluded.tipo_plano,
    modalidade = excluded.modalidade,
    nascimento = excluded.nascimento,
    obs        = excluded.obs;

  return jsonb_build_object('id', v_user_id, 'email', lower(p_email), 'nome', p_nome);
end;
$$;

grant execute on function public.cadastrar_paciente_direto(text, text, date, text, text, text, text)
  to authenticated;


-- 2. excluir_paciente_direto: apaga em cascata auth.users, auth.identities,
--    public.pacientes e todas as tabelas clínicas relacionadas (peso_registros,
--    habitos, habitos_logs, checkin_envios, anamneses, fotos_evolucao, etc.),
--    via ON DELETE CASCADE já existente em cada uma delas.
--    Exceções tratadas à parte:
--      • vendas.paciente_id é ON DELETE SET NULL — histórico financeiro fica preservado
--      • recibos_paciente não tem FK — apagado explicitamente pra não deixar órfão
create or replace function public.excluir_paciente_direto(p_paciente_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_nutri_id uuid;
  v_paciente record;
begin
  v_nutri_id := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';

  if v_nutri_id is null then
    raise exception 'Sessão inválida. Faça login novamente.';
  end if;

  select * into v_paciente from public.pacientes where id = p_paciente_id;

  if not found then
    raise exception 'Paciente não encontrada.';
  end if;

  if v_paciente.nutri_id <> v_nutri_id then
    raise exception 'Você não tem permissão para excluir esta paciente.';
  end if;

  delete from public.recibos_paciente where paciente_id = p_paciente_id;

  delete from auth.users where id = p_paciente_id;

  return jsonb_build_object('id', p_paciente_id, 'nome', v_paciente.nome);
end;
$$;

grant execute on function public.excluir_paciente_direto(uuid) to authenticated;
