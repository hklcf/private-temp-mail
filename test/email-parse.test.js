import { test } from "node:test";
import assert from "node:assert/strict";
import PostalMime from "postal-mime";
import { extractOtpCodes, htmlToText } from "../src/lib/otp.js";

// The inbound handler parses with postal-mime exactly like this.
const SAMPLE = [
  "From: Sender <sender@example.org>",
  "To: abc123@example.com",
  "Subject: Your login code",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="BB"',
  "",
  "--BB",
  'Content-Type: text/plain; charset="utf-8"',
  "",
  "Your verification code is 246810.",
  "--BB",
  'Content-Type: text/plain; name="note.txt"',
  'Content-Disposition: attachment; filename="note.txt"',
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("hello attachment").toString("base64"),
  "--BB--",
  "",
].join("\r\n");

test("postal-mime parses subject, text and attachments", async () => {
  const parsed = await PostalMime.parse(new TextEncoder().encode(SAMPLE).buffer);
  assert.equal(parsed.subject, "Your login code");
  assert.equal(parsed.from.address, "sender@example.org");
  assert.ok(parsed.text.includes("246810"));
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].filename, "note.txt");
});

test("otp extraction on the parsed body", async () => {
  const parsed = await PostalMime.parse(new TextEncoder().encode(SAMPLE).buffer);
  assert.deepEqual(extractOtpCodes(parsed.text), ["246810"]);
});

// Regression test for: a Meta confirmation email's code was not detected.
// That mail is HTML-only — postal-mime finds no text/plain part, so the
// old handler scanned an empty string and stored otp_codes []. The code
// only exists in the HTML part, so the handler must fall back to the
// HTML part's visible text when there is no text part.
const HTML_ONLY_SAMPLE = [
  "From: Meta <security@account.meta.com>",
  "To: abc123@example.com",
  "Subject: 確認你的新 Meta 帳戶的電郵地址",
  "MIME-Version: 1.0",
  'Content-Type: text/html; charset="utf-8"',
  "",
  '<html><body><table><tr><td>&nbsp; 請輸入以下確認碼，為你的新 Meta 帳戶確認電郵地址。 確認碼 227091 如果你沒有索取確認碼，可以略過此訊息。 &nbsp;</td></tr></table></body></html>',
  "",
].join("\r\n");

test("HTML-only mail: no text part, code only in HTML", async () => {
  const parsed = await PostalMime.parse(new TextEncoder().encode(HTML_ONLY_SAMPLE).buffer);
  assert.ok(!parsed.text, "HTML-only mail must have no text/plain part");
  assert.ok(parsed.html.includes("227091"));
  // The old path (scan text only) finds nothing — that was the bug.
  assert.deepEqual(extractOtpCodes([parsed.subject ?? "", parsed.text ?? ""].join("\n")), []);
  // The fallback (visible text of the HTML part) finds the code.
  const bodyText = (parsed.text ?? "").trim() ? parsed.text : htmlToText(parsed.html ?? "");
  assert.deepEqual(extractOtpCodes([parsed.subject ?? "", bodyText].join("\n")), ["227091"]);
});
