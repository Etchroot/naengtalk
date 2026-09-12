create or replace function public.reset_guest_demo()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = current_user_id
      and is_guest = true
  ) then
    raise exception 'guest profile required';
  end if;

  -- All writes stay owner-scoped. Recipe deletion cascades to its sessions and usage.
  delete from public.completed_recipes where owner_id = current_user_id;
  delete from public.recipes where owner_id = current_user_id;
  delete from public.inventory_events where owner_id = current_user_id;
  delete from public.inventory_lots where owner_id = current_user_id;

  insert into public.inventory_lots(
    owner_id,
    ingredient_key,
    display_name,
    quantity,
    unit,
    use_by_at,
    date_source
  ) values
    (current_user_id,'tofu','두부',300,'g',current_date+3,'estimated'),
    (current_user_id,'egg','계란',10,'개',current_date+7,'estimated'),
    (current_user_id,'pork','돼지고기 앞다리살',300,'g',current_date+1,'estimated'),
    (current_user_id,'kimchi','김치',500,'g',current_date+14,'estimated'),
    (current_user_id,'onion','양파',2,'개',current_date+14,'estimated'),
    (current_user_id,'green-onion','대파',2,'대',current_date+7,'estimated'),
    (current_user_id,'potato','감자',3,'개',current_date+21,'estimated'),
    (current_user_id,'soy','간장',500,'ml',current_date+180,'estimated'),
    (current_user_id,'doenjang','된장',500,'g',current_date+180,'estimated'),
    (current_user_id,'oil','식용유',500,'ml',current_date+180,'estimated');

  update public.profiles
  set demo_seed_version = 1,
      last_active_at = now(),
      expires_at = now() + interval '7 days'
  where user_id = current_user_id;
end
$$;

revoke all on function public.reset_guest_demo() from public, anon;
grant execute on function public.reset_guest_demo() to authenticated;
