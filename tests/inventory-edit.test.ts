import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryEditDraft, validateInventoryEditDraft } from '../mobile/src/domain/inventory-edit.ts';

const item = { id: 'tofu', name: '두부', quantity: 0.5, unit: '개', useBy: '2024-02-29', estimated: true, storageMethod: 'frozen' as const };
const draft = { name: '  두부  ', quantityText: ' 0.5 ', unit: '개', storageMethod: 'frozen' as const, useByDate: '2024-02-29' };

test('editing existing stock preserves quantity, storage and a past calendar date', () => {
  assert.deepEqual(createInventoryEditDraft(item), { ...draft, name: '두부', quantityText: '0.5' });
  assert.deepEqual(validateInventoryEditDraft(draft), { name: '두부', quantity: 0.5, unit: '개', storageMethod: 'frozen', useByDate: '2024-02-29' });
});

test('empty and nonpositive or nonnumeric quantities cannot become inventory edits', () => {
  for (const quantityText of ['', ' ', '0', '-1', 'Infinity', 'NaN', '300g', '0x10']) {
    assert.throws(() => validateInventoryEditDraft({ ...draft, quantityText }), Error, quantityText);
  }
  assert.throws(() => validateInventoryEditDraft({ ...draft, quantityText: '0' }), /삭제/);
});

test('calendar validation rejects nonexistent days and malformed dates', () => {
  for (const useByDate of ['', '2023-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-1']) {
    assert.throws(() => validateInventoryEditDraft({ ...draft, useByDate }), Error, useByDate);
  }
});

test('numeric date input becomes an ISO calendar date while invalid numeric days are rejected', () => {
  assert.equal(validateInventoryEditDraft({ ...draft, useByDate: '20240229' }).useByDate, '2024-02-29');
  assert.throws(() => validateInventoryEditDraft({ ...draft, useByDate: '20230229' }), /날짜/);
});

test('blank names and unsupported unit or storage cannot be saved', () => {
  assert.throws(() => validateInventoryEditDraft({ ...draft, name: '  ' }), /이름/);
  assert.throws(() => validateInventoryEditDraft({ ...draft, unit: '팩' }), /단위/);
  assert.throws(() => validateInventoryEditDraft({ ...draft, storageMethod: 'unknown' as never }), /보관/);
});

test('supported units and storage states accept fractional remaining stock', () => {
  for (const unit of ['g', 'ml', '개', '대']) {
    for (const storageMethod of ['room_temperature', 'refrigerated', 'frozen'] as const) {
      assert.equal(validateInventoryEditDraft({ ...draft, unit, storageMethod, quantityText: '1.125' }).quantity, 1.125);
    }
  }
});
