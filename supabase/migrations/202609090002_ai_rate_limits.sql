create table public.ai_daily_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, usage_date)
);

alter table public.ai_daily_usage enable row level security;
revoke all on table public.ai_daily_usage from anon, authenticated;

create or replace function public.consume_ai_request(daily_limit integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  accepted boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if daily_limit < 1 or daily_limit > 1000 then
    raise exception 'invalid daily limit';
  end if;

  insert into ai_daily_usage(owner_id, usage_date, request_count)
  values(current_user_id, current_date, 1)
  on conflict(owner_id, usage_date) do update
    set request_count = ai_daily_usage.request_count + 1,
        updated_at = now()
    where ai_daily_usage.request_count < daily_limit
  returning true into accepted;

  return coalesce(accepted, false);
end
$$;

revoke all on function public.consume_ai_request(integer) from public;
grant execute on function public.consume_ai_request(integer) to authenticated;
