import test from 'node:test';
import assert from 'node:assert/strict';
const loader = await import('../mobile/src/services/native-purchase-image.ts').catch(() => ({}));
test('bundled Android sample resolves to a local file before encoding its bytes', async () => {
  const load = Reflect.get(loader, 'loadNativePurchaseImage');
  assert.equal(typeof load, 'function');
  const calls: string[] = [];
  const result = await load({kind: 'sample', source: 42, uri: 'asset:/r5.jpg'}, {
    resolveSample: async (source: number) => { assert.equal(source, 42); calls.push('resolve'); return 'file:///cache/r5.jpg'; },
    readFile: async (uri: string) => { assert.equal(uri, 'file:///cache/r5.jpg'); calls.push('read'); return {base64: 'QUJD', mimeType: 'image/jpeg', size: 3}; },
  });
  assert.equal(result, 'data:image/jpeg;base64,QUJD');
  assert.deepEqual(calls, ['resolve', 'read']);
});
test('gallery images use their local URI and preserve PNG type; unreadable files have a useful error', async () => {
  const load = Reflect.get(loader, 'loadNativePurchaseImage');
  assert.equal(typeof load, 'function');
  const selection = {kind: 'library', uri: 'file:///cache/photo.png'};
  const io = {
    resolveSample: async () => { throw new Error('gallery must not resolve a bundled asset'); },
    readFile: async (uri: string) => { assert.equal(uri, selection.uri); return {base64: 'QUJD', mimeType: 'image/png', size: 3}; },
  };
  assert.equal(await load(selection, io), 'data:image/png;base64,QUJD');
  await assert.rejects(load(selection, {...io, readFile: async () => { throw new Error('Network request failed'); }}), /이미지 파일을 읽지 못했습니다/);
  await assert.rejects(load(selection, {...io, readFile: async () => ({base64: 'QUJD', mimeType: 'image/heic', size: 3})}), /JPEG·PNG·WebP/);
  await assert.rejects(load(selection, {...io, readFile: async () => ({base64: 'QUJD', mimeType: 'image/jpeg', size: 6 * 1024 * 1024})}), /5MB/);
});
