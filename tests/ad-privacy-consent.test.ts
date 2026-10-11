import assert from "node:assert/strict";
import test from "node:test";
import { createAdPrivacyConsent } from "../mobile/src/features/naengtalk/components/ad-privacy-consent.ts";

const required = { canRequestAds: true, privacyOptionsRequirementStatus: "REQUIRED" };
const blocked = { canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" };

test("concurrent consumers share one consent gathering request", async () => {
  let calls = 0;
  const consent = createAdPrivacyConsent({
    gatherConsent: async () => { calls++; return required; },
    getConsentInfo: async () => required,
    showPrivacyOptionsForm: async () => blocked,
  });

  const [banner, settings] = await Promise.all([consent.initialize(), consent.initialize()]);
  assert.equal(calls, 1);
  assert.deepEqual(banner, required);
  assert.deepEqual(settings, required);
});

test("privacy form changes immediately update subscribers' ad permission", async () => {
  const seen: boolean[] = [];
  const consent = createAdPrivacyConsent({
    gatherConsent: async () => required,
    getConsentInfo: async () => required,
    showPrivacyOptionsForm: async () => blocked,
  });
  consent.subscribe((info) => seen.push(info.canRequestAds));

  await consent.initialize();
  await consent.openPrivacyOptions();
  assert.deepEqual(seen, [true, false]);
});

test("a failed consent gathering request uses last known permission", async () => {
  const consent = createAdPrivacyConsent({
    gatherConsent: async () => { throw new Error("network"); },
    getConsentInfo: async () => required,
    showPrivacyOptionsForm: async () => blocked,
  });
  assert.deepEqual(await consent.initialize(), required);
});

test("a banner subscribing after initialization receives the current permission", async () => {
  const consent = createAdPrivacyConsent({
    gatherConsent: async () => required,
    getConsentInfo: async () => required,
    showPrivacyOptionsForm: async () => blocked,
  });
  await consent.initialize();
  const seen: boolean[] = [];
  consent.subscribe((info) => seen.push(info.canRequestAds));
  assert.deepEqual(seen, [true]);
});
