create table public.ai_feature_daily_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, feature, usage_date)
);

alter table public.ai_feature_daily_usage enable row level security;
revoke all on table public.ai_feature_daily_usage from public, anon, authenticated;
create policy own_ai_feature_daily_usage on public.ai_feature_daily_usage
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.consume_feature_request(feature_name text, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  did_consume boolean := false;
begin
  if current_user_id is null or feature_name <> 'purchase_ocr' or daily_limit < 1 or daily_limit > 100 then
    return false;
  end if;

  insert into public.ai_feature_daily_usage (owner_id, feature, usage_date, request_count)
  values (current_user_id, feature_name, current_date, 1)
  on conflict (owner_id, feature, usage_date) do update
    set request_count = public.ai_feature_daily_usage.request_count + 1,
        updated_at = now()
    where public.ai_feature_daily_usage.request_count < daily_limit
  returning true into did_consume;

  return coalesce(did_consume, false);
end;
$$;

revoke all on function public.consume_feature_request(text, integer) from public, anon;
grant execute on function public.consume_feature_request(text, integer) to authenticated;
