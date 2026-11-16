// Best-effort one-time-code (OTP) detection for the inbox UI.
// Verification codes are the #1 reason people use a temporary mailbox,
// so the UI surfaces likely codes as big copy-to-clipboard chips.
// This is a convenience heuristic only — it never gates any behaviour.

const KEYWORD_RE =
  /(?:verification|verify|one[- ]?time|passcode|otp|security code|login code|auth code|code|驗證碼|驗證|認證碼|確認碼)[^\d]{0,32}(\d[\d\s-]{2,9}\d)/gi;
const GROUPED_RE = /\b(\d{3})[\s-](\d{3})\b/g;
const STANDALONE_LINE_RE = /^\s*(\d{4,8})\s*$/gm;

function clean(raw) {
  return raw.replace(/[\s-]/g, "");
}

function plausible(code, fullText) {
  if (!/^\d{4,8}$/.test(code)) return false;
  // Avoid flagging things that are almost certainly years or counters.
  if (/^(19|20)\d{2}$/.test(code) && !/code|驗證/i.test(fullText)) return false;
  if (/^(\d)\1+$/.test(code)) return false; // 1111, 000000 …
  return true;
}

/**
 * Visible text of an HTML email body: style/script/comments stripped,
 * tags replaced by spaces, common entities decoded, whitespace collapsed.
 * Used when a message has no text/plain part, so code detection and the
 * inbox preview still have something to read. Tags are stripped before
 * entities are decoded, so digits inside attributes (widths, colours,
 * tracking ids) can never be mistaken for a code.
 */
export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns up to 5 unique candidate codes found in the given text. */
export function extractOtpCodes(text) {
  const src = String(text ?? "");
  if (!src) return [];
  const found = [];
  const push = (code) => {
    if (plausible(code, src) && !found.includes(code) && found.length < 5) found.push(code);
  };

  for (const m of src.matchAll(KEYWORD_RE)) push(clean(m[1]));
  for (const m of src.matchAll(GROUPED_RE)) push(m[1] + m[2]);
  if (found.length === 0) {
    for (const m of src.matchAll(STANDALONE_LINE_RE)) push(m[1]);
  }
  return found;
}
