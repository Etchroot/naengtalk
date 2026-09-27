import assert from 'node:assert/strict';
import test from 'node:test';

import { getAppFontFamily } from '../mobile/src/domain/typography.ts';

test('regular text uses SUIT Regular', () => {
  assert.equal(getAppFontFamily(undefined), 'SUIT-Regular');
  assert.equal(getAppFontFamily('normal'), 'SUIT-Regular');
  assert.equal(getAppFontFamily('400'), 'SUIT-Regular');
});

test('medium and semibold weights preserve the app hierarchy with SUIT', () => {
  assert.equal(getAppFontFamily('500'), 'SUIT-Medium');
  assert.equal(getAppFontFamily(600), 'SUIT-SemiBold');
});

test('bold labels and numeric heavy weights use SUIT Bold', () => {
  assert.equal(getAppFontFamily('bold'), 'SUIT-Bold');
  assert.equal(getAppFontFamily('700'), 'SUIT-Bold');
  assert.equal(getAppFontFamily(900), 'SUIT-Bold');
});
