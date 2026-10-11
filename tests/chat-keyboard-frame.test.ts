import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChatKeyboardHeight } from '../mobile/src/domain/chat-keyboard-frame.ts';

test('overlay keyboard limits canvas to its top minus measured canvas origin', () => {
  assert.equal(getChatKeyboardHeight(780, 500, 24), 476);
});
test('already resized window is not reduced by keyboard height twice', () => {
  assert.equal(getChatKeyboardHeight(460, 500, 24), 460);
});
test('closed keyboard restores full height and ignores invalid measurements', () => {
  assert.equal(getChatKeyboardHeight(780, null, 24), 780);
  assert.equal(getChatKeyboardHeight(780, NaN, 24), 780);
});
test('keyboard above canvas cannot produce a negative height', () => {
  assert.equal(getChatKeyboardHeight(780, 10, 24), 0);
});
test('Android window-relative canvas measurement includes the screen origin inset', () => {
  assert.equal(getChatKeyboardHeight(780, 500, 0, 24), 476);
  assert.equal(getChatKeyboardHeight(780, 500, 10, 32), 458);
});
test('screen origin correction does not reduce an already smaller resized window', () => {
  assert.equal(getChatKeyboardHeight(450, 500, 0, 24), 450);
  assert.equal(getChatKeyboardHeight(780, null, 0, 24), 780);
});
