import { test } from "node:test";
import assert from "node:assert/strict";
import { getAndroidWebFrame } from "../mobile/src/domain/web-frame.ts";

test("wide web screens use a 9:20 Android frame that nearly fills the height", () => {
  const frame = getAndroidWebFrame(1440, 1000);
  assert.deepEqual(frame, { width: 439, height: 976 });
});

test("narrow screens keep the frame inside the horizontal margin", () => {
  const frame = getAndroidWebFrame(390, 844);
  assert.deepEqual(frame, { width: 366, height: 813 });
});
