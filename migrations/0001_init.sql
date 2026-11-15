-- Private Temp Mail — initial schema.
-- All timestamps are INTEGER milliseconds since the Unix epoch.

-- A mailbox. `address` is the full address (mailboxes are keyed by the
-- whole address, never by local part alone — multiple domains share this
-- table). Only the hash of the access code is stored.
CREATE TABLE mailboxes (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL UNIQUE,
  local_part      TEXT NOT NULL,
  domain          TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  extended_count  INTEGER NOT NULL DEFAULT 0,
  last_extended_at INTEGER
);
CREATE INDEX idx_mailboxes_expires ON mailboxes (expires_at);

-- Never-reissue list. When a mailbox is created, the hash of its address
-- is written here and NEVER removed — so an address that existed once can
-- never be issued again to a different person (who could otherwise receive
-- the previous owner's password-reset mail). Stores hashes only, no content.
CREATE TABLE tombstones (
  address_hash TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  mailbox_id      TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  from_addr       TEXT NOT NULL DEFAULT '',
  to_addr         TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  text_body       TEXT NOT NULL DEFAULT '',
  html_body       TEXT NOT NULL DEFAULT '',
  raw_r2_key      TEXT,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  otp_codes       TEXT NOT NULL DEFAULT '[]',
  has_attachments INTEGER NOT NULL DEFAULT 0,
  received_at     INTEGER NOT NULL
);
CREATE INDEX idx_messages_mailbox ON messages (mailbox_id, received_at DESC);

CREATE TABLE attachments (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  filename     TEXT NOT NULL DEFAULT 'attachment',
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  r2_key       TEXT NOT NULL
);
CREATE INDEX idx_attachments_message ON attachments (message_id);

-- Web sessions. Only the hash of the session token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_mailbox ON sessions (mailbox_id);

-- Fixed-window rate limiting (login attempts, mailbox creation).
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
