---
type: project-overview
project: streamnet-cli
status: planning
created: 2026-05-11
modified: 2026-05-11
tags: [project, open-source, cli, streaming, torrent, vlc, typescript, nodejs, media]
related:
  - "[[03-knowledge/maps-of-content/Public-Repos-Master-Strategy]]"
  - "[[04-resources/tools/Stremio + VLC en Linux]]"
  - "[[02-projects/magnus-cli/_overview]]"
  - "[[02-projects/korvex/_overview]]"
---

# StreamNet CLI — Project Overview

CLI replacement for the manual `.torrent → Stremio GUI → VLC → VLSub` pipeline Eduardo ran for years. The migration to Pop!_OS broke it repeatedly (libmpv1, libssl1.1, OpenSSL 3 vs 1.1, Flatpak sandboxing). StreamNet automates the full pipeline without depending on a GUI or legacy dependency stack.

━━━

## Core Workflow

```
streamnet play "Blade Runner 2049"
  → search indexers → rank by health → select best torrent
  → stream via WebTorrent (no full download required)
  → spawn VLC with stream URL
  → auto-detect format → if not MKV: search OpenSubtitles by hash
  → download + load subtitles in VLC
```

━━━

## CLI Commands

```bash
streamnet search "Blade Runner 2049"        # Search, show health-ranked results
streamnet stream <torrent-url-or-magnet>    # Stream → VLC (core)
streamnet play "Blade Runner 2049"          # One-shot: search + best result + stream
streamnet download <torrent-url-or-magnet>  # Full download for archiving
streamnet subs <file-or-stream>             # Manual subtitle search
streamnet setup                             # Install all deps for current OS
streamnet config                            # Player, sub language, quality prefs
streamnet doctor                            # Verify: webtorrent, vlc, vlsub, network
```

━━━

## Technical Architecture

| Layer             | Choice                                    | Notes                            |
| ----------------- | ----------------------------------------- | -------------------------------- |
| Language          | Node.js 20 + TypeScript                   | Consistent with other tools      |
| Torrent streaming | WebTorrent / peerflix                     | In-process, no GUI required      |
| Indexer search    | Multi-source scraper + API                | Tool searches; user decides      |
| VLC integration   | Spawn VLC with stream URL arg             | Requires native VLC, not Flatpak |
| Subtitle search   | OpenSubtitles API + VLSub-compatible hash | Hash search = most reliable      |
| Platform priority | Linux → macOS → Windows WSL2              | Pop!_OS 22.04 is dev baseline    |
|                   |                                           |                                  |

━━━

## Torrent Health Ranking

Rank results by: `seeder/leecher ratio`, `total seeders`, `file size vs quality`, `format` (MKV > MP4 > others). MKV preferred — usually has embedded English subtitles, eliminating subtitle search entirely.

━━━

## Key Insights from Years of Usage

- **MKV = best format.** Embedded subs, no VLSub needed. Filter for MKV first.
- **Flatpak breaks IPC.** Stremio Flatpak + VLC Flatpak cannot communicate reliably. StreamNet bypasses this entirely by owning the spawn.
- **Pop!_OS 22.04 was the only working baseline** for native Stremio — libmpv1 gone in Ubuntu 24.04, libssl1.1 manually required.
- **VLSub hash search is reliable** for MKV streams — uses video hash + metadata, finds subs even for obscure content.
- **P2P streaming paradox:** If everyone streams without seeding, nobody seeds. Eduardo acknowledges this as a future solvable problem — possible "StreamNet Seed" daemon for contributing back.

━━━

## Compatibility Lessons (from source file)

- Do not use Flatpak for any app requiring IPC to an external player
- `libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb` from `nz2.archive.ubuntu.com` is the Stremio legacy fix
- Ubuntu/Pop 24.04 + Mint 22 (same base) both drop `libmpv1` — unworkable for legacy stack
- StreamNet eliminates the entire fragile dependency chain by owning the pipeline in Node.js

━━━

## Build Complexity

**Most complex of the 6 tools.** Requires: BitTorrent protocol (WebTorrent), multi-source indexer scraping, VLC IPC/spawn, OpenSubtitles API, VLSub-compatible hash generation.

Recommended build order: FlowClock → Magnus → StreamNet.

━━━

## License & Audience

- **License:** AGPL-3.0 + Dual Commercial License
- **Target:** Privacy-focused streamers, Linux users, cord-cutters, tech-savvy media consumers, people tired of fragmented subscriptions

━━━

## Source

`[[04-resources/tools/Stremio + VLC en Linux]]` — 16 documented errors, 7 key technical decisions, full compatibility matrix across Pop!_OS 22.04/24.04, Linux Mint 22, Flatpak vs native.
