<div align="center">

# streamnet-cli

**Torrent search → in-process WebTorrent streaming → native VLC, with hash-based subtitles.**

Replaces the fragile `.torrent → Stremio → VLC → VLSub` pipeline with a single,
scriptable command. No GUI. No Flatpak. No legacy dependency chain.

[![CI](https://github.com/eduardoborjas/streamnet-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardoborjas/streamnet-cli/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

</div>

---

## Why

Eduardo ran a manual streaming pipeline for years: download a `.torrent`, open it
in the Stremio GUI, pipe it to VLC, fetch subtitles with VLSub. The migration to
Pop!\_OS broke it repeatedly — `libmpv1` removed in Ubuntu 24.04, `libssl1.1` vs
OpenSSL 3, and Flatpak sandboxing that silently broke IPC between Stremio and VLC.

**StreamNet owns the entire pipeline in Node.js** so none of that can break:

```
streamnet play "Blade Runner 2049"
  → search indexers → rank by health (MKV first) → pick best torrent
  → stream via WebTorrent (no full download) → spawn native VLC
  → if not MKV: fetch subtitles by file hash → load in VLC
```

## Agent-native by design

Like `gh` and `vercel`, StreamNet is a first-class tool for **both humans and
terminal AI agents** (Claude Code, Codex, Gemini CLI, Hermes, OpenClaw, OpenCode,
DeepSeek) on Linux, macOS, and Windows:

- **`--json`** on every command — stable, versioned, machine-readable envelopes
- **`--yes`** skips all prompts; **`--no-input`** forbids them (exit `77` instead)
- **Deterministic POSIX exit codes** you can branch on
- **stdin/stdout composability** — `streamnet search … --json | jq … | streamnet stream -`
- **`streamnet manifest`** — enumerate every command, flag, exit code, and schema
- **`streamnet mcp`** — an MCP server so any agent can call commands (v0.4)
- **Zero hidden TTY requirements** in agent mode

## Install

```bash
# npm (primary — requires Node.js >= 20)
npm install -g streamnet-cli

# or grab a standalone binary (no Node required)
# https://github.com/eduardoborjas/streamnet-cli/releases
```

Then install native VLC and verify:

```bash
streamnet setup     # installs native VLC for your OS (never Flatpak/Snap)
streamnet doctor    # verifies VLC, webtorrent, Node, network
```

## Usage

```bash
streamnet search "Blade Runner 2049"          # health-ranked results
streamnet play   "Blade Runner 2049" --yes    # search + best result + stream
streamnet stream "magnet:?xt=urn:btih:..."     # stream a specific torrent
streamnet config list                          # view configuration
streamnet manifest                             # machine-readable command catalog
```

### Agent / scripting examples

```bash
# Pure JSON, no prompts, scriptable exit codes
streamnet play "Sintel" --yes --json

# Pipe a magnet from another tool
echo "$MAGNET" | streamnet stream - --no-subs --json

# Branch on exit code
streamnet search "obscure title" --json || case $? in
  3) echo "no results" ;;
  5) echo "network down" ;;
esac
```

## Exit codes

| Code | Name               | Meaning                                     |
| ---: | ------------------ | ------------------------------------------- |
|    0 | OK                 | Success                                     |
|    1 | ERROR              | Generic/unexpected error                    |
|    2 | USAGE              | Invalid arguments or flags                  |
|    3 | NO_RESULTS         | Search returned nothing                     |
|    4 | DEP_MISSING        | Required dependency (VLC) not found         |
|    5 | NETWORK            | Indexer/API/network failure                 |
|    6 | TORRENT_UNPLAYABLE | No peers / metadata timeout                 |
|    7 | PLAYER_FAILED      | VLC failed to spawn or crashed              |
|    8 | SUBS_NOT_FOUND     | No matching subtitles                       |
|    9 | CONFIG             | Invalid/unwritable config                   |
|   10 | AUTH               | OpenSubtitles auth/rate-limit               |
|   77 | EX_NOINPUT         | Prompt needed but running non-interactively |
|  130 | SIGINT             | Interrupted                                 |

## Configuration

Config lives under XDG paths (`~/.config/streamnet/config.json` on Linux/macOS,
`%APPDATA%\streamnet` on Windows). Manage it with `streamnet config`:

```bash
streamnet config set minSeeders 5
streamnet config set preferredContainers mkv,mp4
streamnet config get opensubtitles.apiKey   # secrets are redacted on display
```

## License — AGPL-3.0 + Dual Commercial (final)

StreamNet CLI is **dual-licensed**:

- **Open source & free for the public** under the **GNU AGPL-3.0** — see
  [`LICENSE`](LICENSE).
- **Commercial licenses are sold separately** for organizations that need to
  integrate StreamNet into proprietary products without AGPL obligations — see
  [`LICENSE-COMMERCIAL`](LICENSE-COMMERCIAL).

MIT and Apache are **intentionally rejected**: they would let a company use and
resell this work without a commercial agreement. The AGPL keeps the public
version free and open, while reserving a commercial path for those who need it.

Commercial licensing: **eduardoa.borjas@gmail.com**

---

Part of the **Korvex** agent-native developer-tool suite.
