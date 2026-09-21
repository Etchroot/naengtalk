"""Generate an idempotent Supabase SQL import from the private 116-row workbook.

Usage: python tools/prepare-shelf-life-workbook.py <workbook.xlsx> <ignored-output.sql>
Run the schema migration first. Keep the generated SQL out of Git (scripts/ is ignored).
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from openpyxl import load_workbook


DATASET_KEY = "food-integrated-shelf-life-2026-09"
FRESH_PRODUCE = {
    "가지", "감자", "겨울호박", "고구마", "단호박", "당근", "대파", "리크", "마늘",
    "무", "버섯", "부추", "브로콜리", "비트", "상추", "생강", "셀러리", "시금치", "아스파라거스",
    "애호박", "양배추", "양파", "오이", "옥수수", "청경채", "콜리플라워", "콩나물",
    "파프리카", "피망",
}
FRESH_MEAT_SEAFOOD = {
    "가리비", "가자미", "게", "고등어", "굴", "다진 닭고기", "다진 돼지고기", "다진 소고기",
    "닭고기", "대구", "돼지고기", "바지락", "새우", "소고기", "양고기", "연어", "오리고기",
    "오징어", "참치", "홍합",
}
LEAFY = {"부추", "상추", "시금치", "청경채"}
STORAGE_VEGETABLE = {"감자", "고구마", "단호박", "겨울호박", "마늘", "양파"}


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def normalized_key(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).strip().lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^0-9a-z가-힣]+", "-", value))[:80]


def duration_days(value: str) -> int | None:
    match = re.fullmatch(r"(\d+)(시간|일|주|개월)", value.strip())
    if not match:
        return None
    amount, unit = int(match.group(1)), match.group(2)
    return {"시간": max(1, amount // 24), "일": amount, "주": amount * 7, "개월": amount * 30}[unit]


def rule_for(row_number: int, cells: tuple[str, str, str, str]) -> tuple | None:
    name, storage_text, duration_text, source_title = cells
    if name in {"된장", "쌈장"}:
        return None  # Manufacturer-specific storage condition; raw row remains available.
    if storage_text.startswith("냉장"):
        storage_method = "refrigerated"
    elif storage_text.startswith("냉동"):
        storage_method = "frozen"
    elif storage_text.startswith("실온"):
        storage_method = "room_temperature"
    else:
        raise ValueError(f"row {row_number}: unknown storage condition: {storage_text}")
    if name == "소금" and duration_text == "무기한":
        days, source_title, evidence_type = 36525, "AI추정", "ai_estimated_approved"
    else:
        days, evidence_type = duration_days(duration_text), "curated"
        if days is None:
            raise ValueError(f"row {row_number}: unknown duration: {duration_text}")
    if name in LEAFY:
        category = "leafy"
    elif name == "버섯":
        category = "mushroom"
    elif name in STORAGE_VEGETABLE:
        category = "storage_vegetable"
    elif name in FRESH_PRODUCE:
        category = "vegetable"
    elif name in FRESH_MEAT_SEAFOOD:
        category = "fresh_meat"
    elif name in {"두부", "가공두부"}:
        category = "tofu"
    elif storage_method == "room_temperature":
        category = "pantry"
    else:
        category = "prepared"
    package_state = "unopened" if "미개봉" in storage_text or category not in {
        "leafy", "mushroom", "storage_vegetable", "vegetable"
    } else "unpackaged"
    confidence = 0.3 if evidence_type == "ai_estimated_approved" else 0.85
    return (normalized_key(name), name, category, storage_method, package_state, days,
            source_title, evidence_type, confidence)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare-shelf-life-workbook.py <input.xlsx> <output.sql>")
    workbook_path, output_path = Path(sys.argv[1]), Path(sys.argv[2])
    if not workbook_path.is_file():
        raise SystemExit(f"workbook not found: {workbook_path}")
    if not (output_path.parent.name == "data" and output_path.parent.parent.name == "scripts"):
        raise SystemExit("output must be in the git-ignored scripts/data/ directory")
    values = list(load_workbook(workbook_path, read_only=True, data_only=True).active.values)
    if values[0] != ("식품이름", "보관방법", "권장 소비기한", "출처"):
        raise ValueError("unexpected workbook header")
    rows = [tuple(str(cell).strip() for cell in row) for row in values[1:]]
    if len(rows) != 116 or any(len(row) != 4 or not all(row) for row in rows):
        raise ValueError("workbook must contain exactly 116 complete rows")
    if len({(row[0], row[1]) for row in rows}) != 116:
        raise ValueError("duplicate food + storage pair")
    raw = [(DATASET_KEY, number, *row) for number, row in enumerate(rows, start=2)]
    rules = [rule for number, row in enumerate(rows, start=2) if (rule := rule_for(number, row))]
    for name in ("맛소금", "허브솔트"):
        rules.append((normalized_key(name), name, "pantry", "room_temperature", "unopened",
                      1825, "AI추정", "ai_estimated_approved", 0.3))
    if len(rules) != 116 or len({(r[0], r[3], r[4]) for r in rules}) != 116:
        raise ValueError("expected 116 distinct active rules (114 workbook + 2 AI additions)")
    sql = ["begin;", "insert into public.shelf_life_source_entries",
           "(dataset_key,row_number,food_name,storage_text,duration_text,source_title) values"]
    sql.append(",\n".join("(" + ",".join(str(v) if isinstance(v, int) else quote(v) for v in row) + ")"
                            for row in raw))
    sql.append("on conflict (dataset_key,row_number) do update set food_name=excluded.food_name, "
               "storage_text=excluded.storage_text,duration_text=excluded.duration_text,"
               "source_title=excluded.source_title,imported_at=now();")
    sql.extend(["insert into public.shelf_life_rules as existing",
                "(canonical_key,canonical_name,category,storage_method,package_state,duration_days,"
                "source_title,source_url,source_checked_at,evidence_type,confidence,status) values"])
    sql.append(",\n".join("(" + ",".join(quote(v) if isinstance(v, str) else str(v) for v in row[:7])
                            + ",null,now()," + quote(row[7]) + "," + str(row[8]) + ",'active')"
                            for row in rules))
    sql.append("on conflict (canonical_key,storage_method,package_state) do update set "
               "canonical_name=excluded.canonical_name,category=excluded.category,"
               "duration_days=excluded.duration_days,source_title=excluded.source_title,"
               "source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,"
               "evidence_type=excluded.evidence_type,confidence=excluded.confidence,"
               "status=excluded.status,updated_at=now() "
               "where excluded.evidence_type in ('curated','ai_estimated_approved') "
               "or existing.evidence_type='ai_estimated';")
    sql.append("do $$ begin if (select count(*) from public.shelf_life_source_entries "
               f"where dataset_key={quote(DATASET_KEY)}) <> 116 then "
               "raise exception 'shelf-life source count mismatch'; end if; end $$;")
    sql.append("commit;")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(sql) + "\n", encoding="utf-8")
    # Compact, equivalent SQL for dashboards with a text-only SQL editor.
    source_codes = {name: str(index) for index, name in enumerate(sorted({r[3] for r in rows}), 1)}
    category_codes = {name: str(index) for index, name in enumerate(sorted({r[2] for r in rules}), 1)}
    by_name = {r[1]: r for r in rules}
    encoded_rows = []
    for name, storage, period, source in rows:
        rule = by_name.get(name)
        encoded_rows.append("|".join((name, storage, period, source_codes[source],
                                      category_codes[rule[2]] if rule else "-",
                                      "u" if rule and rule[4] == "unpackaged" else "o",
                                      str(rule[5]) if rule else "-",
                                      "a" if rule and rule[7] == "ai_estimated_approved" else "c")))
    source_map = ",".join(f"({quote(code)},{quote(name)})" for name, code in source_codes.items())
    category_map = ",".join(f"({quote(code)},{quote(name)})" for name, code in category_codes.items())
    compact = f"""begin;
