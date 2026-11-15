// The single-page web UI, served by the Worker itself (no build step,
// zero external dependencies: system fonts, inline CSS/JS only).
// Message HTML is rendered inside a sandboxed iframe (scripts disabled,
// opaque origin) on top of the server-side sanitiser.
//
// Design: dark-first, follows the OS colour scheme, with a manual toggle
// (stored in localStorage). Mobile-first responsive layout.

export const INDEX_HTML = `<!doctype html>
<html lang="zh-Hant" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0b0f14">
<meta name="description" content="自行部署嘅私人臨時郵箱：隨機地址 + 存取碼登入，只收信，到期自動刪除。">
<title>私人臨時郵箱 · Private Temp Mail</title>
<script>
(function () {
  try {
    var saved = localStorage.getItem('ptm-theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
})();
</script>
<style>
  /* ---------- tokens ---------- */
  :root {
    --bg: #f2f4f8;
    --surface: #ffffff;
    --surface-2: #eef1f6;
    --surface-3: #e4e9f1;
    --ink: #17202d;
    --muted: #5c6b7e;
    --line: #dbe1ea;
    --accent: #4f46e5;
    --accent-2: #7c3aed;
    --accent-ink: #ffffff;
    --accent-soft: #eef0fe;
    --danger: #dc2626;
    --danger-soft: #fdecec;
    --ok: #047857;
    --ok-soft: #e6f6ee;
    --warn-bg: #fff8e1;
    --warn-line: #f0d48a;
    --warn-ink: #7a5b00;
    --shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 8px 24px rgba(16, 24, 40, .08);
    --shadow-sm: 0 1px 2px rgba(16, 24, 40, .08);
    --radius: 16px;
    --radius-sm: 10px;
    --focus: 0 0 0 3px rgba(79, 70, 229, .35);
  }
  [data-theme="dark"] {
    --bg: #0b0f14;
    --surface: #131a24;
    --surface-2: #1a2230;
    --surface-3: #222d3f;
    --ink: #e9eef6;
    --muted: #94a3b8;
    --line: #263144;
    --accent: #818cf8;
    --accent-2: #a78bfa;
    --accent-ink: #14102e;
    --accent-soft: #1e2447;
    --danger: #f87171;
    --danger-soft: #2a1618;
    --ok: #34d399;
    --ok-soft: #0f2a1e;
    --warn-bg: #2a2113;
    --warn-line: #6b5316;
    --warn-ink: #fbbf24;
    --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 12px 32px rgba(0, 0, 0, .35);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, .4);
    --focus: 0 0 0 3px rgba(129, 140, 248, .45);
  }

  /* ---------- base ---------- */
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang HK", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
    background:
      radial-gradient(720px 320px at 85% -10%, rgba(124, 58, 237, .14), transparent 60%),
      radial-gradient(640px 300px at -10% 0%, rgba(79, 70, 229, .12), transparent 60%),
      var(--bg);
    background-attachment: fixed;
    color: var(--ink);
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: var(--accent); }
  :focus-visible { outline: none; box-shadow: var(--focus); border-radius: 6px; }

  /* ---------- header ---------- */
  header {
    position: sticky; top: 0; z-index: 50;
    background: color-mix(in srgb, var(--surface) 82%, transparent);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .header-inner {
    max-width: 1080px; margin: 0 auto; padding: 12px 16px;
    display: flex; align-items: center; gap: 12px;
  }
  .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .brand-mark {
    flex: none; width: 40px; height: 40px; border-radius: 12px;
    display: grid; place-items: center; font-size: 20px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    box-shadow: 0 4px 14px rgba(99, 102, 241, .45);
  }
  .brand h1 { margin: 0; font-size: 18px; line-height: 1.25; letter-spacing: .2px; }
  .brand p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.35; }
  .header-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  @media (max-width: 560px) { .brand p { display: none; } .brand h1 { font-size: 16px; } }

  main { max-width: 1080px; margin: 0 auto; padding: 20px 16px 56px; }

  /* ---------- cards & layout ---------- */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  .card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow);
  }
  .card h2 { margin: 0 0 4px; font-size: 17px; letter-spacing: .2px; }
  .card .sub { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
  .hero { text-align: center; padding: 10px 8px 22px; }
  .hero h2 { font-size: 22px; margin: 0 0 6px; }
  .hero p { margin: 0 auto; max-width: 560px; color: var(--muted); font-size: 14px; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 14px; }
  .chip {
    font-size: 12.5px; color: var(--muted);
    background: var(--surface-2); border: 1px solid var(--line);
    border-radius: 999px; padding: 4px 11px;
  }

  label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin: 14px 0 5px; }
  input, select {
    width: 100%; padding: 11px 12px; font-size: 15px;
    border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface-2); color: var(--ink);
    transition: border-color .15s, box-shadow .15s;
  }
  input::placeholder { color: var(--muted); opacity: .75; }
  input:focus, select:focus { border-color: var(--accent); outline: none; box-shadow: var(--focus); }
  select {
    appearance: none; -webkit-appearance: none; padding-right: 34px; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }

  /* ---------- buttons ---------- */
  button {
    border: 0; border-radius: var(--radius-sm); padding: 11px 16px;
    font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: inherit;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #fff; box-shadow: 0 2px 10px rgba(99, 102, 241, .35);
    transition: transform .12s, box-shadow .15s, opacity .15s, filter .15s;
  }
  button:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
  button:active:not(:disabled) { transform: translateY(0); }
  button.secondary {
    background: var(--surface-3); color: var(--ink); box-shadow: var(--shadow-sm);
  }
  button.danger { background: var(--danger); color: #fff; box-shadow: none; }
  button.ghost { background: transparent; color: var(--muted); box-shadow: none; padding: 8px 10px; }
  button.ghost:hover:not(:disabled) { background: var(--surface-3); color: var(--ink); }
  button.small { padding: 7px 12px; font-size: 13px; }
  button.block { width: 100%; }
  button:disabled { opacity: .6; cursor: default; transform: none; }
  button.is-loading { cursor: wait; }
  .spinner {
    display: inline-block; width: 14px; height: 14px; vertical-align: -2px;
    border: 2px solid rgba(255, 255, 255, .45); border-top-color: #fff;
    border-radius: 50%; animation: spin .7s linear infinite; margin-right: 6px;
  }
  button.secondary .spinner { border-color: rgba(0, 0, 0, .2); border-top-color: currentColor; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
    * { transition-duration: .01ms !important; animation-duration: .01ms !important; }
  }

  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .muted { color: var(--muted); font-size: 13px; }
  .warn {
    background: var(--warn-bg); border: 1px solid var(--warn-line); color: var(--warn-ink);
    border-radius: var(--radius-sm); padding: 11px 13px; font-size: 13.5px; margin-top: 12px; line-height: 1.6;
  }
  .big { font-size: 18px; font-weight: 700; letter-spacing: .3px; word-break: break-all; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .hidden { display: none !important; }
  .err { color: var(--danger); font-size: 13px; min-height: 19px; margin-top: 8px; }
  .success-banner {
    background: var(--ok-soft); border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
    color: var(--ok); border-radius: var(--radius-sm);
    padding: 10px 13px; font-size: 14px; font-weight: 600; margin-top: 12px;
  }
  hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }

  /* copyable secret box (address / access code) */
  .secret-box {
    background: var(--surface-2); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 10px 12px;
  }
  .secret-box .big { font-size: 17px; }
  .secret-box .row { justify-content: space-between; }

  /* ---------- inbox ---------- */
  .inbox-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
  .inbox-head .big { font-size: 19px; }
  .expiry-pill {
    display: inline-block; margin-top: 6px; font-size: 12.5px; font-weight: 600;
    color: var(--ok); background: var(--ok-soft);
    border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
    border-radius: 999px; padding: 3px 10px;
  }
  .toolbar {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
    background: var(--surface-2); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 10px;
  }
  .toolbar select { width: auto; padding: 7px 34px 7px 10px; font-size: 13.5px; }
  .layout { display: grid; grid-template-columns: 350px 1fr; gap: 16px; margin-top: 16px; align-items: start; }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  .msg-list-head { font-size: 13px; font-weight: 700; color: var(--muted); margin: 0 0 8px; letter-spacing: .4px; }

  .msg {
    border: 1px solid var(--line); border-radius: 12px; padding: 12px 13px;
    margin-bottom: 9px; cursor: pointer; background: var(--surface);
    transition: border-color .15s, box-shadow .15s, transform .12s;
  }
  .msg:hover { border-color: var(--accent); transform: translateY(-1px); }
  .msg.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow-sm); }
  .msg .subj { font-weight: 650; font-size: 14.5px; line-height: 1.4; }
  .msg .meta { color: var(--muted); font-size: 12.5px; margin-top: 3px; word-break: break-all; }
  .msg .snip {
    color: var(--muted); font-size: 12.5px; margin-top: 5px; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .otp {
    display: inline-block; background: var(--ok-soft); color: var(--ok);
    border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
    border-radius: 7px; padding: 2px 8px; margin: 6px 4px 0 0;
    font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; font-size: 13px;
    cursor: pointer;
  }
  .otp.big { font-size: 20px; padding: 7px 15px; margin: 4px 8px 4px 0; }
  .otp:hover { filter: brightness(1.08); }

  /* empty states */
  .empty {
    text-align: center; padding: 36px 16px; color: var(--muted);
    border: 1.5px dashed var(--line); border-radius: var(--radius); background: var(--surface-2);
  }
  .empty .emoji { font-size: 44px; line-height: 1; display: block; margin-bottom: 12px; }
  .empty .title { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .empty p { margin: 0; font-size: 13px; }

  iframe.mail { width: 100%; min-height: 420px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: #fff; }
  pre.text { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.6; margin: 0; }
  .att {
    display: inline-block; border: 1px solid var(--line); border-radius: 8px;
    padding: 7px 11px; margin: 0 6px 6px 0; font-size: 13px;
    background: var(--surface); color: var(--ink); text-decoration: none;
  }
  .att:hover { border-color: var(--accent); }
  .detail-head h3 { margin: 0 0 4px; font-size: 17px; line-height: 1.35; word-break: break-word; }

  /* ---------- toasts ---------- */
  #toasts {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
    z-index: 100; display: flex; flex-direction: column; gap: 8px; align-items: center;
    width: min(92vw, 420px); pointer-events: none;
  }
  .toast {
    width: 100%; background: var(--surface); color: var(--ink);
    border: 1px solid var(--line); border-left: 4px solid var(--accent);
    border-radius: 12px; padding: 11px 14px; font-size: 14px; font-weight: 550;
    box-shadow: var(--shadow); opacity: 0; transform: translateY(10px);
    transition: opacity .25s, transform .25s;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.success { border-left-color: var(--ok); }
  .toast.error { border-left-color: var(--danger); }

  footer { color: var(--muted); font-size: 12.5px; text-align: center; padding: 8px 12px 32px; line-height: 1.7; }
  footer a { color: var(--muted); }
</style>
</head>
<body>
<header>
  <div class="header-inner">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">✉️</span>
      <div>
        <h1>私人臨時郵箱</h1>
        <p>隨機地址 + 存取碼登入 · 只收信 · 到期自動刪除</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="ghost" id="btn-theme" type="button" aria-label="切換明暗模式">☀️ 淺色</button>
    </div>
  </div>
</header>
<main>

  <!-- ======== home: create / login ======== -->
  <div id="view-home">
    <div class="hero">
      <h2>用完即棄嘅私人郵箱</h2>
      <p>唔使註冊、唔收任何個人資料。建立一個隨機地址，用嚟收驗證碼、收確認信，到期就自動成個刪除。</p>
      <div class="chips">
        <span class="chip">🔒 存取碼先睇到信</span>
        <span class="chip">🎲 地址隨機生成</span>
        <span class="chip">⏳ 到期自動刪除</span>
        <span class="chip">🚫 只收信，唔寄信</span>
      </div>
    </div>
    <div class="grid">
      <section class="card" aria-labelledby="h-create">
        <h2 id="h-create">建立新郵箱</h2>
        <p class="sub">地址同存取碼會即刻顯示，記得抄低。</p>
        <label for="domain">域名</label>
        <select id="domain" aria-label="揀域名"></select>
        <label for="retention">保存期限</label>
        <select id="retention" aria-label="揀保存期限">
          <option value="7" selected>7 日（預設）</option>
          <option value="30">30 日</option>
          <option value="90">90 日</option>
          <option value="180">180 日</option>
          <option value="365">365 日</option>
        </select>
        <p class="muted" id="expiry-preview" aria-live="polite"></p>
        <button id="btn-create" class="block" type="button">建立郵箱</button>
        <div class="err" id="create-err" role="alert" aria-live="polite"></div>
        <div id="created" class="hidden">
          <div class="success-banner" role="status">🎉 郵箱建立成功</div>
          <label>你嘅電郵地址</label>
          <div class="secret-box"><div class="row"><span class="big" id="created-address"></span>
            <button class="small secondary" type="button" data-copy="created-address" aria-label="複製電郵地址">複製</button></div></div>
          <label>存取碼（之後登入返嚟要用）</label>
          <div class="secret-box"><div class="row"><span class="big code" id="created-code"></span>
            <button class="small secondary" type="button" data-copy="created-code" aria-label="複製存取碼">複製</button></div></div>
          <p class="muted" id="created-expiry"></p>
          <div class="warn">⚠️ 請即刻抄低上面個地址同存取碼。存取碼唔見咗係冇得找回嘅，因為呢度唔使註冊、唔會收集你任何聯絡資料。</div>
          <p><button id="btn-enter" class="block" type="button">入去收件匣 →</button></p>
        </div>
      </section>

      <section class="card" aria-labelledby="h-login">
        <h2 id="h-login">取回收件匣</h2>
        <p class="sub">用返建立嗰陣嘅地址同存取碼登入。</p>
        <label for="login-address">電郵地址</label>
        <input id="login-address" autocomplete="username" placeholder="xxxxxxxxxxxx@example.com" inputmode="email">
        <label for="login-code">存取碼</label>
        <input id="login-code" class="code" autocomplete="current-password" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX">
        <p><button id="btn-login" class="block" type="button">登入</button></p>
        <div class="err" id="login-err" role="alert" aria-live="polite"></div>
        <p class="muted">登入之後會記住你 30 日（或者去到郵箱到期為止）。唔係你嘅裝置就記得用完登出。</p>
      </section>
    </div>
  </div>

  <!-- ======== inbox ======== -->
  <div id="view-inbox" class="hidden">
    <section class="card" aria-labelledby="mb-address">
      <div class="inbox-head">
        <div style="min-width:0">
          <div class="big" id="mb-address"></div>
          <span class="expiry-pill" id="mb-expiry"></span>
        </div>
        <div class="row">
          <button class="small secondary" type="button" data-copy="mb-address" aria-label="複製呢個電郵地址">📋 複製地址</button>
          <button class="small secondary" id="btn-refresh" type="button">↻ 刷新</button>
          <button class="small secondary" id="btn-logout" type="button">登出</button>
        </div>
      </div>
      <div id="code-panel" class="hidden">
        <div class="warn">✅ 新存取碼（舊嗰條已經作廢，請即刻抄低）：
          <span class="big code" id="new-code"></span>
          <button class="small secondary" type="button" data-copy="new-code" aria-label="複製新存取碼">複製</button>
        </div>
      </div>
      <hr>
      <div class="toolbar">
        <select id="extend-days" aria-label="揀延長幾多日">
          <option value="7">+7 日</option>
          <option value="30" selected>+30 日</option>
          <option value="90">+90 日</option>
          <option value="180">+180 日</option>
          <option value="365">+365 日</option>
        </select>
        <button class="small" id="btn-extend" type="button">延長到期日</button>
        <button class="small secondary" id="btn-rotate" type="button">更換存取碼</button>
        <button class="small danger" id="btn-delete-mb" type="button">即時刪除郵箱</button>
      </div>
      <div class="err" id="inbox-err" role="alert" aria-live="polite"></div>

      <div class="layout">
        <div>
          <p class="msg-list-head" id="msg-count">收件匣</p>
          <div id="msg-list" role="list"></div>
          <div class="empty" id="msg-empty">
            <span class="emoji" aria-hidden="true">📭</span>
            <div class="title">仲未有信</div>
            <p>寄封信去上面個地址，呢度會每 5 秒自動更新。</p>
          </div>
        </div>
        <div id="msg-detail">
          <div class="empty">
            <span class="emoji" aria-hidden="true">📨</span>
            <div class="title">撳一封信嚟睇內容</div>
            <p>信件 HTML 已經過濾，外來圖片預設唔會載入。</p>
          </div>
        </div>
      </div>
    </section>
  </div>

</main>
<footer>Private Temp Mail · AGPL-3.0 開源 · 只收信，唔寄信 · 信件內容只會存到郵箱到期為止<br>自行部署版本 — 你嘅信只會存喺你自己嘅 Cloudflare 帳戶入面</footer>
<div id="toasts" aria-live="polite"></div>

<script>
var $ = function (id) { return document.getElementById(id); };
var state = { me: null, activeId: null, poll: null, images: false, prevCount: null };

function fmt(ms) {
  return new Date(ms).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function api(path, opts) {
  opts = opts || {};
  opts.headers = { 'Content-Type': 'application/json' };
  return fetch(path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (data) {
      if (!r.ok) throw new Error(data.error || ('錯誤 ' + r.status));
      return data;
    });
  });
}

/* ---------- toast notifications ---------- */
function toast(msg, kind) {
  var wrap = $('toasts');
  var t = document.createElement('div');
  t.className = 'toast ' + (kind || 'info');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(function () { t.classList.add('show'); });
  setTimeout(function () {
    t.classList.remove('show');
    setTimeout(function () { t.remove(); }, 300);
  }, 3600);
  while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
}

/* ---------- copy + button loading ---------- */
function copyText(text, btn) {
  function done(ok) {
    toast(ok ? '已經複製：' + text : '複製唔到，請手動抄低', ok ? 'success' : 'error');
    if (btn) { var t = btn.textContent; btn.textContent = '✓ 已複製'; setTimeout(function () { btn.textContent = t; }, 1200); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
  } else {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      ta.remove(); done(ok);
    } catch (e) { done(false); }
  }
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (b) copyText($(b.getAttribute('data-copy')).textContent.trim(), b);
});
function withLoading(btn, text, fn) {
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + esc(text);
  var p;
  try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
  return p.finally(function () {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.innerHTML = orig;
  });
}

/* ---------- theme ---------- */
function updateThemeBtn() {
  var dark = document.documentElement.getAttribute('data-theme') !== 'light';
  var b = $('btn-theme');
  b.textContent = dark ? '☀️ 淺色' : '🌙 深色';
  b.setAttribute('aria-label', dark ? '切換去淺色模式' : '切換去深色模式');
}
$('btn-theme').addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('ptm-theme', next); } catch (e) { /* private mode */ }
  updateThemeBtn();
});
try {
  if (!localStorage.getItem('ptm-theme')) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
      updateThemeBtn();
    });
  }
} catch (e) { /* ignore */ }
updateThemeBtn();

/* ---------- home ---------- */
function updateExpiryPreview() {
  var days = Number($('retention').value);
  $('expiry-preview').textContent = '到期日約為：' + fmt(Date.now() + days * 86400000) + '（成個郵箱連信件一齊刪除）';
}
$('retention').addEventListener('change', updateExpiryPreview);

function loadDomains() {
  return api('/api/domains').then(function (d) {
    var sel = $('domain');
    sel.innerHTML = '';
    (d.domains || []).forEach(function (name) {
      var o = document.createElement('option');
      o.value = name; o.textContent = name; sel.appendChild(o);
    });
    if (!d.domains || !d.domains.length) $('create-err').textContent = '伺服器未設定任何域名';
  });
}

$('btn-create').addEventListener('click', function () {
  $('create-err').textContent = '';
  var btn = $('btn-create');
  withLoading(btn, '建立緊…', function () {
    return api('/api/mailboxes', {
      method: 'POST',
      body: JSON.stringify({ domain: $('domain').value, retentionDays: Number($('retention').value) })
    }).then(function (r) {
      $('created-address').textContent = r.address;
      $('created-code').textContent = r.accessCode;
      $('created-expiry').textContent = '到期日：' + fmt(r.expiresAt);
      $('created').classList.remove('hidden');
      toast('郵箱建立成功，記得抄低存取碼', 'success');
      $('created').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch(function (e) { $('create-err').textContent = e.message; });
  });
});
$('btn-enter').addEventListener('click', showInbox);

$('btn-login').addEventListener('click', function () {
  $('login-err').textContent = '';
  var btn = $('btn-login');
  withLoading(btn, '登入緊…', function () {
    return api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ address: $('login-address').value, accessCode: $('login-code').value })
    }).then(showInbox)
      .catch(function (e) { $('login-err').textContent = e.message; });
  });
});

/* ---------- inbox ---------- */
function showInbox() {
  $('view-home').classList.add('hidden');
  $('view-inbox').classList.remove('hidden');
  state.prevCount = null;
  loadMe(); loadMessages();
  if (state.poll) clearInterval(state.poll);
  state.poll = setInterval(loadMessages, 5000);
}
function showHome() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
  state.prevCount = null;
  state.me = null;
  state.activeId = null;
  state.images = false;
  // Clear every trace of the mailbox that was just used, so the home page
  // never keeps showing a deleted (or logged-out) mailbox's address,
  // access code or messages. Previously the "created" card stayed visible
  // after delete, because showHome() only switched views.
  $('created').classList.add('hidden');
  $('created-address').textContent = '';
  $('created-code').textContent = '';
  $('created-expiry').textContent = '';
  $('code-panel').classList.add('hidden');
  $('new-code').textContent = '';
  $('login-address').value = '';
  $('login-code').value = '';
  $('login-err').textContent = '';
  $('create-err').textContent = '';
  $('inbox-err').textContent = '';
  $('mb-address').textContent = '';
  $('mb-expiry').textContent = '';
  $('msg-count').textContent = '收件匣';
  $('msg-list').innerHTML = '';
  $('msg-empty').style.display = 'block';
  $('msg-detail').innerHTML = '<div class="empty"><span class="emoji" aria-hidden="true">📨</span><div class="title">撳一封信嚟睇內容</div><p>信件 HTML 已經過濾，外來圖片預設唔會載入。</p></div>';
  $('view-inbox').classList.add('hidden');
  $('view-home').classList.remove('hidden');
}
function loadMe() {
  return api('/api/me').then(function (me) {
    state.me = me;
    $('mb-address').textContent = me.address;
    $('mb-expiry').textContent = '到期日：' + fmt(me.expiresAt) + ' · 仲有約 ' + me.daysRemaining + ' 日';
  }).catch(function () { showHome(); });
}
function loadMessages() {
  return api('/api/messages').then(function (d) {
    var list = $('msg-list');
    list.innerHTML = '';
    $('msg-empty').style.display = d.messages.length ? 'none' : 'block';
    $('msg-count').textContent = '收件匣（' + d.messages.length + ' 封）';
    if (state.prevCount !== null && d.messages.length > state.prevCount) {
      toast('有 ' + (d.messages.length - state.prevCount) + ' 封新信到咗 📬', 'success');
    }
    state.prevCount = d.messages.length;
    d.messages.forEach(function (m) {
      var div = document.createElement('div');
      div.className = 'msg' + (m.id === state.activeId ? ' active' : '');
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', (m.subject || '冇主旨') + '，由 ' + m.from + ' 寄出');
      var otps = (m.otpCodes || []).map(function (c) {
        return '<span class="otp" title="撳嚟複製">' + esc(c) + '</span>';
      }).join(' ');
      div.innerHTML =
        '<div class="subj">' + esc(m.subject || '（冇主旨）') + (m.hasAttachments ? ' 📎' : '') + '</div>' +
        '<div class="meta">' + esc(m.from) + ' · ' + fmt(m.receivedAt) + '</div>' +
        (m.snippet ? '<div class="snip">' + esc(m.snippet) + '</div>' : '') + otps;
      div.addEventListener('click', function (e) {
        if (e.target.classList.contains('otp')) { copyText(e.target.textContent.trim(), null); return; }
        openMessage(m.id);
      });
      div.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMessage(m.id); }
      });
      list.appendChild(div);
    });
  }).catch(function () { /* polling: ignore transient errors */ });
}
function openMessage(id, images) {
  state.activeId = id;
  state.images = !!images;
  loadMessages();
  api('/api/messages/' + id + (images ? '?images=1' : '')).then(function (m) {
    var otps = (m.otpCodes || []).map(function (c) {
      return '<span class="otp big" title="撳嚟複製">' + esc(c) + '</span>';
    }).join('');
    var atts = (m.attachments || []).map(function (a) {
      return '<a class="att" href="' + a.url + '">📎 ' + esc(a.filename) + ' (' + Math.max(1, Math.round(a.sizeBytes / 1024)) + ' KB)</a>';
    }).join('');
    var html =
      '<div class="detail-head"><h3>' + esc(m.subject || '（冇主旨）') + '</h3>' +
      '<div class="muted">' + esc(m.from) + ' → ' + esc(m.to) + '<br>' + fmt(m.receivedAt) + '</div></div>' +
      (otps ? '<div style="margin:12px 0"><div class="muted">可能係驗證碼（撳嚟複製）：</div>' + otps + '</div>' : '') +
      (atts ? '<div style="margin:8px 0">' + atts + '</div>' : '') +
      '<div class="row" style="margin:10px 0">' +
        (m.htmlDocument ? '<button class="small secondary" type="button" id="d-toggle-img">' + (state.images ? '隱藏外來圖片' : '顯示外來圖片') + '</button>' : '') +
        (m.rawUrl ? '<a class="att" href="' + m.rawUrl + '">下載原始信件 (.eml)</a>' : '') +
        '<button class="small danger" type="button" id="d-delete">刪除呢封信</button>' +
      '</div>' +
      '<div id="d-body"></div>';
    $('msg-detail').innerHTML = html;
    var body = $('d-body');
    if (m.htmlDocument) {
      var f = document.createElement('iframe');
      f.className = 'mail';
      f.setAttribute('sandbox', 'allow-popups');
      f.setAttribute('title', '信件內容');
      f.srcdoc = m.htmlDocument;
      body.appendChild(f);
      var tgl = $('d-toggle-img');
      if (tgl) tgl.addEventListener('click', function () { openMessage(id, !state.images); });
    } else {
      var pre = document.createElement('pre');
      pre.className = 'text';
      pre.textContent = m.textBody || '';
      body.appendChild(pre);
    }
    $('d-delete').addEventListener('click', function () {
      if (!confirm('真係刪除呢封信？刪咗冇得還原。')) return;
      api('/api/messages/' + id, { method: 'DELETE' }).then(function () {
        state.activeId = null;
        $('msg-detail').innerHTML = '<div class="empty"><span class="emoji" aria-hidden="true">🗑️</span><div class="title">封信已經刪咗</div></div>';
        toast('封信已經刪咗', 'success');
        loadMessages();
      });
    });
  }).catch(function (e) { $('inbox-err').textContent = e.message; });
}

$('btn-refresh').addEventListener('click', function () {
  var btn = $('btn-refresh');
  withLoading(btn, '刷新緊…', function () { return Promise.all([loadMe(), loadMessages()]).then(function () { toast('已經刷新', 'success'); }); });
});
$('btn-logout').addEventListener('click', function () {
  api('/api/logout', { method: 'POST' }).finally(showHome);
});
$('btn-extend').addEventListener('click', function () {
  $('inbox-err').textContent = '';
  var days = Number($('extend-days').value);
  var btn = $('btn-extend');
  withLoading(btn, '延長緊…', function () {
    return api('/api/mailbox/extend', { method: 'POST', body: JSON.stringify({ days: days }) })
      .then(function (r) {
        toast('已經延長到 ' + fmt(r.expiresAt) +
          (r.capped ? '（去到最遠上限，實際加咗 ' + r.appliedDays + ' 日）' : ''), 'success');
        loadMe();
      }).catch(function (e) { $('inbox-err').textContent = e.message; });
  });
});
$('btn-rotate').addEventListener('click', function () {
  if (!confirm('更換存取碼？舊存取碼同其他裝置嘅登入會即刻作廢。')) return;
  var btn = $('btn-rotate');
  withLoading(btn, '更換緊…', function () {
    return api('/api/mailbox/rotate-code', { method: 'POST' }).then(function (r) {
      $('new-code').textContent = r.accessCode;
      $('code-panel').classList.remove('hidden');
      $('code-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('存取碼已經更換，記得抄低新碼', 'success');
    }).catch(function (e) { $('inbox-err').textContent = e.message; });
  });
});
$('btn-delete-mb').addEventListener('click', function () {
  if (!confirm('即時刪除成個郵箱？入面所有信會一齊冇晒，冇得還原。')) return;
  if (!confirm('真係刪？撳確定之後即刻生效。')) return;
  api('/api/mailbox', { method: 'DELETE' }).then(function () {
    toast('郵箱已經刪除', 'success');
    showHome();
  }).catch(function (e) { $('inbox-err').textContent = e.message; });
});

/* ---------- boot ---------- */
updateExpiryPreview();
loadDomains();
api('/api/me').then(function () { showInbox(); }).catch(function () { /* not logged in */ });
</script>
</body>
</html>
`;
