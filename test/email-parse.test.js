import { test } from "node:test";
import assert from "node:assert/strict";
import PostalMime from "postal-mime";
import { extractOtpCodes } from "../src/lib/otp.js";

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
