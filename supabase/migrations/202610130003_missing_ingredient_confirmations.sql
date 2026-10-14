create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.missing_ingredient_confirmations (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  message_hash text not null,
  dish_name text not null default '',
  ingredient_names text[] not null,
  missing_ingredient_names text[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index missing_ingredient_confirmations_owner_expiry_idx
  on private.missing_ingredient_confirmations(owner_id, expires_at);

create function public.create_missing_ingredient_confirmation(
  p_owner_id uuid,
  p_message_hash text,
  p_dish_name text,
  p_ingredient_names text[],
  p_missing_ingredient_names text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  created_token uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_owner_id is null or length(p_message_hash) <> 64 or p_message_hash !~ '^[0-9a-f]+$'
    or length(coalesce(p_dish_name, '')) > 100
    or coalesce(array_length(p_ingredient_names, 1), 0) > 10
    or coalesce(array_length(p_missing_ingredient_names, 1), 0) = 0
    or coalesce(array_length(p_missing_ingredient_names, 1), 0) > 10
    or exists (select 1 from unnest(coalesce(p_ingredient_names, '{}'::text[])
      || coalesce(p_missing_ingredient_names, '{}'::text[])) as item where length(item) > 100) then
    raise exception 'invalid missing ingredient confirmation';
  end if;

  delete from private.missing_ingredient_confirmations
    where expires_at < now() - interval '1 day';
  insert into private.missing_ingredient_confirmations(
    owner_id, message_hash, dish_name, ingredient_names, missing_ingredient_names, expires_at
  ) values (
    p_owner_id, p_message_hash, coalesce(p_dish_name, ''),
    coalesce(p_ingredient_names, '{}'::text[]), p_missing_ingredient_names,
    now() + interval '5 minutes'
  ) returning token into created_token;
  return jsonb_build_object('ticket', created_token::text);
end;
$$;

create function public.consume_missing_ingredient_confirmation(
  p_token uuid,
  p_owner_id uuid,
  p_message_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  confirmation private.missing_ingredient_confirmations%rowtype;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_owner_id is null or length(p_message_hash) <> 64 then
    raise exception 'invalid missing ingredient confirmation';
  end if;

  select * into confirmation
  from private.missing_ingredient_confirmations as pending
  where pending.token = p_token
    and pending.owner_id = p_owner_id
    and pending.message_hash = p_message_hash
    and pending.consumed_at is null
    and pending.expires_at > now()
  for update;
  if not found then return null; end if;

  update private.missing_ingredient_confirmations as pending
    set consumed_at = now()
    where pending.token = confirmation.token;
  return jsonb_build_object(
    'dishName', confirmation.dish_name,
    'ingredientNames', to_jsonb(confirmation.ingredient_names),
    'missingIngredientNames', to_jsonb(confirmation.missing_ingredient_names)
  );
end;
$$;

revoke all on function public.create_missing_ingredient_confirmation(uuid, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.create_missing_ingredient_confirmation(uuid, text, text, text[], text[])
  to service_role;
revoke all on function public.consume_missing_ingredient_confirmation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_missing_ingredient_confirmation(uuid, uuid, text)
  to service_role;
