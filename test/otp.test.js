import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOtpCodes } from "../src/lib/otp.js";

test("english keyword code", () => {
  assert.deepEqual(extractOtpCodes("Your verification code is 123456. It expires in 10 minutes."), ["123456"]);
});

test("chinese keyword code", () => {
  assert.deepEqual(extractOtpCodes("您的驗證碼：8899，請勿洩漏。"), ["8899"]);
});

test("grouped code 123-456", () => {
  assert.deepEqual(extractOtpCodes("Enter this code to continue: 123-456"), ["123456"]);
});

test("standalone code on its own line (fallback)", () => {
  assert.deepEqual(extractOtpCodes("Hello,\n\n654321\n\nThanks"), ["654321"]);
});

test("no code in ordinary text", () => {
  assert.deepEqual(extractOtpCodes("Your order has shipped and will arrive on Tuesday."), []);
  assert.deepEqual(extractOtpCodes(""), []);
  assert.deepEqual(extractOtpCodes(null), []);
});
