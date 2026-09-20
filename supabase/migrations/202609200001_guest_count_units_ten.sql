-- Update only the seed source for new guests and explicit demo resets.
-- Existing inventory_lots, including active guest edits, remain untouched.
create or replace function public.guest_demo_seed_rows()
returns table(ingredient_key text, display_name text, quantity numeric, unit text,
  days_until_use_by integer, storage_method text)
language sql stable security invoker set search_path = public as $$
  select v.ingredient_key, v.display_name, v.quantity::numeric, v.unit,
    v.days_until_use_by, v.storage_method
  from (values
    ('tofu','두부',300,'g',3,'refrigerated'),
    ('egg','계란',10,'개',7,'refrigerated'),
    ('pork','돼지고기 앞다리살',300,'g',1,'refrigerated'),
    ('kimchi','김치',500,'g',14,'refrigerated'),
    ('onion','양파',10,'개',14,'room_temperature'),
    ('green-onion','대파',10,'대',7,'refrigerated'),
    ('potato','감자',10,'개',21,'room_temperature'),
    ('soy','간장',500,'ml',180,'room_temperature'),
    ('doenjang','된장',500,'g',180,'refrigerated'),
    ('oil','식용유',500,'ml',180,'room_temperature'),
    ('sugar','설탕',500,'g',180,'room_temperature'),
    ('salt','소금',500,'g',180,'room_temperature'),
    ('gochujang','고추장',500,'g',180,'refrigerated'),
    ('gochugaru','고춧가루',500,'g',180,'room_temperature'),
    ('garlic','다진마늘',500,'g',30,'refrigerated'),
    ('sesame-oil','참기름',500,'ml',180,'room_temperature'),
    ('vinegar','식초',500,'ml',180,'room_temperature'),
    ('pepper','후추',500,'g',180,'room_temperature'),
    ('rice','쌀',1000,'g',180,'room_temperature'),
    ('carrot','당근',10,'개',14,'refrigerated'),
    ('zucchini','애호박',10,'개',7,'refrigerated'),
    ('radish','무',10,'개',14,'refrigerated'),
    ('shiitake','표고버섯',200,'g',7,'refrigerated'),
    ('bean-sprout','콩나물',300,'g',5,'refrigerated'),
    ('cabbage','양배추',10,'개',14,'refrigerated'),
    ('cucumber','오이',10,'개',7,'refrigerated'),
    ('spinach','시금치',200,'g',5,'refrigerated'),
    ('chicken','닭가슴살',300,'g',3,'refrigerated'),
    ('beef','소고기',300,'g',3,'refrigerated'),
    ('anchovy','멸치',200,'g',60,'room_temperature')
  ) as v(ingredient_key, display_name, quantity, unit, days_until_use_by, storage_method);
$$;

revoke all on function public.guest_demo_seed_rows() from public, anon;
grant execute on function public.guest_demo_seed_rows() to authenticated;
