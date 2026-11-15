# Private Temp Mail

A self-hosted, **private** temporary email service that runs entirely on
Cloudflare: Email Routing → Workers → D1 + R2. Receive-only, no accounts,
no sign-up.

Unlike public temp-mail sites where anyone who knows an address can read
the inbox, every mailbox here is protected by a random **access code**.
The address is the username, the access code is the password — shown once
at creation, stored only as a hash.

> You deploy your own instance, with your own domain(s), on your own
> Cloudflare account. This project is the software, not a hosted service.

## Features

- **Modern UI, zero dependencies** — dark-first design that follows
  your OS colour scheme (with a manual light/dark toggle), toast
  notifications, one-click copy buttons, loading states and empty
  states. Mobile-first, keyboard-friendly, no frameworks or CDNs.
- **Private by design** — mailboxes are only readable with their access code.
  Sessions are opaque tokens (hashed at rest) in HttpOnly cookies; every API
  call is authenticated. Login attempts are rate-limited.
- **Random addresses only** — the system generates the address
  (e.g. `nx2uz99cvuey@yourdomain.com`). Custom/vanity addresses are
  deliberately not supported: no impersonation, no squatting.
- **Addresses are never re-issued** — a hash of every address ever created
  stays on a tombstone list forever, so a future mailbox can never receive
  a previous owner's password-reset mail.
- **Retention you choose** — 7 / 30 / 90 / 180 / 365 days at creation
  (default 7). Expiry is per-mailbox and shown as an exact date; on expiry
  the mailbox, its messages, attachments and access code are deleted.
- **Extend while logged in** — +7/+30/+90/+180/+365 days added to the
  current expiry, capped at 365 days from today. Logging in or receiving
  mail never extends a mailbox automatically.
- **Instant delete & code rotation** — destroy a mailbox immediately, or
  rotate the access code (old code and other sessions die instantly).
- **Multiple domains** — every apex domain points its catch-all at the
  same Worker and the same D1 database; pick the domain at creation.
  All domains must be in the **same Cloudflare account** as the Worker:
  Email Routing can only send mail to a Worker in its own account, so
  domains spread across accounts have to be consolidated into one
  account first (re-add the zone, update nameservers at your registrar).
- **Safe reading** — email HTML is sanitised server-side and rendered in a
  sandboxed iframe; remote images are blocked until you opt in per message
  (no tracking pixels); likely one-time codes are detected and offered as
  one-click copy chips.
- **Receive-only** — there is intentionally no sending. That keeps the
  service out of spam/abuse territory, like the classic temp-mail sites.
- **No per-mailbox quotas** — by design there is no cap on messages per
  mailbox. Cloudflare's own platform limits still apply (25 MiB max per
  inbound message, your account's D1/R2 storage).

## Architecture

```
sender ──SMTP──▶ Cloudflare Email Routing (catch-all, per apex domain)
                      │  email()
                      ▼
                 Worker ── parse (postal-mime) ──▶ R2: raw .eml + attachments
                      │                            D1: mailboxes, messages,
                      │                                sessions, tombstones
                      ├─ fetch() → web UI + JSON API (access-code sessions)
                      └─ scheduled() → hourly cleanup of expired mailboxes
```

Mail is only accepted for mailboxes that were created in the UI and have
not expired; anything else is rejected at SMTP time.

## Deploy your own

Prerequisites: a Cloudflare account, and one or more **apex domains whose
DNS is hosted on Cloudflare** in that account. ⚠️ Email Routing takes over
a domain's MX records — never use a domain that already receives real mail
(Google Workspace etc.) on the same apex. Subdomains cannot do catch-all,
so they cannot issue random addresses.

```bash
git clone <this repo> && cd private-temp-mail
npm install

npm run db:create        # note the database_id it prints
npm run bucket:create

# Edit wrangler.jsonc:
#   1. paste the database_id
#   2. replace example.com with your domain(s), in BOTH `addresses`
#      ("*@example.com", one per domain) and `vars.EMAIL_DOMAINS`

npm run db:migrate       # create the tables — this step actually
                         # runs migrations/0001_init.sql against your
                         # remote D1. Copying the SQL file into the
                         # folder is NOT enough: without this, the
                         # Worker deploys but cannot create mailboxes
                         # or receive mail.
npm run deploy
```

Then open the Worker URL, create a mailbox, and send it a test email.

## Configuration

| Setting | Where | Meaning |
|---|---|---|
| `EMAIL_DOMAINS` | `wrangler.jsonc` vars | Comma-separated apex domains to issue mailboxes on |
| `addresses` | `wrangler.jsonc` | One `*@domain` catch-all per domain, routed to this Worker |
| `DB` | D1 binding | Mailboxes, messages, sessions, tombstones, rate limits |
| `MAIL_BUCKET` | R2 binding | Raw `.eml` files and attachments |
| cron `0 * * * *` | triggers | Hourly expired-mailbox cleanup |

Retention options, the extend ceiling and rate limits are constants in
`src/lib/time.js` and `src/api.js`.

## Security model

- Access codes: 20 random characters (~97 bits), only the SHA-256 hash is
  stored. There is **no recovery** — lose the code, lose the mailbox.
  That is the trade-off of having no accounts and collecting nothing.
- Session tokens: 256-bit random, hashed at rest, HttpOnly + SameSite=Lax,
  expire with the mailbox.
- Message HTML is treated as hostile: sanitised server-side
  (`src/lib/sanitize.js`) and sandboxed in the browser. Attachments and
  raw downloads require the mailbox session and are served as downloads.
- Report vulnerabilities per [SECURITY.md](SECURITY.md), not in public issues.

## Development

```bash
npm test     # unit tests (node:test, no services needed)
npm run dev  # wrangler dev
```

## 繁體中文簡介

自行部署嘅私人臨時郵箱，行晒喺 Cloudflare 上面（Email Routing + Workers
+ D1 + R2），只收信、唔使註冊。每個郵箱由系統隨機生成地址，再加一條
隨機存取碼做登入；保存期限建立嗰陣揀 7／30／90／180／365 日，登入後
可以延長（最遠今日起計 365 日）。支援多個主域名、即時刪除、更換存取碼、
安全睇信（HTML 過濾、外來圖片預設封鎖、驗證碼一撳複製）。用過嘅地址
永遠唔會再派俾第二個人。部署方法睇上面英文部分。

## License

[AGPL-3.0-only](LICENSE). If you modify this software and run it as a
network service, the AGPL requires you to offer your modified source to
the users of that service.
