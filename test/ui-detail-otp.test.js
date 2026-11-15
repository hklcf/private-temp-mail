import { test } from "node:test";
import assert from "node:assert/strict";
import { INDEX_HTML } from "../src/ui.js";

// Regression test for: clicking an OTP chip in the message detail view
// ("可能係驗證碼（撳嚟複製）") did nothing. openMessage() rendered the
// chips but never attached a click handler — only the message list had
// one, so the detail chips were dead. The UI is one HTML string, so this
// test inspects the shipped openMessage() body instead of running a DOM.
function openMessageBody() {
  const start = INDEX_HTML.indexOf("function openMessage(id, images)");
  assert.notEqual(start, -1, "openMessage() must exist in the shipped UI");
  return INDEX_HTML.slice(start);
}

test("openMessage() wires click-to-copy on the detail-view OTP chips", () => {
  const body = openMessageBody();
  assert.ok(body.includes("querySelectorAll('.otp')"),
    "detail view must find its .otp chips");
  assert.ok(body.includes("addEventListener('click'"),
    "detail view must attach a click handler to the OTP chips");
  assert.ok(body.includes("copyText(s.textContent.trim(), null)"),
    "clicking a detail OTP chip must copy its text");
});

test("the detail view still renders the OTP chips with the copy hint", () => {
  const body = openMessageBody();
  assert.ok(body.includes("可能係驗證碼（撳嚟複製）"));
  assert.ok(body.includes("class=\"otp big\""));
});

test("the message list OTP click-to-copy is still intact", () => {
  const start = INDEX_HTML.indexOf("function loadMessages()");
  assert.notEqual(start, -1, "loadMessages() must exist in the shipped UI");
  const body = INDEX_HTML.slice(start, INDEX_HTML.indexOf("function openMessage(id, images)"));
  assert.ok(body.includes("classList.contains('otp')"));
  assert.ok(body.includes("copyText(e.target.textContent.trim(), null)"));
});
