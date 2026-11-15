import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

// Regression test for: "顯示外來圖片" toggled the button but the images
// stayed broken. The mail body renders in a srcdoc iframe, which inherits
// the parent page's CSP as an extra policy on top of its own <meta> CSP,
// so a remote image must pass BOTH. The page CSP said
// "img-src 'self' data:", which blocked every remote image even after the
// reader opted in and the srcdoc CSP allowed https:. The page CSP must
// therefore allow https: images too; the srcdoc document's own CSP still
// blocks remote images by default and only allows them per-message opt-in.
test("home page CSP lets opted-in remote images load in the mail iframe", async () => {
  const res = await worker.fetch(new Request("https://mail.example/"), {});
  assert.equal(res.status, 200);
  const csp = res.headers.get("Content-Security-Policy");
  assert.ok(csp, "home page must send a Content-Security-Policy");
  const imgSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("img-src"));
  assert.ok(imgSrc, "CSP must have an img-src directive");
  assert.ok(imgSrc.includes("https:"), `img-src must allow https:, got: ${imgSrc}`);
  assert.ok(imgSrc.includes("'self'"), `img-src must still allow 'self', got: ${imgSrc}`);
  assert.ok(imgSrc.includes("data:"), `img-src must still allow data:, got: ${imgSrc}`);
});
