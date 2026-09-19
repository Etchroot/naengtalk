-- Cooking and conversational consumption share earliest-expiry, multi-lot deduction semantics.
create or replace function public.complete_cooking(target_session uuid, request_key text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  session_row public.cooking_sessions;
  line record;
  lot_row record;
  remaining numeric;
  take_value numeric;
  deductions jsonb := '[]'::jsonb;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if request_key is null or length(trim(request_key)) < 8 then raise exception 'invalid idempotency key'; end if;
  perform pg_advisory_xact_lock(hashtext(current_user_id::text), hashtext('chat_inventory'));
  select * into session_row from public.cooking_sessions
  where id = target_session and owner_id = current_user_id for update;
  if not found then raise exception 'session not found'; end if;
  if session_row.status = 'completed' then return jsonb_build_object('status', 'already_completed'); end if;
  if session_row.status <> 'active' or session_row.expires_at <= now() then raise exception 'session unavailable'; end if;

  for line in select ingredient_key, unit, sum(quantity) as quantity
    from public.cooking_session_usage where session_id = target_session
    group by ingredient_key, unit order by ingredient_key, unit
  loop
    remaining := line.quantity;
    for lot_row in select id, quantity from public.inventory_lots
      where owner_id = current_user_id and ingredient_key = line.ingredient_key
        and unit = line.unit and quantity > 0
      order by use_by_at, created_at, id for update
    loop
      exit when remaining <= 0;
      take_value := least(remaining, lot_row.quantity);
      update public.inventory_lots set quantity = quantity - take_value
      where id = lot_row.id and owner_id = current_user_id;
      deductions := deductions || jsonb_build_array(jsonb_build_object(
        'lot_id', lot_row.id, 'ingredient_key', line.ingredient_key,
        'quantity', take_value, 'unit', line.unit));
      remaining := remaining - take_value;
    end loop;
    if remaining > 0 then raise exception 'insufficient inventory: %', line.ingredient_key; end if;
  end loop;

  insert into public.inventory_events(owner_id, type, payload, idempotency_key)
  values(current_user_id, 'cooking_completed', deductions, request_key);
  insert into public.completed_recipes(owner_id, recipe_id, cooking_session_id)
  values(current_user_id, session_row.recipe_id, target_session);
  update public.cooking_sessions set status = 'completed', completed_at = now()
  where id = target_session and owner_id = current_user_id;
  return jsonb_build_object('status', 'completed', 'deductions', deductions);
exception when unique_violation then
  if exists(select 1 from public.inventory_events
    where owner_id = current_user_id and idempotency_key = request_key) then
    return jsonb_build_object('status', 'already_completed');
  end if;
  raise;
end;
$$;

revoke all on function public.complete_cooking(uuid, text) from public, anon;
grant execute on function public.complete_cooking(uuid, text) to authenticated;
