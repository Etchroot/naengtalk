import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const comparisonPath = new URL('../docs/font-comparison.html', import.meta.url);

test('font comparison presents every candidate with the requested Korean copy', async () => {
  const html = await readFile(comparisonPath, 'utf8');

  for (const label of [
    '현재 시스템 폰트',
    'SUIT',
    'Pretendard',
    'LINE Seed Sans KR',
    'Noto Sans KR',
  ]) {
    assert.match(html, new RegExp(label));
  }

  assert.match(html, /먼저 먹으면 좋겠어요/);
  assert.match(html, /아직 완료한 요리가 없어요\./);
  assert.match(html, /id="font-size"/);
  assert.match(html, /id="font-weight"/);
});
