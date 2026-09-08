create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_guest boolean not null default false,
  demo_seed_version integer not null default 0,
  last_active_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ingredient_key text not null,
  display_name text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null check (unit in ('g','ml','개','대')),
  use_by_at date not null,
  date_source text not null check (date_source in ('printed','user_official','user_override','estimated')),
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content jsonb not null,
  provided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled','expired')),
  expires_at timestamptz not null default now() + interval '12 hours',
  completed_at timestamptz
);

create table public.cooking_session_usage (
  session_id uuid not null references public.cooking_sessions(id) on delete cascade,
  ingredient_key text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('g','ml','개','대')),
  primary key (session_id, ingredient_key, unit)
);

create table public.completed_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooking_session_id uuid not null unique references public.cooking_sessions(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);

alter table public.profiles enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.recipes enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.cooking_session_usage enable row level security;
alter table public.completed_recipes enable row level security;
alter table public.inventory_events enable row level security;

revoke all on table
  public.profiles,
  public.inventory_lots,
  public.recipes,
  public.cooking_sessions,
  public.cooking_session_usage,
  public.completed_recipes,
  public.inventory_events
from anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.inventory_lots,
  public.recipes,
  public.cooking_sessions,
  public.cooking_session_usage,
  public.completed_recipes
to authenticated;

grant select, insert on table public.inventory_events to authenticated;

create policy own_profiles on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_inventory on public.inventory_lots for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_recipes on public.recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_sessions on public.cooking_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_usage on public.cooking_session_usage for all
  using (exists(select 1 from public.cooking_sessions s where s.id = session_id and s.owner_id = auth.uid()))
  with check (exists(select 1 from public.cooking_sessions s where s.id = session_id and s.owner_id = auth.uid()));
create policy own_completed on public.completed_recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_events_read on public.inventory_events for select using (owner_id = auth.uid());
create policy own_events_insert on public.inventory_events for insert with check (owner_id = auth.uid());

create or replace function public.bootstrap_guest_inventory()
returns void language plpgsql security invoker set search_path = public as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  insert into profiles(user_id, is_guest, demo_seed_version, expires_at)
  values(current_user_id, true, 1, now() + interval '7 days')
  on conflict(user_id) do update set last_active_at = now(), expires_at = now() + interval '7 days';
  if exists(select 1 from inventory_lots where owner_id = current_user_id) then return; end if;
  insert into inventory_lots(owner_id, ingredient_key, display_name, quantity, unit, use_by_at, date_source) values
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
end $$;

create or replace function public.complete_cooking(target_session uuid, request_key text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare current_user_id uuid := auth.uid(); session_row public.cooking_sessions; line record; lot_row public.inventory_lots; deductions jsonb := '[]'::jsonb;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if request_key is null or length(trim(request_key)) < 8 then raise exception 'invalid idempotency key'; end if;
  select * into session_row from cooking_sessions where id=target_session and owner_id=current_user_id for update;
  if not found then raise exception 'session not found'; end if;
  if session_row.status='completed' then return jsonb_build_object('status','already_completed'); end if;
  if session_row.status<>'active' or session_row.expires_at<=now() then raise exception 'session unavailable'; end if;
  for line in select ingredient_key, unit, sum(quantity) quantity from cooking_session_usage where session_id=target_session group by ingredient_key, unit order by ingredient_key loop
    select * into lot_row from inventory_lots where owner_id=current_user_id and ingredient_key=line.ingredient_key and unit=line.unit and quantity>=line.quantity order by use_by_at, created_at limit 1 for update;
    if not found then raise exception 'insufficient inventory: %', line.ingredient_key; end if;
    update inventory_lots set quantity=quantity-line.quantity where id=lot_row.id;
    deductions := deductions || jsonb_build_array(jsonb_build_object('lot_id',lot_row.id,'ingredient_key',line.ingredient_key,'quantity',line.quantity,'unit',line.unit));
  end loop;
  insert into inventory_events(owner_id,type,payload,idempotency_key) values(current_user_id,'cooking_completed',deductions,request_key);
  insert into completed_recipes(owner_id,recipe_id,cooking_session_id) values(current_user_id,session_row.recipe_id,target_session);
  update cooking_sessions set status='completed', completed_at=now() where id=target_session;
  return jsonb_build_object('status','completed','deductions',deductions);
exception when unique_violation then
  if exists(select 1 from inventory_events where owner_id=current_user_id and idempotency_key=request_key) then return jsonb_build_object('status','already_completed'); end if;
  raise;
end $$;

revoke all on function public.bootstrap_guest_inventory() from public;
grant execute on function public.bootstrap_guest_inventory() to authenticated;
revoke all on function public.complete_cooking(uuid,text) from public;
grant execute on function public.complete_cooking(uuid,text) to authenticated;
