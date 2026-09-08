import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendConfig } from '../mobile/src/services/backend-config.ts';

test('missing public Supabase values keeps the explicit local validation mode', () => {
  assert.deepEqual(resolveBackendConfig({}), { mode: 'local' });
});

test('partial Supabase configuration fails closed', () => {
  assert.throws(() => resolveBackendConfig({ url: 'https://demo.supabase.co' }), /함께/);
  assert.throws(() => resolveBackendConfig({ publicKey: 'sb_publishable_demo' }), /함께/);
});

test('remote mode accepts only an https Supabase endpoint', () => {
  assert.throws(() => resolveBackendConfig({ url: 'http://demo.supabase.co', publicKey: 'sb_publishable_demo' }), /HTTPS/);
  assert.throws(() => resolveBackendConfig({ url: 'https://example.com', publicKey: 'sb_publishable_demo' }), /Supabase/);
  assert.deepEqual(resolveBackendConfig({ url: 'https://demo.supabase.co/', publicKey: ' sb_publishable_demo ' }), {
    mode: 'supabase', url: 'https://demo.supabase.co', publicKey: 'sb_publishable_demo',
  });
});
