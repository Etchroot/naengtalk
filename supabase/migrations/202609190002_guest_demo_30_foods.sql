-- Version 2 is used only for new guests or an explicit demo reset.
-- Existing guest inventory is never overwritten during session restoration.
create or replace function public.guest_demo_seed_rows()
returns table(ingredient_key text, display_name text, quantity numeric, unit text,
  days_until_use_by integer, storage_method text)
language sql stable security invoker set search_path = public as $$
  select v.ingredient_key, v.display_name, v.quantity::numeric, v.unit,
    v.days_until_use_by, v.storage_method
  from (values
    ('tofu','두부',300,'g',3,'refrigerated'),
    ('egg','계란',10,'개',7,'refrigerated'),
    ('pork','돼지고기 앞다리살',300,'g',1,'refrigerated'),
    ('kimchi','김치',500,'g',14,'refrigerated'),
    ('onion','양파',2,'개',14,'room_temperature'),
    ('green-onion','대파',2,'대',7,'refrigerated'),
    ('potato','감자',3,'개',21,'room_temperature'),
    ('soy','간장',500,'ml',180,'room_temperature'),
    ('doenjang','된장',500,'g',180,'refrigerated'),
    ('oil','식용유',500,'ml',180,'room_temperature'),
    ('sugar','설탕',500,'g',180,'room_temperature'),
    ('salt','소금',500,'g',180,'room_temperature'),
    ('gochujang','고추장',500,'g',180,'refrigerated'),
    ('gochugaru','고춧가루',500,'g',180,'room_temperature'),
    ('garlic','다진마늘',500,'g',30,'refrigerated'),
    ('sesame-oil','참기름',500,'ml',180,'room_temperature'),
    ('vinegar','식초',500,'ml',180,'room_temperature'),
    ('pepper','후추',500,'g',180,'room_temperature'),
    ('rice','쌀',1000,'g',180,'room_temperature'),
    ('carrot','당근',2,'개',14,'refrigerated'),
    ('zucchini','애호박',1,'개',7,'refrigerated'),
    ('radish','무',1,'개',14,'refrigerated'),
    ('shiitake','표고버섯',200,'g',7,'refrigerated'),
    ('bean-sprout','콩나물',300,'g',5,'refrigerated'),
    ('cabbage','양배추',1,'개',14,'refrigerated'),
    ('cucumber','오이',2,'개',7,'refrigerated'),
    ('spinach','시금치',200,'g',5,'refrigerated'),
    ('chicken','닭가슴살',300,'g',3,'refrigerated'),
    ('beef','소고기',300,'g',3,'refrigerated'),
    ('anchovy','멸치',200,'g',60,'room_temperature')
  ) as v(ingredient_key, display_name, quantity, unit, days_until_use_by, storage_method);
$$;

revoke all on function public.guest_demo_seed_rows() from public, anon;
grant execute on function public.guest_demo_seed_rows() to authenticated;

create or replace function public.bootstrap_guest_inventory()
returns void language plpgsql security invoker set search_path = public as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  insert into public.profiles(user_id, is_guest, demo_seed_version, expires_at)
  values(current_user_id, true, 2, now() + interval '7 days')
  on conflict(user_id) do update set last_active_at = now(), expires_at = now() + interval '7 days';
  if exists(select 1 from public.inventory_lots where owner_id = current_user_id) then return; end if;
  insert into public.inventory_lots(owner_id, ingredient_key, display_name, quantity, unit,
    use_by_at, date_source, storage_method)
  select current_user_id, s.ingredient_key, s.display_name, s.quantity, s.unit,
    current_date + s.days_until_use_by, 'estimated', s.storage_method
  from public.guest_demo_seed_rows() as s;
end $$;

create or replace function public.reset_guest_demo()
returns void language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles where user_id = current_user_id and is_guest = true) then
    raise exception 'guest profile required';
  end if;
  delete from public.completed_recipes where owner_id = current_user_id;
  delete from public.recipes where owner_id = current_user_id;
  delete from public.inventory_events where owner_id = current_user_id;
  delete from public.inventory_lots where owner_id = current_user_id;
  insert into public.inventory_lots(owner_id, ingredient_key, display_name, quantity, unit,
    use_by_at, date_source, storage_method)
  select current_user_id, s.ingredient_key, s.display_name, s.quantity, s.unit,
    current_date + s.days_until_use_by, 'estimated', s.storage_method
  from public.guest_demo_seed_rows() as s;
  update public.profiles set demo_seed_version = 2, last_active_at = now(),
    expires_at = now() + interval '7 days' where user_id = current_user_id;
end $$;

revoke all on function public.bootstrap_guest_inventory() from public, anon;
grant execute on function public.bootstrap_guest_inventory() to authenticated;
revoke all on function public.reset_guest_demo() from public, anon;
grant execute on function public.reset_guest_demo() to authenticated;
