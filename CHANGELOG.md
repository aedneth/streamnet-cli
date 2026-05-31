# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project foundation: command registry (single source of truth), agent
  output layer (`--json` envelopes, deterministic exit codes), XDG config store.
- Core: multi-indexer search (torrents-csv, YTS) with fan-out aggregation and
  infohash de-duplication; torrent health ranking (MKV-first); quality parser.
- Torrent streaming engine (WebTorrent) with local HTTP stream server and
  best-file selection.
- Native VLC detection (rejects Flatpak/Snap) and spawn.
- Commands: `search`, `stream`, `play`, `setup`, `doctor`, `config`, `manifest`.
- Cross-OS `setup` installer (apt/dnf/pacman/zypper, brew, winget/choco).
- Repo-standard files: AGPL-3.0 `LICENSE`, `LICENSE-COMMERCIAL`, `CONTRIBUTING`,
  `SECURITY`, `CODE_OF_CONDUCT`, issue/PR templates, GitHub Actions CI.

## [0.1.0] - TBD

First tagged release — vertical slice: search + stream + play + VLC spawn +
setup/doctor, all with `--json` / `--yes` / deterministic exit codes.

[Unreleased]: https://github.com/eduardoborjas/streamnet-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/eduardoborjas/streamnet-cli/releases/tag/v0.1.0
