import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml } from "../src/lib/sanitize.js";

test("scripts and their content are removed", () => {
  const out = sanitizeEmailHtml('<p>hi</p><script>alert(1)</script>');
  assert.ok(!out.includes("script"));
  assert.ok(!out.includes("alert"));
  assert.ok(out.includes("hi"));
});

test("event handlers and javascript: URLs are stripped", () => {
  const out = sanitizeEmailHtml('<a href="javascript:alert(1)" onclick="x()">click</a>');
  assert.ok(!out.includes("javascript:"));
  assert.ok(!out.includes("onclick"));
  assert.ok(out.includes("click"));
});

test("normal https links survive with safe rel", () => {
  const out = sanitizeEmailHtml('<a href="https://example.com/reset">reset</a>');
  assert.ok(out.includes('href="https://example.com/reset"'));
  assert.ok(out.includes('rel="noopener noreferrer"'));
});

test("remote images are blocked by default", () => {
  const out = sanitizeEmailHtml('<img src="https://tracker.example/pixel.gif" alt="x">');
  assert.ok(out.includes("data-blocked-src"));
  assert.ok(!/<img[^>]*\ssrc=/.test(out));
});

test("remote images load only when explicitly allowed", () => {
  const out = sanitizeEmailHtml('<img src="https://cdn.example/photo.jpg">', { allowRemoteImages: true });
  assert.ok(/<img[^>]*\ssrc="https:\/\/cdn\.example\/photo\.jpg"/.test(out));
  assert.ok(out.includes('referrerpolicy="no-referrer"'));
});

test("inline data images and table layout survive", () => {
  const out = sanitizeEmailHtml(
    '<table cellpadding="0"><tr><td style="color:red">cell</td></tr></table><img src="data:image/png;base64,iVBORw0KGgo=">'
  );
  assert.ok(out.includes("<table"));
  assert.ok(out.includes("cell"));
  assert.ok(out.includes("data:image/png;base64"));
});

test("style attributes with url() are dropped, others kept", () => {
  const bad = sanitizeEmailHtml('<div style="background:url(https://evil.example/x)">a</div>');
  assert.ok(!bad.includes("evil.example"));
  const good = sanitizeEmailHtml('<div style="font-weight:bold">a</div>');
  assert.ok(good.includes("font-weight:bold"));
});

test("form and iframe elements are removed with content", () => {
  const out = sanitizeEmailHtml('<form action="https://evil.example"><input value="x"></form><iframe src="https://evil.example"></iframe><p>ok</p>');
  assert.ok(!out.includes("evil.example"));
  assert.ok(out.includes("ok"));
});
