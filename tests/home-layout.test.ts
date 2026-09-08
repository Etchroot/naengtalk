import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHomeActionTitleFontSize,
  getUrgentInventoryLimit,
  getUrgentCardMinHeight,
} from '../mobile/src/domain/home-layout.ts';

test('four urgent inventory rows fit inside their card', () => {
  assert.equal(getUrgentCardMinHeight(4), 308);
});

test('urgent card height grows for every additional visible row', () => {
  assert.equal(getUrgentCardMinHeight(1), 164);
  assert.equal(getUrgentCardMinHeight(6), 404);
});

test('home action titles shrink on narrow phone frames and grow on wider frames', () => {
  assert.equal(getHomeActionTitleFontSize(300), 14);
  assert.equal(getHomeActionTitleFontSize(336), 15);
  assert.equal(getHomeActionTitleFontSize(400), 17);
});

test('urgent inventory expands from four to at most six items when height allows', () => {
  assert.equal(getUrgentInventoryLimit(700), 4);
  assert.equal(getUrgentInventoryLimit(736), 5);
  assert.equal(getUrgentInventoryLimit(784), 6);
  assert.equal(getUrgentInventoryLimit(1200), 6);
});
