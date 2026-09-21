-- Stable judging defaults for foods that appear in the bundled purchase examples.
-- These are conservative AI estimates, not the printed use-by dates of each product.
insert into public.shelf_life_rules as existing (
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
) values
  ('깻잎-무쌈','깻잎 무쌈','prepared','refrigerated','unopened',30,'AI추정',null,now(),'ai_estimated_approved',0.3,'active'),
  ('닭가슴살-치킨너겟','닭가슴살 치킨너겟','frozen','frozen','unopened',30,'AI추정',null,now(),'ai_estimated_approved',0.3,'active'),
  ('치킨너겟','닭가슴살 치킨너겟','frozen','frozen','unopened',30,'AI추정',null,now(),'ai_estimated_approved',0.3,'active'),
  ('카레','카레','pantry','room_temperature','unopened',365,'AI추정',null,now(),'ai_estimated_approved',0.3,'active'),
  ('양배추-샐러드-소스','양배추 샐러드 소스','pantry','room_temperature','unopened',180,'AI추정',null,now(),'ai_estimated_approved',0.3,'active')
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
