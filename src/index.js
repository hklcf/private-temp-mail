// Private Temp Mail — Worker entry point.
//   fetch     → web UI + JSON API
//   email     → inbound mail via Cloudflare Email Routing (catch-all)
//   scheduled → hourly cleanup of expired mailboxes

import { handleApi } from "./api.js";
import { handleEmail } from "./email-handler.js";
import { cleanupExpired } from "./db.js";
import { INDEX_HTML } from "./ui.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      if (url.pathname === "/health") return new Response("ok", { status: 200 });
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(INDEX_HTML, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy":
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'",
          },
        });
      }
      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("fetch handler error:", err);
      return new Response(JSON.stringify({ error: "伺服器錯誤，請稍後再試" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  },

  async email(message, env) {
    try {
      await handleEmail(message, env);
    } catch (err) {
      console.error("email handler error:", err);
      message.setReject("Temporary processing error");
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      cleanupExpired(env, Date.now()).then((n) => {
        if (n) console.log(`cleanup: removed ${n} expired mailbox(es)`);
      })
    );
  },
};
