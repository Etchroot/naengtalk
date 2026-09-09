import { test } from 'node:test';
import assert from 'node:assert/strict';

const inventoryModule = await import('../mobile/src/domain/remote-inventory.ts').catch(() => ({}));

test('remote inventory rows become the inventory model used by the app', () => {
  const mapInventoryLotRows = Reflect.get(inventoryModule, 'mapInventoryLotRows');
  assert.equal(typeof mapInventoryLotRows, 'function');

  assert.deepEqual(
    mapInventoryLotRows([
      {
        id: 'lot-1',
        ingredient_key: 'egg',
        display_name: '계란',
        quantity: '10',
        unit: '개',
        use_by_at: '2026-09-16',
        date_source: 'estimated',
      },
      {
        id: 'lot-2',
        ingredient_key: 'kimchi',
        display_name: '김치',
        quantity: 500,
        unit: 'g',
        use_by_at: '2026-09-23',
        date_source: 'printed',
      },
    ]),
    [
      { id: 'egg', name: '계란', quantity: 10, unit: '개', useBy: '2026-09-16', estimated: true },
      { id: 'kimchi', name: '김치', quantity: 500, unit: 'g', useBy: '2026-09-23', estimated: false },
    ],
  );
});

test('remote inventory mapping rejects malformed quantities', () => {
  const mapInventoryLotRows = Reflect.get(inventoryModule, 'mapInventoryLotRows');
  assert.equal(typeof mapInventoryLotRows, 'function');

  assert.throws(
    () => mapInventoryLotRows([{
      id: 'lot-1', ingredient_key: 'egg', display_name: '계란', quantity: 'many',
      unit: '개', use_by_at: '2026-09-16', date_source: 'estimated',
    }]),
    /수량/,
  );
});
