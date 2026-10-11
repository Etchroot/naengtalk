create schema if not exists observability;

revoke all on schema observability from public, anon, authenticated;

create table observability.ai_request_traces (
  request_id uuid primary key,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  retain_until timestamptz not null,
  route text not null default 'menu-chat' check (length(route) between 1 and 32),
  intent text check (intent is null or length(intent) <= 32),
  candidate_origin text check (candidate_origin is null or length(candidate_origin) <= 32),
  status smallint not null check (status between 100 and 599),
  error_code text check (error_code is null or length(error_code) <= 64),
  repair_reason text check (repair_reason is null or length(repair_reason) <= 64),
  total_ms integer not null check (total_ms between 0 and 120000),
  auth_ms integer not null default 0 check (auth_ms between 0 and 120000),
  rate_limit_ms integer not null default 0 check (rate_limit_ms between 0 and 120000),
  inventory_ms integer not null default 0 check (inventory_ms between 0 and 120000),
  luna_ms integer not null default 0 check (luna_ms between 0 and 120000),
  catalog_ms integer not null default 0 check (catalog_ms between 0 and 120000),
  terra_initial_ms integer not null default 0 check (terra_initial_ms between 0 and 120000),
  validation_ms integer not null default 0 check (validation_ms between 0 and 120000),
  terra_repair_ms integer not null default 0 check (terra_repair_ms between 0 and 120000),
  luna_call_count smallint not null default 0 check (luna_call_count between 0 and 1),
  terra_call_count smallint not null default 0 check (terra_call_count between 0 and 2),
  luna_input_tokens integer not null default 0 check (luna_input_tokens between 0 and 10000000),
  luna_output_tokens integer not null default 0 check (luna_output_tokens between 0 and 10000000),
  terra_input_tokens integer not null default 0 check (terra_input_tokens between 0 and 10000000),
  terra_output_tokens integer not null default 0 check (terra_output_tokens between 0 and 10000000),
  openai_request_ids text[] not null default '{}'::text[]
    check (cardinality(openai_request_ids) <= 3 and length(array_to_string(openai_request_ids, ',')) <= 384)
);

create index ai_request_traces_owner_created_idx
  on observability.ai_request_traces(owner_id, created_at desc)
  where owner_id is not null;

create index ai_request_traces_retain_until_idx
  on observability.ai_request_traces(retain_until);

create index ai_request_traces_slow_or_error_idx
  on observability.ai_request_traces(created_at desc)
  where total_ms >= 15000 or status >= 400 or repair_reason is not null;

create table observability.ai_request_daily_metrics (
  metric_date date primary key,
  request_count bigint not null,
  success_count bigint not null,
  error_count bigint not null,
  repair_count bigint not null,
  slow_count bigint not null,
  error_rate numeric(7, 4) not null,
  repair_rate numeric(7, 4) not null,
  average_total_ms numeric(12, 2) not null,
  p50_total_ms numeric(12, 2) not null,
  p95_total_ms numeric(12, 2) not null,
  luna_call_count bigint not null,
  terra_call_count bigint not null,
  input_tokens bigint not null,
  output_tokens bigint not null,
  refreshed_at timestamptz not null default now()
);

create table observability.maintenance_state (
  singleton boolean primary key default true check (singleton),
  last_rollup_date date,
  last_pruned_at timestamptz
);

insert into observability.maintenance_state(singleton)
values (true)
on conflict (singleton) do nothing;

revoke all on all tables in schema observability from public, anon, authenticated;
revoke all on all sequences in schema observability from public, anon, authenticated;

alter default privileges in schema observability
  revoke all on tables from public, anon, authenticated;

alter default privileges in schema observability
  revoke all on sequences from public, anon, authenticated;

