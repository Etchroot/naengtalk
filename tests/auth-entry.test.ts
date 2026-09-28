import assert from 'node:assert/strict';
import test from 'node:test';
import { availableLoginMethods } from '../mobile/src/domain/auth-entry.ts';

test('the public Android app offers Google sign-in without the judge guest path', () => {
  assert.deepEqual(availableLoginMethods('android'), { google: true, guest: false });
});

test('the web keeps both Google sign-in and the existing judge guest path', () => {
  assert.deepEqual(availableLoginMethods('web'), { google: true, guest: true });
});
