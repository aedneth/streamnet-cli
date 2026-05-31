# Security Policy

## Supported versions

StreamNet CLI is pre-1.0. Security fixes are applied to the latest released
minor version. Once 1.0.0 ships, the latest minor will be supported.

| Version    | Supported |
| ---------- | --------- |
| latest 0.x | ✅        |
| older 0.x  | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately via one of:

- GitHub's **private vulnerability reporting** (Security → Report a vulnerability)
- Email: **eduardoa.borjas@gmail.com** with subject `[streamnet-cli security]`

Please include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version(s) and platform.

You can expect an acknowledgement within **5 business days** and a status update
within **15 business days**. Coordinated disclosure is appreciated — we'll agree
a disclosure timeline with you once the issue is confirmed.

## Scope notes

StreamNet spawns native VLC and runs a local HTTP stream server bound to
`127.0.0.1`. Reports involving local privilege escalation, the stream server, the
VLC IPC interface, subtitle handling, or indexer response parsing are in scope.

StreamNet does not host or distribute content; it searches third-party indexers
and streams via the BitTorrent network. Legal/abuse concerns about specific
content are out of scope for this security policy.
