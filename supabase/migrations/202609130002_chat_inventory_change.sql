-- The client sends only a reviewed command. No inventory writes occur on preflight failure.
create or replace function public.apply_chat_inventory_change(request_key text, changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  item jsonb;
  lot record;
  key_value text;
  name_value text;
  unit_value text;
  action_value text;
  balance_key text;
  balances jsonb := '{}'::jsonb;
  balance_value numeric;
  quantity_value numeric;
  remaining numeric;
  take_value numeric;
  expiry_value date;
  count_value integer := 0;
  ignored_value integer := 0;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if request_key is null or length(trim(request_key)) < 8 or length(request_key) > 160 then
    raise exception 'invalid idempotency key';
  end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) not between 1 and 20 then
    raise exception 'invalid inventory changes';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text), hashtext('chat_inventory'));
  if exists(select 1 from public.inventory_events where owner_id = current_user_id and idempotency_key = request_key) then
    return jsonb_build_object('status', 'already_applied');
  end if;

  -- Lock all owned lots before reading balances; another command cannot change them during this transaction.
  for lot in select id from public.inventory_lots where owner_id = current_user_id order by id for update loop
    null;
  end loop;

  -- Additions are evaluated first, allowing "bought 3, used 1" in a single message.
  for item in
    select value from (
      select value, ordinality, case when value->>'action' = 'add' then 0 else 1 end as priority
      from jsonb_array_elements(changes) with ordinality
    ) ordered_changes order by priority, ordinality
  loop
    key_value := trim(coalesce(item->>'ingredient_key', ''));
    name_value := trim(coalesce(item->>'display_name', ''));
    unit_value := item->>'unit';
    action_value := item->>'action';
    if key_value = '' or length(key_value) > 100 or name_value = '' or length(name_value) > 100
       or unit_value not in ('g','ml','개','대') or action_value not in ('add','consume','set')
       or coalesce(item->>'quantity', '') !~ '^([0-9]+)(\.[0-9]+)?$' then
      raise exception 'invalid inventory change';
    end if;
    quantity_value := (item->>'quantity')::numeric;
    if quantity_value > 1000000 or (action_value <> 'set' and quantity_value <= 0) then
      raise exception 'invalid inventory quantity';
    end if;
    if action_value = 'add' and (coalesce(item->>'use_by_at', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or (item->>'use_by_at')::date < current_date) then
      raise exception 'invalid use-by date';
    end if;
    balance_key := key_value || '|' || unit_value;
    if balances ? balance_key then
      balance_value := (balances->>balance_key)::numeric;
    else
      select coalesce(sum(quantity), 0) into balance_value from public.inventory_lots
      where owner_id = current_user_id and ingredient_key = key_value and unit = unit_value;
    end if;
    if action_value = 'add' then
      balance_value := balance_value + quantity_value;
    elsif action_value = 'set' then
      if balance_value = 0 and quantity_value > 0 and coalesce(item->>'use_by_at', '') = '' then
        raise exception 'use-by date required for new stock';
      end if;
      balance_value := quantity_value;
    elsif balance_value = 0 then
      if balances ? balance_key then
        return jsonb_build_object('status', 'needs_confirmation', 'ingredient_key', key_value,
          'display_name', name_value, 'available', 0, 'unit', unit_value);
      end if;
      ignored_value := ignored_value + 1;
      continue;
    elsif quantity_value > balance_value then
      return jsonb_build_object('status', 'needs_confirmation', 'ingredient_key', key_value,
        'display_name', name_value, 'available', balance_value, 'unit', unit_value);
    else
      balance_value := balance_value - quantity_value;
    end if;
    balances := jsonb_set(balances, array[balance_key], to_jsonb(balance_value));
  end loop;

  for item in
    select value from (
      select value, ordinality, case when value->>'action' = 'add' then 0 else 1 end as priority
      from jsonb_array_elements(changes) with ordinality
    ) ordered_changes order by priority, ordinality
  loop
    action_value := item->>'action';
    key_value := trim(item->>'ingredient_key');
    name_value := trim(item->>'display_name');
    unit_value := item->>'unit';
    quantity_value := (item->>'quantity')::numeric;
    if action_value = 'add' then
      insert into public.inventory_lots(owner_id, ingredient_key, display_name, quantity, unit,
        use_by_at, date_source, import_resolution)
      values(current_user_id, key_value, name_value, quantity_value, unit_value,
        (item->>'use_by_at')::date, 'estimated', 'user_confirmed');
      count_value := count_value + 1;
      continue;
    end if;

    select coalesce(sum(quantity), 0) into balance_value from public.inventory_lots
    where owner_id = current_user_id and ingredient_key = key_value and unit = unit_value;
    if action_value = 'consume' and balance_value = 0 then continue; end if;
    if action_value = 'set' and quantity_value > balance_value then
      select min(use_by_at) into expiry_value from public.inventory_lots
      where owner_id = current_user_id and ingredient_key = key_value and unit = unit_value;
      insert into public.inventory_lots(owner_id, ingredient_key, display_name, quantity, unit,
        use_by_at, date_source, import_resolution)
      values(current_user_id, key_value, name_value, quantity_value - balance_value, unit_value,
        coalesce(expiry_value, (item->>'use_by_at')::date), 'user_override', 'user_confirmed');
      count_value := count_value + 1;
      continue;
    end if;
    remaining := case when action_value = 'set' then balance_value - quantity_value else quantity_value end;
    for lot in select id, quantity from public.inventory_lots
      where owner_id = current_user_id and ingredient_key = key_value and unit = unit_value and quantity > 0
      order by use_by_at, created_at, id for update
    loop
      exit when remaining <= 0;
      take_value := least(remaining, lot.quantity);
      update public.inventory_lots set quantity = quantity - take_value where id = lot.id and owner_id = current_user_id;
      remaining := remaining - take_value;
    end loop;
    if remaining > 0 then raise exception 'inventory changed; please retry'; end if;
    count_value := count_value + 1;
  end loop;

  insert into public.inventory_events(owner_id, type, payload, idempotency_key)
  values(current_user_id, 'chat_inventory_changed',
    jsonb_build_object('changes', changes, 'applied', count_value, 'ignored', ignored_value), request_key);
  return jsonb_build_object('status', 'applied', 'count', count_value, 'ignored', ignored_value);
end;
$$;

revoke all on function public.apply_chat_inventory_change(text, jsonb) from public, anon;
grant execute on function public.apply_chat_inventory_change(text, jsonb) to authenticated;
