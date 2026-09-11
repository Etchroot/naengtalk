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
  if current_user_id is null
    or feature_name not in ('purchase_ocr', 'inventory_parse')
    or daily_limit < 1
    or daily_limit > 100 then
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
