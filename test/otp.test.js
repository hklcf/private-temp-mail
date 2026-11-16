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

test("GitHub launch code: UUID in verification link is not a second code", () => {
  const text = `Here's your GitHub launch code!

Continue signing up for GitHub by entering the code below:

53447232

You can enter it by visiting the link below:

https://github.com/account_verifications?verification=0640131f-25a8-430e-abe0-4efb28767a2b&via_launch_code_email=true

You’re receiving this email because you recently created a new GitHub account. If this wasn’t you, please ignore this email.

Not able to enter the code? Paste the following link into your browser:

https://github.com/account_verifications/confirm/0640131f-25a8-430e-abe0-4efb28767a2b/53447232

---
Sent with <3 by GitHub.
GitHub, Inc. 88 Colin P Kelly Jr Street
San Francisco, CA 94107
`;
  assert.deepEqual(extractOtpCodes(text), ["53447232"]);
});

test("digit run followed by a letter is a token fragment, not a code", () => {
  assert.deepEqual(
    extractOtpCodes("https://github.com/account_verifications?verification=0640131f-25a8-430e-abe0-4efb28767a2b"),
    []
  );
  assert.deepEqual(extractOtpCodes("Your verification code is 123456. It expires in 10 minutes."), ["123456"]);
});

test("simplified Chinese keywords: Unicom mail is detected", () => {
  const text = "亲爱的客户： 请输入一次性验证码【 807470 】以完成电邮地址校验。验证码于10分钟内有效。 感谢您使用我们的服务。 中国联通（香港）运营有限公司 这封是来自中国联通（香港）运营有限公司的服务电邮。请勿回复此电邮。";
  assert.deepEqual(extractOtpCodes(text), ["807470"]);
});

test("simplified Chinese keyword variants", () => {
  assert.deepEqual(extractOtpCodes("您的验证码是 123456，请勿泄露。"), ["123456"]);
  assert.deepEqual(extractOtpCodes("您的确认码为 654321，有效期10分钟。"), ["654321"]);
  assert.deepEqual(extractOtpCodes("请使用以下认证码完成验证：789012"), ["789012"]);
});
