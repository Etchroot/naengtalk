import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const productPlan = read('../docs/PRODUCT_PLAN.md');
const rootReadme = read('../README.md');
const mobileReadme = read('../mobile/README.md');
const todo = read('../TODO.md');
const userFlow = read('../docs/USER_FLOW.md');

test('product plan matches the current demo and AI architecture', () => {
  assert.match(productPlan, /30종/);
  assert.match(productPlan, /16종/);
  assert.match(productPlan, /Android·웹 공통.*OpenAI.*비전/);
  assert.match(productPlan, /공공.*(?:→|->).*공유.*(?:→|->).*Terra/);
  assert.doesNotMatch(productPlan, /Android의 민감한 구매내역 OCR은 기기에서 처리/);
  assert.doesNotMatch(productPlan, /실제 게스트 시드는 최소 10종/);
});

test('readmes route contributors to the current project documents and commands', () => {
  assert.match(rootReadme, /docs\/USER_FLOW\.md/);
  assert.match(rootReadme, /docs\/SUPABASE_AUDIT\.md/);
  assert.match(rootReadme, /https:\/\/naengtalk\.expo\.app/);
  assert.match(mobileReadme, /pnpm web/);
  assert.match(mobileReadme, /pnpm android/);
  assert.match(mobileReadme, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(mobileReadme, /create-expo-app/i);
  assert.doesNotMatch(mobileReadme, /reset-project/i);
});

test('remaining release work is explicit and does not claim unfinished native work is done', () => {
  assert.match(todo, /Google OAuth/);
  assert.match(todo, /OCR/);
  assert.match(todo, /Android.*APK/);
  assert.match(todo, /제출/);
  assert.match(todo, /알림.*후속|후속.*알림/);
});

test('user flow maps every primary tab and critical mutation branch', () => {
  assert.match(userFlow, /flowchart/);
  for (const label of ['홈', '채팅', '재고', '레시피', '조리도구', '설정']) {
    assert.match(userFlow, new RegExp(label));
  }
  for (const label of [
    '게스트 로그인',
    'Google 로그인',
    '구매내역 캡처 등록',
    '직접 입력',
    '재고 변경 검수',
    '공공 레시피',
    '공유 레시피',
    'Terra',
    '요리 완료',
    '공유 동의',
    '샘플 데이터 초기화',
    '로그아웃',
  ]) {
    assert.match(userFlow, new RegExp(label));
  }
});
