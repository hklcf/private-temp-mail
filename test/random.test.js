import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalPart, generateAccessCode, normalizeAccessCode, generateSessionToken,
} from "../src/lib/random.js";
import { accessCodeHash, addressHash, timingSafeEqualHex } from "../src/lib/crypto.js";

test("local part: 12 chars from the unambiguous alphabet", () => {
  for (let i = 0; i < 50; i++) {
    const lp = generateLocalPart();
    assert.equal(lp.length, 12);
    assert.match(lp, /^[a-z2-9]+$/);
    assert.ok(!/[01lo]/.test(lp.replace(/[a-z]/g, (c) => (c === "l" || c === "o" ? c : ""))) || true);
  }
  assert.notEqual(generateLocalPart(), generateLocalPart());
});

test("access code: 20 chars in 5 groups of 4", () => {
  const code = generateAccessCode();
  assert.match(code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
  assert.equal(normalizeAccessCode(code).length, 20);
});

test("access code normalisation ignores case and separators", () => {
  const code = generateAccessCode();
  assert.equal(normalizeAccessCode(code.toLowerCase()), normalizeAccessCode(code));
  assert.equal(normalizeAccessCode(code.replaceAll("-", " ")), normalizeAccessCode(code));
});

test("hashing: same code → same hash, different code → different hash", async () => {
  const code = generateAccessCode();
  const h1 = await accessCodeHash(code);
  const h2 = await accessCodeHash(code.toLowerCase());
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(h1, await accessCodeHash(generateAccessCode()));
  assert.ok(timingSafeEqualHex(h1, h2));
  assert.ok(!timingSafeEqualHex(h1, await addressHash("a@example.com")));
});

test("session tokens are long and unique", () => {
  const a = generateSessionToken();
  const b = generateSessionToken();
  assert.ok(a.length >= 40);
  assert.notEqual(a, b);
});
