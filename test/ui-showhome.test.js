import { test } from "node:test";
import assert from "node:assert/strict";
import { INDEX_HTML } from "../src/ui.js";

// Regression test for: after deleting a mailbox, showHome() returned to the
// home page but the "created" card kept showing the deleted mailbox's
// address and access code, because showHome() only switched views.
// The UI is one HTML string, so this test inspects the shipped showHome()
// body instead of running a DOM.
function showHomeBody() {
  const start = INDEX_HTML.indexOf("function showHome()");
  assert.notEqual(start, -1, "showHome() must exist in the shipped UI");
  const end = INDEX_HTML.indexOf("function loadMe()", start);
  assert.notEqual(end, -1, "loadMe() must follow showHome()");
  return INDEX_HTML.slice(start, end);
}

test("showHome() hides and clears the created-mailbox card", () => {
  const body = showHomeBody();
  assert.ok(body.includes("$('created').classList.add('hidden')"));
  assert.ok(body.includes("$('created-address').textContent = ''"));
  assert.ok(body.includes("$('created-code').textContent = ''"));
  assert.ok(body.includes("$('created-expiry').textContent = ''"));
});

test("showHome() clears the login form and stale inbox state", () => {
  const body = showHomeBody();
  assert.ok(body.includes("$('login-address').value = ''"));
  assert.ok(body.includes("$('login-code').value = ''"));
  assert.ok(body.includes("$('code-panel').classList.add('hidden')"));
  assert.ok(body.includes("$('msg-list').innerHTML = ''"));
  assert.ok(body.includes("state.me = null"));
  assert.ok(body.includes("state.activeId = null"));
});

test("creating a mailbox still shows the created card (no over-clearing)", () => {
  assert.ok(INDEX_HTML.includes("$('created').classList.remove('hidden')"));
  assert.ok(INDEX_HTML.includes("$('created-address').textContent = r.address"));
  assert.ok(INDEX_HTML.includes("$('created-code').textContent = r.accessCode"));
});
