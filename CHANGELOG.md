# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-06-02

### Added

- Command registry — single source of truth driving Commander CLI, `manifest`
  output, and MCP tool list simultaneously.
- Agent output layer: `--json` versioned envelopes on every command, diagnostic
  output isolated to stderr, deterministic POSIX exit codes (0/2/3/4/5/6/7/8/
  9/10/77/130).
- XDG config store (`~/.config/streamnet/config.json`) with Zod schema
  validation and env-var overrides.
- Multi-indexer search (torrents-csv, YTS) with fan-out aggregation,
  infohash de-duplication, and MKV-first health ranking.
- WebTorrent streaming engine with local HTTP stream server and best-file
  selection by size + container preference.
- Native VLC detection (rejects Flatpak/Snap paths), spawn, and IPC.
- Commands: `search`, `stream`, `play`, `setup`, `doctor`, `config`, `manifest`.
- Cross-OS `setup` installer: apt/dnf/pacman/zypper, Homebrew, winget/choco.
- `--yes` / `--no-input` / `STREAMNET_*` env-var overrides; zero TTY hang in
  agent mode.
- Repo standards: AGPL-3.0 `LICENSE`, `LICENSE-COMMERCIAL`, `CONTRIBUTING`,
  `SECURITY`, `CODE_OF_CONDUCT`, issue/PR templates, CI (3 OS × Node 20/22).

### Fixed

- `manifest` command: wrap `process.stdout.write` in callback-awaited promise so
  OS pipe buffer is flushed before `process.exit()` on macOS/Node 20.
- CodeQL workflow: guard with `if: github.event.repository.private == false` to
  prevent spurious failures on private repos without GitHub Advanced Security.

[Unreleased]: https://github.com/aedneth/streamnet-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aedneth/streamnet-cli/releases/tag/v0.1.0
