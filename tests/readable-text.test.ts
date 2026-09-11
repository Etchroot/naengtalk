import assert from 'node:assert/strict';
import test from 'node:test';

const readableText = await import('../mobile/src/domain/readable-text.ts').catch(() => ({}));

test('separate sentences start on a new line without breaking decimals or URLs', () => {
  const breakSentences = Reflect.get(readableText, 'breakSentences');
  assert.equal(typeof breakSentences, 'function');
  assert.equal(
    breakSentences('첫 번째 안내입니다. 다음 안내입니다. 2.5L 냄비와 https://example.com/a.b를 사용합니다.'),
    '첫 번째 안내입니다.\n다음 안내입니다.\n2.5L 냄비와 https://example.com/a.b를 사용합니다.',
  );
});
