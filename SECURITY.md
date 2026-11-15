# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities —
especially anything that could let one mailbox owner read another
mailbox's mail, bypass an access code, or execute script through a
received email.

Report privately through GitHub's "Report a vulnerability" button
(Security → Advisories) on this repository, with:

- a description of the issue and its impact,
- steps to reproduce (a sample email is ideal for parser/sanitiser bugs),
- the version/commit you tested.

You can expect an acknowledgement within a few days. Fixes for
mailbox-isolation issues are treated as the highest priority.

## Scope notes

- Losing an access code means losing the mailbox. That is a deliberate
  design property (no accounts, no recovery data), not a bug.
- An operator of an instance can read their own instance's database —
  self-hosting means trusting the operator, which is usually yourself.
