-- Preserve user-provided source rows without exposing the workbook through the Data API.
create table if not exists public.shelf_life_source_entries (
  dataset_key text not null,
  row_number integer not null check (row_number >= 2),
  food_name text not null,
  storage_text text not null,
  duration_text text not null,
  source_title text not null,
  imported_at timestamptz not null default now(),
  primary key (dataset_key, row_number)
);

alter table public.shelf_life_source_entries enable row level security;
revoke all on table public.shelf_life_source_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.shelf_life_source_entries to service_role;

alter table public.shelf_life_rules alter column source_url drop not null;
alter table public.shelf_life_rules drop constraint if exists shelf_life_rules_source_url_check;
alter table public.shelf_life_rules add constraint shelf_life_rules_source_url_check
  check (source_url is null or source_url like 'https://%');
alter table public.shelf_life_rules drop constraint if exists shelf_life_rules_duration_days_check;
alter table public.shelf_life_rules add constraint shelf_life_rules_duration_days_check
  check (duration_days between 1 and 36525);
alter table public.shelf_life_rules drop constraint if exists shelf_life_rules_evidence_type_check;
alter table public.shelf_life_rules add constraint shelf_life_rules_evidence_type_check
  check (evidence_type in ('curated', 'ai_sourced', 'ai_estimated', 'ai_estimated_approved'));
alter table public.shelf_life_rules drop constraint if exists shelf_life_rule_evidence_source_check;
alter table public.shelf_life_rules add constraint shelf_life_rule_evidence_source_check
  check ((evidence_type <> 'ai_sourced' or source_url is not null)
    and (evidence_type not in ('ai_estimated', 'ai_estimated_approved')
      or (source_title = 'AI추정' and source_url is null)));

-- Even if a cache read fails or two requests race, weaker AI evidence cannot
-- replace the workbook or an already URL-verified rule.
create or replace function public.preserve_shelf_life_evidence_priority()
returns trigger language plpgsql set search_path = public as $$
begin
  if (old.evidence_type in ('curated', 'ai_estimated_approved')
      and new.evidence_type in ('ai_sourced', 'ai_estimated'))
    or (old.evidence_type = 'ai_sourced' and new.evidence_type = 'ai_estimated') then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists preserve_shelf_life_evidence_priority on public.shelf_life_rules;
create trigger preserve_shelf_life_evidence_priority
before update on public.shelf_life_rules for each row
execute function public.preserve_shelf_life_evidence_priority();
