import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getChatComposerLayout,
  getAndroidWebFrame,
  getKeyboardAwareWebFrame,
  getPhoneShellStyle,
  getResponsiveAppCanvas,
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

test("focused mobile web chat keeps the original phone frame when the keyboard reduces viewport height", () => {
  assert.deepEqual(
    getKeyboardAwareWebFrame(
      { width: 390, height: 480 },
      { width: 390, height: 844 },
      true,
    ),
    {
      frame: { width: 366, height: 813 },
      keyboardOpen: true,
    },
  );
});

test("ordinary viewport changes still resize the web frame", () => {
  assert.deepEqual(
    getKeyboardAwareWebFrame(
      { width: 390, height: 480 },
      { width: 390, height: 844 },
      false,
    ),
    {
      frame: { width: 205, height: 456 },
      keyboardOpen: false,
    },
  );
});

test("chat composer reserves a fixed send button without overflowing narrow phone frames", () => {
  const layout = getChatComposerLayout(366);
  assert.deepEqual(layout, {
    horizontalPadding: 12,
    gap: 8,
    sendButtonWidth: 64,
  });
  assert.ok(366 - 16 - layout.horizontalPadding * 2 - layout.gap - layout.sendButtonWidth >= 240);
});

test("the complete app canvas scales uniformly instead of reflowing on a small device", () => {
  assert.deepEqual(getResponsiveAppCanvas(360, 800), {
    designWidth: 360,
    designHeight: 800,
    scale: 1,
    renderedWidth: 360,
    renderedHeight: 800,
  });

  assert.deepEqual(getResponsiveAppCanvas(205, 456), {
    designWidth: 360,
    designHeight: 800,
    scale: 205 / 360,
    renderedWidth: 205,
    renderedHeight: 456,
  });
});
