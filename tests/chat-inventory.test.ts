import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const module = await import('../mobile/src/domain/chat-inventory.ts').catch(() => ({}));
const inventory = [
  { id: 'pork', name: '삼겹살', quantity: 100, unit: 'g', useBy: '2026-09-14', estimated: true },
  { id: 'pork', name: '삼겹살', quantity: 200, unit: 'g', useBy: '2026-09-16', estimated: true },
  { id: 'lettuce', name: '꽃상추', quantity: 5, unit: '개', useBy: '2026-09-15', estimated: true },
];

test('all means the combined amount across owned lots', () => {
  const rows = module.createChatInventoryDraft?.([
    { action: 'consume', name: '삼겹살', ingredientKey: 'pork', quantity: null, unit: 'g', all: true },
  ], inventory, []);
  assert.equal(rows?.[0].quantityText, '300g');
  assert.equal(rows?.[0].available, 300);
});

test('one mixed utterance can add a food and consume some of that food', () => {
  const rows = module.createChatInventoryDraft?.([
    { action: 'add', name: '감자', ingredientKey: null, quantity: 3, unit: '개', all: false },
    { action: 'consume', name: '감자', ingredientKey: null, quantity: 1, unit: '개', all: false },
  ], inventory, [{ name: '감자', quantityText: '3개', useByDate: '2026-10-10' }]);
  assert.equal(rows?.length, 2);
  assert.equal(rows?.[0].ingredientKey, rows?.[1].ingredientKey);
  assert.equal(module.findChatInventoryOverdraw?.(rows, inventory), null);
});

test('mixed utterance remains valid when the model lists consumption before purchase', () => {
  const rows = module.createChatInventoryDraft?.([
    { action: 'consume', name: '감자', ingredientKey: null, quantity: 1, unit: '개', all: false },
    { action: 'add', name: '감자', ingredientKey: null, quantity: 3, unit: '개', all: false },
  ], inventory, [{ name: '감자', quantityText: '3개', useByDate: '2026-10-10' }]);
  assert.equal(rows?.length, 2);
  assert.equal(module.findChatInventoryOverdraw?.(rows, inventory), null);
});

test('overdraw requires confirmation and caps only the named ingredient to latest stock', () => {
  const rows = module.createChatInventoryDraft?.([
    { action: 'consume', name: '삼겹살', ingredientKey: 'pork', quantity: 400, unit: 'g', all: false },
    { action: 'consume', name: '꽃상추', ingredientKey: 'lettuce', quantity: 2, unit: '개', all: false },
  ], inventory, []);
  assert.deepEqual(module.findChatInventoryOverdraw?.(rows, inventory), {
    rowId: rows[0].id, name: '삼겹살', available: 300, unit: 'g',
  });
  const capped = module.capChatInventoryRow?.(rows, rows[0].id, 300);
  assert.equal(capped?.[0].quantityText, '300g');
  assert.equal(capped?.[1].quantityText, '2개');
});

test('addition requires valid quantity and date; set remaining may be zero', () => {
  const draft = module.createChatInventoryDraft?.([
    { action: 'add', name: '감자', ingredientKey: null, quantity: 2, unit: '개', all: false },
  ], inventory, []);
  assert.throws(() => module.toChatInventoryPayload?.(draft, '2026-09-13'), /소진일|확인/);
  const corrected = module.createChatInventoryDraft?.([
    { action: 'set', name: '꽃상추', ingredientKey: 'lettuce', quantity: 0, unit: '개', all: false },
  ], inventory, []);
  assert.equal(module.toChatInventoryPayload?.(corrected, '2026-09-13')[0].quantity, 0);
});

test('chat addition preserves frozen storage through approval payload', () => {
  const rows = module.createChatInventoryDraft?.([
    { action: 'add', name: '냉동 고등어', ingredientKey: null, quantity: 2, unit: '개', all: false },
  ], inventory, [{ name: '냉동 고등어', quantityText: '2개', useByDate: '2026-10-10', storageMethod: 'frozen' }]);
  assert.equal(rows?.[0].storageMethod, 'frozen');
  assert.equal(module.toChatInventoryPayload?.(rows, '2026-09-13')[0].storage_method, 'frozen');
});

test('migration limits writes to an authenticated atomic command with replay protection', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202609130002_chat_inventory_change.sql', import.meta.url), 'utf8').toLowerCase();
  assert.match(sql, /create (or replace )?function public\.apply_chat_inventory_change/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /for update/);
  assert.match(sql, /needs_confirmation/);
  assert.match(sql, /grant execute on function public\.apply_chat_inventory_change\(text, jsonb\) to authenticated/);
});

test('chat inventory migration stores reviewed storage method on added lots', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202609190001_chat_inventory_storage_method.sql', import.meta.url), 'utf8').toLowerCase();
  assert.match(sql, /import_resolution, storage_method\)[\s\S]*?'user_confirmed', storage_value/);
  assert.match(sql, /'room_temperature', 'refrigerated', 'frozen'/);
});

test('cooking completion deducts across owned lots in expiry order', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202609130003_complete_cooking_multi_lot.sql', import.meta.url), 'utf8').toLowerCase();
  assert.match(sql, /create or replace function public\.complete_cooking/);
  assert.match(sql, /order by use_by_at, created_at, id for update/);
  assert.match(sql, /remaining := remaining - take_value/);
  assert.match(sql, /if remaining > 0 then raise exception 'insufficient inventory/);
});
