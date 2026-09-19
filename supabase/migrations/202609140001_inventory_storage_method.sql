-- Preserve the storage state chosen during review. Existing lots remain unknown.
alter table public.inventory_lots
  add column if not exists storage_method text
  check (storage_method in ('room_temperature', 'refrigerated', 'frozen'));

create or replace function public.register_inventory_import(request_key text, items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_id uuid;
  item jsonb;
  inserted_count integer := 0;
  quantity_value numeric;
  use_by_value date;
  display_name_value text;
  ingredient_key_value text;
  unit_value text;
  date_source_value text;
  resolution_value text;
  storage_method_value text;
  note_value text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if request_key is null or length(trim(request_key)) < 8 then raise exception 'invalid idempotency key'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) < 1 or jsonb_array_length(items) > 40 then
    raise exception 'invalid inventory items';
  end if;

  insert into public.inventory_events(owner_id, type, payload, idempotency_key)
  values(current_user_id, 'purchase_imported', jsonb_build_object('count', jsonb_array_length(items)), request_key)
  on conflict (owner_id, idempotency_key) do nothing
  returning id into event_id;
  if event_id is null then return jsonb_build_object('status', 'already_registered'); end if;

  for item in select value from jsonb_array_elements(items)
  loop
    display_name_value := trim(coalesce(item->>'display_name', ''));
    ingredient_key_value := trim(coalesce(item->>'ingredient_key', ''));
    unit_value := item->>'unit';
    date_source_value := coalesce(item->>'date_source', 'estimated');
    resolution_value := coalesce(item->>'import_resolution', 'user_confirmed');
    storage_method_value := nullif(item->>'storage_method', '');
    note_value := nullif(left(trim(coalesce(item->>'internal_note', '')), 300), '');

    if display_name_value = '' or length(display_name_value) > 100
      or ingredient_key_value = '' or length(ingredient_key_value) > 100
      or unit_value not in ('g','ml','개','대')
      or date_source_value not in ('printed','user_official','user_override','estimated')
      or resolution_value not in ('auto','user_confirmed','user_edited')
      or (storage_method_value is not null and storage_method_value not in ('room_temperature','refrigerated','frozen'))
      or coalesce(item->>'quantity', '') !~ '^([0-9]+)(\.[0-9]+)?$'
      or coalesce(item->>'use_by_at', '') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception 'invalid inventory item'; end if;

    quantity_value := (item->>'quantity')::numeric;
    use_by_value := (item->>'use_by_at')::date;
    if quantity_value <= 0 or use_by_value < current_date then raise exception 'invalid inventory item'; end if;

    insert into public.inventory_lots(
      owner_id, ingredient_key, display_name, quantity, unit, use_by_at,
      date_source, import_resolution, internal_note, storage_method
    ) values (
      current_user_id, ingredient_key_value, display_name_value, quantity_value, unit_value,
      use_by_value, date_source_value, resolution_value, note_value, storage_method_value
    );
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('status', 'registered', 'count', inserted_count);
end;
$$;

revoke all on function public.register_inventory_import(text,jsonb) from public, anon;
grant execute on function public.register_inventory_import(text,jsonb) to authenticated;
