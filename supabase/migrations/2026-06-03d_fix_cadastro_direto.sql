-- =============================================================
-- Migration 2026-06-03d
-- Fix: cadastro direto de paciente com nutri_id garantido
-- =============================================================
-- Problema: auth.uid() pode retornar null dentro de funções
-- security definer no Supabase, fazendo o trigger handle_new_user
-- inserir nutri_id = null e violar o NOT NULL constraint.
-- Solução: a função insere diretamente em public.pacientes com o
-- nutri_id local (validado antes); trigger fica como fallback.
-- =============================================================
-- Cole no SQL Editor do Supabase e clique em Run.
-- =============================================================

-- 1. Atualiza o trigger para não quebrar quando nutri_id está null
--    (caso cadastrar_paciente_direto tenha passado nutri_id vazio)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', '');
begin
  if v_role = 'nutri' then
    insert into public.nutris (id, nome, crn, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nome', new.email),
      new.raw_user_meta_data ->> 'crn',
      new.email
    )
    on conflict (id) do nothing;

  elsif v_role = 'paciente' then
    declare
      v_nutri_id uuid := (new.raw_user_meta_data ->> 'nutri_id')::uuid;
      v_pendente public.pacientes_pendentes%rowtype;
      v_template record;
    begin
      -- Se nutri_id não veio nos metadados, cadastrar_paciente_direto
      -- já inseriu diretamente em pacientes — apenas dispara pré-consultas.
      if v_nutri_id is null then
        return new;
      end if;

      select * into v_pendente from public.pacientes_pendentes
        where nutri_id = v_nutri_id and lower(email) = lower(new.email) limit 1;

      if found then
        insert into public.pacientes (id, nutri_id, nome, email, objetivo, tipo_plano, modalidade, nascimento)
        values (
          new.id, v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome',       v_pendente.nome,       new.email),
          new.email,
          coalesce(new.raw_user_meta_data ->> 'objetivo',   v_pendente.objetivo),
          coalesce(new.raw_user_meta_data ->> 'tipo_plano', v_pendente.tipo_plano),
          coalesce(new.raw_user_meta_data ->> 'modalidade', v_pendente.modalidade),
          coalesce((new.raw_user_meta_data ->> 'nascimento')::date, v_pendente.nascimento)
        ) on conflict (id) do nothing;
        update public.pacientes_pendentes set status = 'ativado' where id = v_pendente.id;
      else
        insert into public.pacientes (id, nutri_id, nome, email, objetivo, tipo_plano, modalidade, nascimento)
        values (
          new.id, v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome', new.email),
          new.email,
          new.raw_user_meta_data ->> 'objetivo',
          new.raw_user_meta_data ->> 'tipo_plano',
          new.raw_user_meta_data ->> 'modalidade',
          (new.raw_user_meta_data ->> 'nascimento')::date
        ) on conflict (id) do nothing;
      end if;

      for v_template in
        select id, nome, perguntas from public.checkin_templates
        where nutri_id = v_nutri_id and tipo = 'pre_consulta'
      loop
        insert into public.checkin_envios (nutri_id, paciente_id, nome, tipo, perguntas, enviado_em)
        values (v_nutri_id, new.id,
          coalesce(v_template.nome, 'Check-in pré-consulta'),
          'pre_consulta', v_template.perguntas, now());
      end loop;
    end;
  end if;
  return new;
end;
$$;

-- 2. Recria cadastrar_paciente_direto para inserir explicitamente em
--    public.pacientes usando v_nutri_id local (não depende do trigger)
drop function if exists public.cadastrar_paciente_direto(text, text, date, text, text, text, text);
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
  v_senha    text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  -- Lê nutri_id via current_setting (mais robusto que auth.uid() em security definer)
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
    raise exception 'Este email já possui uma conta no sistema.';
  end if;

  -- Cria usuário no Auth sem enviar email (email_confirmed_at = now() → já confirmado)
  -- Não passa nutri_id nos metadados para evitar dependência do trigger
  insert into auth.users (
    id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, 'authenticated', 'authenticated', lower(p_email),
    crypt(v_senha, gen_salt('bf')), now(),
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

  -- Insere diretamente em public.pacientes com nutri_id garantido.
  -- ON CONFLICT DO UPDATE cobre o caso do trigger ter inserido sem nutri_id.
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
