// Server-side HTML sanitiser for received email.
//
// Received mail is attacker-controlled HTML. Two layers of defence are used:
//   1. This sanitiser strips scripts, dangerous tags/attributes and
//      javascript:/data:text URLs before anything reaches the browser.
//   2. The web UI additionally renders message HTML inside a sandboxed
//      iframe (no scripts, no same-origin access), so even a sanitiser
//      miss cannot reach the mailbox session.
//
// Remote images are blocked by default (tracking pixels): the <img> is kept
// as an empty placeholder until the reader explicitly opts in per message,
// in which case the original https src is restored with no-referrer.

const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|form|button|textarea|select|option|link|meta|base|title|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DROP_STANDALONE =
  /<(script|style|iframe|object|embed|form|input|link|meta|base|svg|math)\b[^>]*\/?>/gi;

function cleanAttributes(tagName, attrText, { allowRemoteImages }) {
  let out = "";
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = attrRe.exec(attrText)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";

    if (name.startsWith("on")) continue; // event handlers
    if (name === "formaction" || name === "action" || name === "xlink:href") continue;

    if (name === "href" || name === "src") {
      const v = value.trim();
      const isImg = tagName === "img" && name === "src";
      if (/^(https?:|mailto:)/i.test(v) || v.startsWith("#")) {
        if (isImg && !allowRemoteImages) {
          out += ` data-blocked-src="${escapeAttr(v)}"`;
          continue;
        }
        out += ` ${name}="${escapeAttr(v)}"`;
        if (isImg) out += ` referrerpolicy="no-referrer" loading="lazy"`;
      } else if (isImg && /^data:image\/(png|gif|jpe?g|webp);base64,/i.test(v)) {
        out += ` ${name}="${escapeAttr(v)}"`; // inline images are part of the mail itself
      }
      continue; // anything else (javascript:, vbscript:, data:text/html …) is dropped
    }

    if (name === "style") {
      if (/url\s*\(|expression\s*\(|javascript:|-moz-binding/i.test(value)) continue;
      out += ` style="${escapeAttr(value)}"`;
      continue;
    }

    if (["alt", "title", "width", "height", "align", "valign", "colspan", "rowspan",
         "cellpadding", "cellspacing", "border", "bgcolor", "color", "dir", "lang"].includes(name)) {
      out += ` ${name}="${escapeAttr(value)}"`;
    }
    // every other attribute is dropped
  }
  return out;
}

function escapeAttr(v) {
  return String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * Sanitise an email HTML body.
 * @param {string} html raw HTML from the message
 * @param {{allowRemoteImages?: boolean}} opts
 * @returns {string} HTML safe to place inside a sandboxed iframe
 */
export function sanitizeEmailHtml(html, { allowRemoteImages = false } = {}) {
  let out = String(html ?? "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(DROP_WITH_CONTENT, "");
  out = out.replace(DROP_STANDALONE, "");
  out = out.replace(/<!doctype[^>]*>/gi, "");

  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g,
    (match, slash, tagRaw, attrs, selfClose) => {
      const tag = tagRaw.toLowerCase();
      if (slash) return `</${tag}>`;
      let cleaned = cleanAttributes(tag, attrs, { allowRemoteImages });
      if (tag === "a") cleaned += ` target="_blank" rel="noopener noreferrer"`;
      return `<${tag}${cleaned}${selfClose ? " /" : ""}>`;
    });

  return out;
}

/** Wrap sanitised HTML in a minimal document for iframe srcdoc display. */
export function emailHtmlDocument(sanitizedHtml, { allowRemoteImages = false } = {}) {
  const imgSrc = allowRemoteImages ? "https: data:" : "data:";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:;">
<style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;color:#1c2430;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#0b5fff}table{max-width:100%}pre{white-space:pre-wrap}</style>
</head><body>${sanitizedHtml}</body></html>`;
}
