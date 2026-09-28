import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOAuthCallback } from '../mobile/src/domain/oauth-callback.ts';

test('reads an implicit OAuth session from a native deep link fragment', () => {
  assert.deepEqual(
    parseOAuthCallback('naengtalk://#access_token=access%2Btoken&refresh_token=refresh-token&token_type=bearer'),
    { kind: 'session', accessToken: 'access+token', refreshToken: 'refresh-token' },
  );
});

test('reads a PKCE authorization code from a callback query', () => {
  assert.deepEqual(parseOAuthCallback('naengtalk://?code=auth-code'), {
    kind: 'code', code: 'auth-code',
  });
});

test('surfaces provider errors and rejects callbacks without credentials', () => {
  assert.deepEqual(parseOAuthCallback('naengtalk://#error=access_denied&error_description=User+cancelled'), {
    kind: 'error', message: 'User cancelled',
  });
  assert.deepEqual(parseOAuthCallback('naengtalk://'), {
    kind: 'error', message: '로그인 응답에 인증 정보가 없습니다.',
  });
});
