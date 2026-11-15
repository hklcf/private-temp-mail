import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS, validateDays, computeExpiresAt, computeExtendedExpiry, daysRemaining, isExpired,
} from "../src/lib/time.js";

const NOW = 1_700_000_000_000;

test("validateDays only accepts the spec options", () => {
  for (const d of [7, 30, 90, 180, 365]) assert.equal(validateDays(d), d);
  assert.equal(validateDays("30"), 30);
  assert.equal(validateDays(8), null);
  assert.equal(validateDays(0), null);
  assert.equal(validateDays(undefined, 7), 7);
  assert.equal(validateDays("abc"), null);
});

test("expiry = creation + chosen days", () => {
  assert.equal(computeExpiresAt(NOW, 7), NOW + 7 * DAY_MS);
  assert.equal(computeExpiresAt(NOW, 365), NOW + 365 * DAY_MS);
});

test("extend adds to the current expiry, not to today", () => {
  const expires = NOW + 2 * DAY_MS; // 2 days left
  const r = computeExtendedExpiry(expires, 30, NOW);
  assert.equal(r.expiresAt, NOW + 32 * DAY_MS);
  assert.equal(r.appliedDays, 30);
  assert.equal(r.capped, false);
  assert.equal(r.changed, true);
});

test("extend is capped at today + 365 days", () => {
  const expires = NOW + 300 * DAY_MS;
  const r = computeExtendedExpiry(expires, 365, NOW);
  assert.equal(r.expiresAt, NOW + 365 * DAY_MS);
  assert.equal(r.appliedDays, 65);
  assert.equal(r.capped, true);
});

test("extend at the cap changes nothing", () => {
  const expires = NOW + 365 * DAY_MS;
  const r = computeExtendedExpiry(expires, 7, NOW);
  assert.equal(r.changed, false);
  assert.equal(r.expiresAt, expires);
});

test("daysRemaining and isExpired", () => {
  assert.equal(daysRemaining(NOW + 3 * DAY_MS + 1000, NOW), 3);
  assert.equal(daysRemaining(NOW - 1, NOW), 0);
  assert.ok(isExpired(NOW, NOW));
  assert.ok(!isExpired(NOW + 1, NOW));
});
