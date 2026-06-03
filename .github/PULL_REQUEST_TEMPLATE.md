## Summary

<!-- What does this PR change and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Docs / chore

## Agent-native checklist (required for command changes)

- [ ] Command supports `--json` with a stable envelope
- [ ] Non-interactive path works (`--yes` / flags / env; no hidden TTY requirement)
- [ ] Returns a deterministic exit code from `src/agent/exit.ts`
- [ ] Data → stdout, diagnostics/progress → stderr
- [ ] `streamnet manifest` reflects any new commands/flags

## Verification

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds

## Notes

<!-- Anything reviewers should know. Linked issues: Closes #... -->