create temp table shelf_life_import_stage on commit drop as
select ord::integer+1 row_number, parts[1] food_name, parts[2] storage_text,
  parts[3] duration_text, src.title source_title, parts[5] category_code,
  parts[6] package_code, nullif(parts[7],'-')::integer duration_days,
  parts[8] evidence_code
from (select ord, string_to_array(line,'|') parts
  from regexp_split_to_table($shelf$
{'\n'.join(encoded_rows)}
$shelf$, E'\\n') with ordinality as input(line,ord)) encoded
join (values {source_map}) as src(code,title) on src.code=encoded.parts[4];
do $$ begin if (select count(*) from shelf_life_import_stage) <> 116 then
  raise exception 'shelf-life workbook row count mismatch'; end if; end $$;
insert into public.shelf_life_source_entries
  (dataset_key,row_number,food_name,storage_text,duration_text,source_title)
select {quote(DATASET_KEY)},row_number,food_name,storage_text,duration_text,source_title
from shelf_life_import_stage
on conflict (dataset_key,row_number) do update set
  food_name=excluded.food_name,storage_text=excluded.storage_text,
  duration_text=excluded.duration_text,source_title=excluded.source_title,imported_at=now();
insert into public.shelf_life_rules as existing
  (canonical_key,canonical_name,category,storage_method,package_state,
   duration_days,source_title,source_url,source_checked_at,evidence_type,confidence,status)
select trim(both '-' from regexp_replace(lower(food_name),'[^0-9a-z가-힣]+','-','g')),
  food_name,cat.name,
  case when storage_text like '냉장%' then 'refrigerated'
       when storage_text like '냉동%' then 'frozen' else 'room_temperature' end,
  case when package_code='u' then 'unpackaged' else 'unopened' end,
  duration_days,case when evidence_code='a' then 'AI추정' else source_title end,
  null,now(),case when evidence_code='a' then 'ai_estimated_approved' else 'curated' end,
  case when evidence_code='a' then 0.3 else 0.85 end,'active'
from shelf_life_import_stage stage
join (values {category_map}) as cat(code,name) on cat.code=stage.category_code
where duration_days is not null
union all
select name,name,'pantry','room_temperature','unopened',1825,'AI추정',null,now(),
  'ai_estimated_approved',0.3,'active'
from (values ('맛소금'),('허브솔트')) as extra(name)
on conflict (canonical_key,storage_method,package_state) do update set
  canonical_name=excluded.canonical_name,category=excluded.category,
  duration_days=excluded.duration_days,source_title=excluded.source_title,
  source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,
  evidence_type=excluded.evidence_type,confidence=excluded.confidence,
  status=excluded.status,updated_at=now()
where excluded.evidence_type in ('curated','ai_estimated_approved')
  or existing.evidence_type='ai_estimated';
do $$ begin if (select count(*) from public.shelf_life_source_entries
  where dataset_key={quote(DATASET_KEY)}) <> 116 then
  raise exception 'shelf-life source count mismatch'; end if; end $$;
commit;
"""
    output_path.with_name("shelf-life-import-compact.sql").write_text(compact, encoding="utf-8")
    print(f"raw=116 active_from_workbook=114 ai_additions=2 sql={output_path}")


if __name__ == "__main__":
    main()
