insert into public.shelf_life_rules (
  canonical_key,
  canonical_name,
  category,
  storage_method,
  package_state,
  duration_days,
  source_title,
  source_url,
  source_checked_at,
  evidence_type,
  confidence,
  status
) values (
  '즉석밥',
  '즉석밥',
  'prepared',
  'room_temperature',
  'unopened',
  180,
  'CJ제일제당 햇반 미개봉 상온 9개월 보관 안내',
  'https://www.cj.co.kr/kr/support/faq/1939',
  now(),
  'curated',
  0.95,
  'active'
)
on conflict (canonical_key, storage_method, package_state)
do update set
  canonical_name = excluded.canonical_name,
  category = excluded.category,
  duration_days = excluded.duration_days,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  source_checked_at = excluded.source_checked_at,
  evidence_type = excluded.evidence_type,
  confidence = excluded.confidence,
  status = excluded.status,
  updated_at = now();
