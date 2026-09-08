import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage } from '../mobile/src/services/session-storage.ts';

function memoryDriver() {
  const data = new Map<string, string>();
  return {
    data,
    driver: {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => { data.set(key, value); },
      removeItem: async (key: string) => { data.delete(key); },
    },
  };
}

test('secure session storage round-trips values larger than one native item', async () => {
  const { driver } = memoryDriver();
  const storage = createChunkedStorage(driver, 8);
  const session = 'abcdefghijklmnopqrstuvwxyz';
  await storage.setItem('session', session);
  assert.equal(await storage.getItem('session'), session);
});

test('replacing and removing a session clears obsolete chunks', async () => {
  const { data, driver } = memoryDriver();
  const storage = createChunkedStorage(driver, 4);
  await storage.setItem('session', 'abcdefghijkl');
  await storage.setItem('session', 'xy');
  assert.equal(await storage.getItem('session'), 'xy');
  assert.equal([...data.keys()].filter(key => key.includes('.part.')).length, 1);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(data.size, 0);
});

test('corrupt session manifests fail closed', async () => {
  const { data, driver } = memoryDriver();
  data.set('session.manifest', 'not-json');
  const storage = createChunkedStorage(driver, 8);
  assert.equal(await storage.getItem('session'), null);
});
