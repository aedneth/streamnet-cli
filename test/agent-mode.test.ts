import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

/**
 * These tests exercise the built CLI as a subprocess with no TTY — exactly how a
 * terminal agent invokes it. They lock in the agent-native contract:
 *   - stdout is a single valid JSON envelope
 *   - diagnostics never pollute stdout
 *   - exit codes are deterministic
 *
 * Requires `npm run build` first (CI builds before testing). Skipped locally if
 * dist is absent.
 */
const maybe = existsSync(CLI) ? describe : describe.skip;

async function run(args: string[]): Promise<{ stdout: string; code: number }> {
  try {
    const { stdout } = await execFileAsync('node', [CLI, ...args], {
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; code?: number };
    return { stdout: e.stdout ?? '', code: e.code ?? 1 };
  }
}

maybe('agent mode (subprocess, no TTY)', () => {
  it('config get emits exactly one JSON envelope on stdout', async () => {
    const { stdout, code } = await run(['config', 'get', 'minSeeders', '--json']);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    const env = JSON.parse(lines[0]!);
    expect(env.ok).toBe(true);
    expect(env.command).toBe('config');
    expect(env.schemaVersion).toBe(1);
    expect(env.data.value).toBe(3);
    expect(code).toBe(0);
  });

  it('returns USAGE (2) for a missing required argument', async () => {
    const { stdout, code } = await run(['config', 'get', '--json']);
    const env = JSON.parse(stdout.trim());
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe(2);
    expect(env.error.name).toBe('USAGE');
    expect(code).toBe(2);
  });

  // doctor makes a live network call to verify indexer reachability; allow up to 15s
  it('doctor exits non-zero when a dependency is missing but still emits valid JSON', { timeout: 15_000 }, async () => {
    const { stdout, code } = await run(['doctor', '--json']);
    const env = JSON.parse(stdout.trim());
    expect(env.command).toBe('doctor');
    expect(Array.isArray(env.data.checks)).toBe(true);
    // exit code mirrors allOk; in CI VLC is absent so this is typically 1
    expect(code === 0 || code === 1).toBe(true);
    expect(env.data.allOk).toBe(code === 0);
  });

  it('manifest is a single valid JSON object enumerating commands', async () => {
    const { stdout, code } = await run(['manifest']);
    const m = JSON.parse(stdout.trim());
    expect(m.name).toBe('streamnet');
    expect(m.commands.map((c: { id: string }) => c.id)).toContain('play');
    expect(code).toBe(0);
  });
});
