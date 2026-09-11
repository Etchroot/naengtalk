import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAndroidWebFrame,
  getPhoneShellStyle,
} from "../mobile/src/domain/web-frame.ts";

test("wide web screens use a 9:20 Android frame that nearly fills the height", () => {
  const frame = getAndroidWebFrame(1440, 1000);
  assert.deepEqual(frame, { width: 439, height: 976 });
});

test("narrow screens keep the frame inside the horizontal margin", () => {
  const frame = getAndroidWebFrame(390, 844);
  assert.deepEqual(frame, { width: 366, height: 813 });
});

test("web renders the app inside a rounded phone shell", () => {
  assert.deepEqual(getPhoneShellStyle("web"), {
    borderWidth: 8,
    borderColor: "#20251f",
    borderRadius: 38,
    overflow: "hidden",
    shadowColor: "#111811",
    shadowOpacity: 0.26,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  });
});

test("native platforms do not receive the decorative web phone shell", () => {
  assert.equal(getPhoneShellStyle("android"), undefined);
  assert.equal(getPhoneShellStyle("ios"), undefined);
});
