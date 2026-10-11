import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../mobile/src/services/app-update-controller.ts').catch(() => ({}));
function create(io: object, states: any[] = []) {
  const factory = Reflect.get(module, 'createAppUpdateController');
  assert.equal(typeof factory, 'function');
  return factory(io, (state: unknown) => states.push(state));
}
test('checking or declining never downloads; download and restart each require a separate user action', async () => {
  const calls: string[] = [], states: any[] = [];
  const controller = create({enabled: true, check: async () => { calls.push('check'); return true; }, download: async () => { calls.push('download'); return true; }, reload: async () => { calls.push('reload'); }}, states);
  await controller.apply(); await controller.download();
  assert.deepEqual(calls, []);
  await controller.check();
  assert.equal(states.at(-1).phase, 'available');
  assert.deepEqual(calls, ['check']);
  controller.defer();
  assert.deepEqual(calls, ['check']);
  await controller.check(); await controller.download();
  assert.equal(states.at(-1).phase, 'ready');
  assert.deepEqual(calls, ['check', 'check', 'download']);
  controller.defer(); await controller.check();
  assert.equal(states.at(-1).phase, 'ready');
  assert.deepEqual(calls, ['check', 'check', 'download']);
  await controller.apply();
  assert.deepEqual(calls, ['check', 'check', 'download', 'reload']);
});
test('concurrent taps cause a single download and failed download remains retryable without restarting', async () => {
  let release: (value: boolean) => void = () => {}, downloads = 0, restarts = 0;
  const states: any[] = [];
  const controller = create({enabled: true, check: async () => true, download: async () => { downloads++; return new Promise<boolean>((resolve) => {release = resolve;}); }, reload: async () => {restarts++;}}, states);
  await controller.check();
  const first = controller.download();
  await controller.download(); await controller.apply();
  assert.equal(downloads, 1); assert.equal(restarts, 0);
  release(false); await first;
  assert.equal(states.at(-1).phase, 'current');
  await controller.check();
  const retry = controller.download(); release(true); await retry;
  assert.equal(states.at(-1).phase, 'ready');
});
test('disabled runtime, no update and connection errors are visible and do not fetch or reload', async () => {
  const states: any[] = [];
  const io = {enabled: false, check: async () => {throw new Error('should not check');}, download: async () => {throw new Error('should not fetch');}, reload: async () => {throw new Error('should not reload');}};
  const disabled = create(io, states); await disabled.check();
  assert.equal(states.at(-1).phase, 'unavailable');
  const current = create({...io, enabled: true, check: async () => false}, states); await current.check();
  assert.equal(states.at(-1).phase, 'current');
  const offline = create({...io, enabled: true}, states); await offline.check();
  assert.equal(states.at(-1).phase, 'error');
  assert.match(states.at(-1).message, /업데이트 확인/);
});
test('a network download failure never restarts and can be retried after a new check', async () => {
  const states: any[] = []; let fails = true, restarts = 0;
  const controller = create({enabled: true, check: async () => true, download: async () => {if (fails) throw new Error('offline'); return true;}, reload: async () => {restarts++;}}, states);
  await controller.check(); await controller.download();
  assert.equal(states.at(-1).phase, 'error'); assert.match(states.at(-1).message, /다운로드/);
  await controller.apply(); assert.equal(restarts, 0);
  fails = false; await controller.check(); await controller.download();
  assert.equal(states.at(-1).phase, 'ready'); assert.equal(restarts, 0);
});
