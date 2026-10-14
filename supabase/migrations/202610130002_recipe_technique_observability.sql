alter table observability.ai_request_traces
  add column initial_candidate_origin text
    check (initial_candidate_origin is null or initial_candidate_origin in ('MFDS', 'MAFRA', 'SHARED_AI', 'AI_GENERATED')),
  add column generation_path text
    check (generation_path is null or generation_path in ('public_technique', 'shared_technique', 'ai_only', 'ai_repair')),
  add column candidate_score_band text
    check (candidate_score_band is null or candidate_score_band in ('high', 'medium', 'low'));

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
  trace_initial_failure_code text;
  trace_repair_failure_code text;
  trace_final_failure_code text;
  trace_failure_stage text;
  trace_initial_candidate_origin text;
  trace_generation_path text;
  trace_candidate_score_band text;
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
  if exists (
    select 1
    from jsonb_object_keys(trace) as keys(key_name)
    where key_name not in (
      'request_id', 'owner_id', 'intent', 'candidate_origin',
      'initial_candidate_origin', 'generation_path', 'candidate_score_band',
      'status', 'error_code', 'repair_reason', 'initial_failure_code',
      'repair_failure_code', 'final_failure_code', 'failure_stage', 'total_ms',
      'auth_ms', 'rate_limit_ms', 'inventory_ms', 'luna_ms', 'catalog_ms',
      'terra_initial_ms', 'validation_ms', 'terra_repair_ms', 'luna_call_count',
      'terra_call_count', 'luna_input_tokens', 'luna_output_tokens',
      'terra_input_tokens', 'terra_output_tokens', 'openai_request_ids'
    )
  ) then
    raise exception 'unexpected trace key';
  end if;
  if trace ?| array['message', 'history', 'inventory', 'recipe', 'prompt', 'input', 'output'] then
    raise exception 'trace content is not allowed';
  end if;
  if length(coalesce(trace ->> 'error_code', '')) > 64
    or length(coalesce(trace ->> 'repair_reason', '')) > 64
    or length(coalesce(trace ->> 'intent', '')) > 32
    or length(coalesce(trace ->> 'candidate_origin', '')) > 32
    or length(coalesce(trace ->> 'initial_failure_code', '')) > 64
    or length(coalesce(trace ->> 'repair_failure_code', '')) > 64
    or length(coalesce(trace ->> 'final_failure_code', '')) > 64 then
    raise exception 'trace label is too long';
  end if;
  if (coalesce(trace ->> 'initial_failure_code', '') <> ''
      and (trace ->> 'initial_failure_code') !~ '^[A-Z][A-Z0-9_]{0,63}$')
    or (coalesce(trace ->> 'repair_failure_code', '') <> ''
      and (trace ->> 'repair_failure_code') !~ '^[A-Z][A-Z0-9_]{0,63}$')
    or (coalesce(trace ->> 'final_failure_code', '') <> ''
      and (trace ->> 'final_failure_code') !~ '^[A-Z][A-Z0-9_]{0,63}$') then
    raise exception 'trace diagnostic content is not allowed';
  end if;
  if coalesce(trace ->> 'failure_stage', '') <> ''
    and (trace ->> 'failure_stage') not in (
      'auth', 'request_parse', 'rate_limit', 'inventory_query', 'intent_model',
      'intent_parse', 'catalog_search', 'terra_initial', 'validation_initial',
      'terra_repair', 'validation_repair', 'response', 'unknown'
    ) then
    raise exception 'invalid trace failure stage';
  end if;
  if coalesce(trace ->> 'initial_candidate_origin', '') <> ''
    and (trace ->> 'initial_candidate_origin') not in ('MFDS', 'MAFRA', 'SHARED_AI', 'AI_GENERATED') then
    raise exception 'invalid initial candidate origin';
  end if;
  if coalesce(trace ->> 'generation_path', '') <> ''
    and (trace ->> 'generation_path') not in ('public_technique', 'shared_technique', 'ai_only', 'ai_repair') then
    raise exception 'invalid generation path';
  end if;
  if coalesce(trace ->> 'candidate_score_band', '') <> ''
    and (trace ->> 'candidate_score_band') not in ('high', 'medium', 'low') then
    raise exception 'invalid candidate score band';
  end if;
  if jsonb_typeof(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) > 3 then
    raise exception 'invalid OpenAI request ids';
  end if;

  trace_status := greatest(100, least(599, coalesce((trace ->> 'status')::integer, 500)));
  trace_total_ms := greatest(0, least(120000, coalesce((trace ->> 'total_ms')::integer, 0)));
  trace_repair_reason := nullif(trace ->> 'repair_reason', '');
  trace_error_code := nullif(trace ->> 'error_code', '');
  trace_initial_failure_code := nullif(trace ->> 'initial_failure_code', '');
  trace_repair_failure_code := nullif(trace ->> 'repair_failure_code', '');
  trace_final_failure_code := nullif(trace ->> 'final_failure_code', '');
  trace_failure_stage := nullif(trace ->> 'failure_stage', '');
  trace_initial_candidate_origin := nullif(trace ->> 'initial_candidate_origin', '');
  trace_generation_path := nullif(trace ->> 'generation_path', '');
  trace_candidate_score_band := nullif(trace ->> 'candidate_score_band', '');
  select coalesce(array_agg(left(value, 128)), '{}'::text[])
    into trace_openai_ids
  from jsonb_array_elements_text(coalesce(trace -> 'openai_request_ids', '[]'::jsonb)) as value;

  insert into observability.ai_request_traces (
    request_id, owner_id, created_at, retain_until, route, intent, candidate_origin,
    initial_candidate_origin, generation_path, candidate_score_band,
    status, error_code, repair_reason, initial_failure_code, repair_failure_code,
    final_failure_code, failure_stage, total_ms, auth_ms, rate_limit_ms, inventory_ms,
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
    trace_initial_candidate_origin,
    trace_generation_path,
    trace_candidate_score_band,
    trace_status,
    trace_error_code,
    trace_repair_reason,
    trace_initial_failure_code,
    trace_repair_failure_code,
    trace_final_failure_code,
    trace_failure_stage,
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
        error_rate, repair_rate, average_total_ms, p50_total_ms, p95_total_ms,
        luna_call_count, terra_call_count, input_tokens, output_tokens, refreshed_at
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
