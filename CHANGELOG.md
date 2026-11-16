# Changelog

All notable changes to this project are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.5] - 2026-11-17

### Fixed

- Verification codes in Simplified Chinese emails were never detected.
  The keyword list only had the Traditional forms (驗證碼、驗證、認證
  碼、確認碼), so a mail saying 一次性验证码 / 验证码 produced no
  code chip even though the code was in the text body. Added the
  Simplified forms (验证码、验证、认证码、确认码) to the keyword
  pattern. Added 2 regression tests in `test/otp.test.js`, one with
  the verbatim China Unicom (Hong Kong) mail text.
- Version 0.2.4 → 0.2.5.

## [0.2.4] - 2026-11-17

### Fixed

- A GitHub launch-code email was detected as having two verification
  codes. The real code was `53447232`; the second one, `0640131`,
  was the leading digits of the UUID in the verification links
  (`verification=0640131f-25a8-...`). The keyword pattern saw
  "verification=" followed by digits and took them for a code, without
  checking that a letter followed — i.e. that the digits were only the
  head of a longer token. The pattern now rejects a digit run that is
  immediately followed by a letter or digit. Added 2 regression tests
  in `test/otp.test.js`, one with the verbatim GitHub mail text.
- Version 0.2.3 → 0.2.4.

## [0.2.3] - 2026-11-16

### Fixed

- Verification codes in HTML-only emails were never detected. OTP
  extraction only scanned the text/plain part, but some senders (Meta
  included) send HTML-only mail, so the code existed only in the HTML
  part and the inbox showed no code chip (and no preview, since the
  preview also comes from the text body). The handler now falls back
  to the HTML part's visible text — tags stripped before entities are
  decoded, so digits inside attributes can never be mistaken for a
  code — when a message has no text part. Messages with a text part
  are unchanged. Added `htmlToText` in `src/lib/otp.js` and
  `test/otp.test.js` (3 tests) plus a regression test with an
  HTML-only Meta-style sample in `test/email-parse.test.js`.
- Version 0.2.2 → 0.2.3.

## [0.2.2] - 2026-11-16

### Fixed

- Clicking an OTP chip in the message detail view
  ("可能係驗證碼（撳嚟複製）") did nothing: `openMessage()` rendered
  the chips but never attached a click handler (only the message list
  had one). The detail view now wires click-to-copy on its OTP chips.
  Added `test/ui-detail-otp.test.js` (3 regression tests).
- "顯示外來圖片" toggled the button but the images stayed broken.
  Mail renders in a `srcdoc` iframe, which inherits the parent page's
  CSP as an extra policy on top of its own `<meta>` CSP, so a remote
  image must pass both; the page CSP said `img-src 'self' data:`,
  which blocked every remote image even after the reader opted in.
  The page CSP now allows `https:` images too. The `srcdoc`
  document's own CSP still blocks remote images by default and only
  allows them after a per-message opt-in, so the page itself loads
  nothing new. Added `test/csp.test.js` (1 regression test).
- Opted-in remote images no longer carry `loading="lazy"`: when the
  reader explicitly asks to show them, they load straight away
  instead of waiting to be scrolled into view.
- Version 0.2.1 → 0.2.2.

## [0.2.1] - 2026-11-15

### Fixed

- Deleting a mailbox returned to the home page, but the home page
  kept showing the deleted mailbox's address and access code: the
  "created" card from mailbox creation was never hidden or cleared,
  because `showHome()` only switched views. `showHome()` now hides
  and clears the created card, the rotated-code panel, the login
  form and all stale inbox state (address, expiry, message list and
  detail pane), so no record of a deleted mailbox lingers on the
  home page. Added `test/ui-showhome.test.js` (3 regression tests).
- Version 0.2.0 → 0.2.1.

## [0.2.0] - 2026-11-15

### Added

- Modernised web UI (`src/ui.js`, still zero external dependencies):
  dark-first design that follows the OS colour scheme, with a manual
  light/dark toggle (preference saved in localStorage).
- Toast notifications for create / login / extend / rotate / delete /
  copy / new-mail actions, replacing `alert()` popups.
- Button loading states (spinner + disabled) on create, login, extend,
  rotate and refresh.
- One-click copy buttons for the mailbox address, the access code and
  OTP chips, with copy confirmation.
- Empty states for the inbox and the message detail pane, a new-mail
  toast on the 5-second poll, a message count, and a hero section with
  feature chips on the home page.
- Basic accessibility: labelled controls, `aria-live` error/toast
  regions, keyboard-operable message list (Enter/Space), visible focus
  rings, reduced-motion support.
- GitHub Actions CI (`.github/workflows/ci.yml`): runs `npm test` on
  Node 20 and 22 for every push and pull request.

### Changed

- Version 0.1.0 → 0.2.0.
- README: deploy steps now state explicitly that the D1 migration must
  actually be run (`npm run db:migrate`) — copying the SQL file alone
  does not create the tables. Multi-domain note clarified: all domains
  must live in the same Cloudflare account as the Worker.
- `wrangler.jsonc` in the repository now ships with the
  `REPLACE_WITH_YOUR_D1_DATABASE_ID` placeholder again (a real
  `database_id` from a local deployment was briefly present and has
  been removed before the first public commit).

### Fixed

- Copy fallback for browsers without the async Clipboard API now
  actually copies via a temporary textarea instead of silently
  reporting success.

## [0.1.0] - 2026-11-09

### Added

- First version: private temporary email on Cloudflare Workers
  (Email Routing catch-all → Worker → D1 + R2).
- Random addresses only (no custom/vanity addresses), access-code
  login (code shown once at creation, stored only as a hash),
  HttpOnly session cookies, login rate limiting.
- Retention choice at creation: 7 / 30 / 90 / 180 / 365 days
  (default 7), exact expiry date shown; extend while logged in
  (+7/+30/+90/+180/+365 days, capped at today + 365 days).
- Instant whole-mailbox delete, access-code rotation, tombstone list
  so deleted/expired addresses are never re-issued.
- Multiple apex domains on one Worker and one D1 database, domain
  picker at creation; mailboxes keyed by full address.
- Safe reading: server-side HTML sanitisation, sandboxed iframe,
  remote images blocked by default, OTP code detection with
  one-click copy chips.
- Receive-only (no sending), no per-mailbox quotas by design.
- AGPL-3.0 license, README, SECURITY.md, CONTRIBUTING.md, 26 unit
  tests, D1 migration `migrations/0001_init.sql`.
