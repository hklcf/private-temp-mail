# Changelog

All notable changes to this project are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/).

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
