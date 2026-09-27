import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as homeLayout from '../mobile/src/domain/home-layout.ts';
import {
  getCompactHeaderMetrics,
  getHomeActionTitleFontSize,
  getRefrigeratorHandleScaleY,
  getRefrigeratorHandlePlacement,
  getToolCardLayout,
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
  assert.equal(getHomeActionTitleFontSize(300), 16);
  assert.equal(getHomeActionTitleFontSize(336), 17);
  assert.equal(getHomeActionTitleFontSize(400), 19);
});

test('urgent inventory expands from four to at most six items when height allows', () => {
  assert.equal(getUrgentInventoryLimit(700), 4);
  assert.equal(getUrgentInventoryLimit(736), 5);
  assert.equal(getUrgentInventoryLimit(784), 6);
  assert.equal(getUrgentInventoryLimit(1200), 6);
});

test('refrigerator door surfaces use a full white inner rim and pastel Bespoke colors', () => {
  const getRefrigeratorDoorSurface = (
    homeLayout as unknown as {
      getRefrigeratorDoorSurface?: (
        tone: 'fresh' | 'warm' | 'neutral',
        pressed?: boolean,
      ) => {
        backgroundColor: string;
        borderColor: string;
        borderWidth: number;
        shadowOffset: { width: number; height: number };
        shadowOpacity: number;
        elevation: number;
        transform: Array<{ translateX?: number; translateY?: number }>;
      };
    }
  ).getRefrigeratorDoorSurface;

  assert.equal(typeof getRefrigeratorDoorSurface, 'function');

  const surface = getRefrigeratorDoorSurface!('fresh');
  assert.equal(surface.backgroundColor, '#eef5e9');
  assert.equal(surface.borderColor, '#ffffff');
  assert.equal(surface.borderWidth, 3);
  assert.deepEqual(surface.shadowOffset, { width: 5, height: 7 });
  assert.equal(surface.shadowOpacity, 0.24);
  assert.equal(surface.elevation, 6);
  assert.deepEqual(surface.transform, []);

  const neutral = getRefrigeratorDoorSurface!('neutral');
  assert.equal(neutral.backgroundColor, '#eaf3f7');

  const pressed = getRefrigeratorDoorSurface!('warm', true);
  assert.deepEqual(pressed.shadowOffset, { width: 2, height: 3 });
  assert.equal(pressed.shadowOpacity, 0.15);
  assert.equal(pressed.elevation, 2);
  assert.deepEqual(pressed.transform, [{ translateX: 2 }, { translateY: 3 }]);
});

test('common screen header gives the title and inline home tagline readable emphasis', () => {
  assert.deepEqual(getCompactHeaderMetrics(), {
    padding: 14,
    gap: 8,
    controlSize: 32,
    controlRadius: 10,
    logoSize: 28,
    homeIconSize: 17,
    titleFontSize: 21,
    titleLineHeight: 26,
    taglineFontSize: 13,
    taglineLineHeight: 18,
  });
});

test('refrigerator handles face the gap between the upper and lower doors', () => {
  assert.equal(getRefrigeratorHandlePlacement('fresh'), 'bottom');
  assert.equal(getRefrigeratorHandlePlacement('warm'), 'top');
  assert.equal(getRefrigeratorHandlePlacement('neutral'), 'top');
});

test('lower refrigerator doors invert the handle so it opens downward', () => {
  assert.equal(getRefrigeratorHandleScaleY('fresh'), 1);
  assert.equal(getRefrigeratorHandleScaleY('warm'), -1);
  assert.equal(getRefrigeratorHandleScaleY('neutral'), -1);
});

test('cooking tool cards form two square columns inside the app canvas', () => {
  assert.deepEqual(getToolCardLayout(360), {
    columns: 2,
    cardWidth: 158,
    aspectRatio: 1,
  });
  assert.deepEqual(getToolCardLayout(360, 8), {
    columns: 2,
    cardWidth: 150,
    aspectRatio: 1,
  });
});
