create or replace function public.complete_recipe_cooking(
  recipe_title text,
  recipe_content jsonb,
  usage_lines jsonb,
  request_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_recipe_id uuid;
  new_session_id uuid;
  completion_result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if recipe_title is null or length(trim(recipe_title)) = 0 then
    raise exception 'recipe title required';
  end if;
  if request_key is null or length(trim(request_key)) < 8 then
    raise exception 'invalid idempotency key';
  end if;
  if usage_lines is null
    or jsonb_typeof(usage_lines) <> 'array'
    or jsonb_array_length(usage_lines) = 0 then
    raise exception 'usage required';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(usage_lines)
      as usage_line(ingredient_key text, quantity numeric, unit text)
    where ingredient_key is null
      or length(trim(ingredient_key)) = 0
      or quantity is null
      or quantity <= 0
      or unit not in ('g', 'ml', '개', '대')
  ) then
    raise exception 'invalid usage';
  end if;

  -- The same user/request pair must not race past the idempotency check.
  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':' || trim(request_key), 0)
  );

  if exists (
    select 1
    from inventory_events
    where owner_id = current_user_id
      and idempotency_key = trim(request_key)
  ) then
    return jsonb_build_object('status', 'already_completed');
  end if;

  insert into recipes(owner_id, title, content)
  values(current_user_id, trim(recipe_title), recipe_content)
  returning id into new_recipe_id;

  insert into cooking_sessions(owner_id, recipe_id)
  values(current_user_id, new_recipe_id)
  returning id into new_session_id;

  insert into cooking_session_usage(session_id, ingredient_key, quantity, unit)
  select
    new_session_id,
    trim(usage_line.ingredient_key),
    sum(usage_line.quantity),
    usage_line.unit
  from jsonb_to_recordset(usage_lines)
    as usage_line(ingredient_key text, quantity numeric, unit text)
  group by trim(usage_line.ingredient_key), usage_line.unit;

  select public.complete_cooking(new_session_id, trim(request_key))
  into completion_result;

  return completion_result || jsonb_build_object(
    'recipe_id', new_recipe_id,
    'cooking_session_id', new_session_id
  );
end
$$;

revoke all on function public.complete_recipe_cooking(text, jsonb, jsonb, text) from public;
grant execute on function public.complete_recipe_cooking(text, jsonb, jsonb, text) to authenticated;
