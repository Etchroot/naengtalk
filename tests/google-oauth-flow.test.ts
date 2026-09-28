import assert from 'node:assert/strict';
import test from 'node:test';
import { runNativeGoogleOAuth } from '../mobile/src/domain/google-oauth-flow.ts';

test('native Google OAuth exchanges browser tokens for a Supabase session', async () => {
  const calls: string[] = [];
  await runNativeGoogleOAuth({
    signInWithOAuth: async (request) => {
      assert.equal(request.provider, 'google');
      assert.equal(request.options.redirectTo, 'naengtalk://');
      calls.push('start');
      return { data: { url: 'https://auth.example/start' }, error: null };
    },
    setSession: async (session) => {
      assert.deepEqual(session, { access_token: 'access', refresh_token: 'refresh' });
      calls.push('session');
      return { error: null };
    },
    exchangeCodeForSession: async () => { throw new Error('unexpected PKCE'); },
  }, 'naengtalk://', async (url, redirect) => {
    assert.equal(url, 'https://auth.example/start');
    assert.equal(redirect, 'naengtalk://');
    calls.push('browser');
    return { type: 'success', url: 'naengtalk://#access_token=access&refresh_token=refresh' };
  });
  assert.deepEqual(calls, ['start', 'browser', 'session']);
});

test('native Google OAuth treats user cancellation as cancellation', async () => {
  await assert.rejects(runNativeGoogleOAuth({
    signInWithOAuth: async () => ({ data: { url: 'https://auth.example/start' }, error: null }),
    setSession: async () => { throw new Error('unexpected session'); },
    exchangeCodeForSession: async () => { throw new Error('unexpected PKCE'); },
  }, 'naengtalk://', async () => ({ type: 'cancel' })), /GOOGLE_LOGIN_CANCELLED/);
});

test('native Google OAuth exchanges a PKCE code when returned', async () => {
  let exchanged = '';
  await runNativeGoogleOAuth({
    signInWithOAuth: async () => ({ data: { url: 'https://auth.example/start' }, error: null }),
    setSession: async () => { throw new Error('unexpected session'); },
    exchangeCodeForSession: async (code) => {
      exchanged = code;
      return { error: null };
    },
  }, 'naengtalk://', async () => ({ type: 'success', url: 'naengtalk://?code=pkce-code' }));
  assert.equal(exchanged, 'pkce-code');
});