create or replace function public.record_ai_request_trace(trace jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_role text;
  trace_now timestamptz := now();
  trace_status integer;
  trace_total_ms integer;
  trace_repair_reason text;
  trace_error_code text;
  trace_openai_ids text[];
  previous_day date := current_date - 1;
begin
  request_role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );
  if request_role <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if trace is null or jsonb_typeof(trace) <> 'object' or octet_length(trace::text) > 4096 then
    raise exception 'invalid trace payload';
  end if;
  if trace ?| array['message', 'history', 'inventory', 'recipe', 'prompt', 'input', 'output'] then
    raise exception 'trace content is not allowed';
  end if;
  if length(coalesce(trace ->> 'error_code', '')) > 64
    or length(coalesce(trace ->> 'repair_reason', '')) > 64
    or length(coalesce(trace ->> 'intent', '')) > 32
    or length(coalesce(trace ->> 'candidate_origin', '')) > 32 then
    raise exception 'trace label is too long';
  end if;
  if jsonb_typeof(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) > 3 then
    raise exception 'invalid OpenAI request ids';
  end if;

  trace_status := greatest(100, least(599, coalesce((trace ->> 'status')::integer, 500)));
  trace_total_ms := greatest(0, least(120000, coalesce((trace ->> 'total_ms')::integer, 0)));
  trace_repair_reason := nullif(trace ->> 'repair_reason', '');
  trace_error_code := nullif(trace ->> 'error_code', '');
  select coalesce(array_agg(left(value, 128)), '{}'::text[])
    into trace_openai_ids
  from jsonb_array_elements_text(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) as value;

  insert into observability.ai_request_traces (
    request_id, owner_id, created_at, retain_until, route, intent, candidate_origin,
    status, error_code, repair_reason, total_ms, auth_ms, rate_limit_ms, inventory_ms,
    luna_ms, catalog_ms, terra_initial_ms, validation_ms, terra_repair_ms,
    luna_call_count, terra_call_count, luna_input_tokens, luna_output_tokens,
    terra_input_tokens, terra_output_tokens, openai_request_ids
  ) values (
    (trace ->> 'request_id')::uuid,
    nullif(trace ->> 'owner_id', '')::uuid,
    trace_now,
    trace_now + case
      when trace_status >= 400 or trace_repair_reason is not null or trace_total_ms >= 15000
        then interval '90 days'
      else interval '30 days'
    end,
    'menu-chat',
    nullif(trace ->> 'intent', ''),
    nullif(trace ->> 'candidate_origin', ''),
    trace_status,
    trace_error_code,
    trace_repair_reason,
    trace_total_ms,
    greatest(0, least(120000, coalesce((trace ->> 'auth_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'rate_limit_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'inventory_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'luna_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'catalog_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'terra_initial_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'validation_ms')::integer, 0))),
    greatest(0, least(120000, coalesce((trace ->> 'terra_repair_ms')::integer, 0))),
    greatest(0, least(1, coalesce((trace ->> 'luna_call_count')::integer, 0))),
    greatest(0, least(2, coalesce((trace ->> 'terra_call_count')::integer, 0))),
    greatest(0, least(10000000, coalesce((trace ->> 'luna_input_tokens')::integer, 0))),
    greatest(0, least(10000000, coalesce((trace ->> 'luna_output_tokens')::integer, 0))),
    greatest(0, least(10000000, coalesce((trace ->> 'terra_input_tokens')::integer, 0))),
    greatest(0, least(10000000, coalesce((trace ->> 'terra_output_tokens')::integer, 0))),
    trace_openai_ids
  )
  on conflict (request_id) do nothing;

  if pg_try_advisory_xact_lock(hashtext('naengtalk-ai-observability-maintenance')) then
    if not exists (
      select 1 from observability.maintenance_state
      where singleton and last_rollup_date >= previous_day
    ) then
      insert into observability.ai_request_daily_metrics (
        metric_date, request_count, success_count, error_count, repair_count, slow_count,
        error_rate, repair_rate,
        average_total_ms, p50_total_ms, p95_total_ms, luna_call_count, terra_call_count,
        input_tokens, output_tokens, refreshed_at
      )
      select
        previous_day,
        count(*),
        count(*) filter (where status < 400),
        count(*) filter (where status >= 400),
        count(*) filter (where repair_reason is not null),
        count(*) filter (where total_ms >= 15000),
        round((count(*) filter (where status >= 400))::numeric / nullif(count(*), 0), 4),
        round((count(*) filter (where repair_reason is not null))::numeric / nullif(count(*), 0), 4),
        round(avg(total_ms), 2),
        round(percentile_cont(0.5) within group (order by total_ms)::numeric, 2),
        round(percentile_cont(0.95) within group (order by total_ms)::numeric, 2),
        coalesce(sum(luna_call_count), 0),
        coalesce(sum(terra_call_count), 0),
        coalesce(sum(luna_input_tokens + terra_input_tokens), 0),
        coalesce(sum(luna_output_tokens + terra_output_tokens), 0),
        trace_now
      from observability.ai_request_traces
      where created_at >= previous_day::timestamptz
        and created_at < (previous_day + 1)::timestamptz
      having count(*) > 0
      on conflict (metric_date) do update set
        request_count = excluded.request_count,
        success_count = excluded.success_count,
        error_count = excluded.error_count,
        repair_count = excluded.repair_count,
        slow_count = excluded.slow_count,
        error_rate = excluded.error_rate,
        repair_rate = excluded.repair_rate,
        average_total_ms = excluded.average_total_ms,
        p50_total_ms = excluded.p50_total_ms,
        p95_total_ms = excluded.p95_total_ms,
        luna_call_count = excluded.luna_call_count,
        terra_call_count = excluded.terra_call_count,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        refreshed_at = excluded.refreshed_at;

      update observability.maintenance_state
      set last_rollup_date = previous_day
      where singleton;
    end if;

    if not exists (
      select 1 from observability.maintenance_state
      where singleton and last_pruned_at >= current_date::timestamptz
    ) then
      delete from observability.ai_request_traces
      where retain_until < now();

      update observability.maintenance_state
      set last_pruned_at = trace_now
      where singleton;
    end if;
  end if;
end
$$;

revoke all on function public.record_ai_request_trace(jsonb)
from public, anon, authenticated;

grant execute on function public.record_ai_request_trace(jsonb)
to service_role;

notify pgrst, 'reload schema';
