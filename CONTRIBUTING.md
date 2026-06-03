# Contributing to StreamNet CLI

Thanks for your interest in improving StreamNet CLI!

## Development setup

```bash
git clone https://github.com/eduardoborjas/streamnet-cli.git
cd streamnet-cli
npm install
npm run build
npm test
```

Requires **Node.js >= 20**.

### Useful scripts

| Script              | Purpose                     |
| ------------------- | --------------------------- |
| `npm run build`     | Bundle with tsup to `dist/` |
| `npm run dev`       | Rebuild on change           |
| `npm run typecheck` | `tsc --noEmit`              |
| `npm run lint`      | ESLint                      |
| `npm run format`    | Prettier (write)            |
| `npm test`          | Run the vitest suite        |
| `npm run test:cov`  | Tests with coverage         |

## Architecture

A **single command registry** (`src/registry/`) is the source of truth: each
command is declared once and that declaration drives the Commander CLI, the
`streamnet manifest` output, and the MCP tool list. When you add a command:

1. Add the handler in `src/commands/<id>.ts`.
2. Add a `CommandSpec` to `src/registry/index.ts` (args, flags, exit codes,
   examples).
3. Route all output through `ctx.output` — never `console.log` directly. This is
   what keeps every command both human- and agent-friendly.
4. Add tests in `test/`.

### Agent-native requirements (acceptance criteria)

Every command **must**:

- Support `--json` with a stable, versioned envelope.
- Have a fully non-interactive path (flags + env vars; no hidden TTY needs).
- Return a deterministic exit code from `src/agent/exit.ts`.
- Send data to stdout and diagnostics/progress to stderr.

PRs that break these will be asked to fix them before merge.

## Commit & PR conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
  `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.
- Keep PRs focused. Include tests for behavior changes.
- Run `npm run lint && npm run typecheck && npm test` before opening a PR.

## Developer Certificate of Origin / dual licensing

StreamNet CLI is dual-licensed (AGPL-3.0 + commercial). By contributing, you
agree that your contributions are licensed under the AGPL-3.0 **and** that you
grant the maintainer the right to include your contribution in commercially
licensed distributions of the project. If you cannot agree to this, please open
an issue to discuss before contributing.

## Reporting bugs / requesting features

Use the issue templates. For security issues, **do not** open a public issue —
see [`SECURITY.md`](SECURITY.md).
