import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOtpCodes, htmlToText } from "../src/lib/otp.js";

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

test("htmlToText strips tags and decodes entities", () => {
  assert.equal(
    htmlToText('<p>Hello&nbsp;world</p><style>.a{color:#1c2430}</style><a href="https://example.com/?x=1">link&#064;mail</a>'),
    "Hello world link@mail"
  );
});

test("htmlToText drops digits that only exist in attributes", () => {
  const out = htmlToText('<img src="https://cdn.example/pixel.gif" width="600" height="400"><div style="font-size:14px">no code here</div>');
  assert.ok(!/\d{4,8}/.test(out), `attribute digits must not survive: ${out}`);
  assert.deepEqual(extractOtpCodes(out), []);
});

test("code found in HTML visible text (Meta-style HTML-only mail)", () => {
  const html = '<table><tr><td>&nbsp; 請輸入以下確認碼，為你的新 Meta 帳戶確認電郵地址。 確認碼 227091 如果你沒有索取確認碼，可以略過此訊息。 &nbsp;</td></tr></table>';
  assert.deepEqual(extractOtpCodes(htmlToText(html)), ["227091"]);
});
