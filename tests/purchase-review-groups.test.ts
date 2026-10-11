import assert from 'node:assert/strict';
import test from 'node:test';
import { groupPurchaseReviewSources } from '../mobile/src/features/naengtalk/modals/purchase-review-groups.ts';

test('groups each photo with only its linked rows and failures in photo order', () => {
  const photos = [{ id: 'b', label: 'B', uri: 'b.jpg' }, { id: 'a', label: 'A', uri: 'a.jpg' }];
  const rows = [{ id: 'a1', sourceId: 'a', name: '수정한 두부' }, { id: 'b1', sourceId: 'b', name: '우유' }, { id: 'a2', sourceId: 'a', name: '쌀' }];
  const groups = groupPurchaseReviewSources(photos, rows, [{ id: 'b', error: '읽기 실패' }]);
  assert.deepEqual(groups.map(g => [g.id, g.selection?.uri, g.rows.map(r => r.id), g.failures.map(f => f.id)]), [
    ['b', 'b.jpg', ['b1'], ['b']], ['a', 'a.jpg', ['a1', 'a2'], []],
  ]);
  assert.equal(groups[1].rows[0], rows[0]);
});

test('direct entry and missing originals keep all review rows without invented photos', () => {
  const groups = groupPurchaseReviewSources([], [{ id: 'd1', sourceId: 'direct' }, { id: 'd2', sourceId: 'direct' }, { id: 'o', sourceId: 'gone' }], [{ id: 'failed' }]);
  assert.deepEqual(groups.map(g => [g.id, g.selection, g.rows.map(r => r.id), g.failures.map(f => f.id)]), [
    ['direct', undefined, ['d1', 'd2'], []], ['gone', undefined, ['o'], []], ['failed', undefined, [], ['failed']],
  ]);
});

test('photos with zero food results remain available for original inspection', () => {
  assert.deepEqual(groupPurchaseReviewSources([{ id: 'empty', label: '사진', uri: 'empty.jpg' }], [], []).map(g => [g.id, g.rows.length]), [['empty', 0]]);
});
