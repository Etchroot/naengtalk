import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLocalTodayPresentation,
  isPastUseBy,
} from "../mobile/src/domain/date-presentation.ts";

test("today presentation uses the device-local calendar date", () => {
  assert.deepEqual(getLocalTodayPresentation(new Date(2026, 8, 27, 23, 45)), {
    key: "2026-09-27",
    label: "09.27",
  });
});

test("only a valid use-by date before local today is overdue", () => {
  assert.equal(isPastUseBy("2026-09-26", "2026-09-27"), true);
  assert.equal(isPastUseBy("2026-09-27", "2026-09-27"), false);
  assert.equal(isPastUseBy("2026-09-28", "2026-09-27"), false);
  assert.equal(isPastUseBy("날짜 없음", "2026-09-27"), false);
  assert.equal(isPastUseBy("2026-09-26", "invalid"), false);
});
