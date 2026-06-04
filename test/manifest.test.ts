import { describe, it, expect } from 'vitest';
import { buildManifest } from '../src/commands/manifest.js';
import { COMMAND_SPECS } from '../src/registry/index.js';

describe('manifest', () => {
  const manifest = buildManifest(COMMAND_SPECS, '0.1.0');

  it('includes all registered commands', () => {
    const ids = manifest.commands.map((c) => c.id).sort();
    expect(ids).toContain('search');
    expect(ids).toContain('stream');
    expect(ids).toContain('play');
    expect(ids).toContain('setup');
    expect(ids).toContain('doctor');
    expect(ids).toContain('config');
    expect(ids).toContain('subs');
    expect(ids).toContain('download');
  });

  it('documents the full exit code table', () => {
    const codes = manifest.exitCodes.map((e) => e.code);
    expect(codes).toContain(0);
    expect(codes).toContain(77);
    expect(codes).toContain(130);
    // every code has a name and description
    for (const e of manifest.exitCodes) {
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
    }
  });

  it('exposes global agent flags', () => {
    const flags = manifest.globalFlags.map((f) => f.long);
    expect(flags).toContain('json');
    expect(flags).toContain('yes');
    expect(flags).toContain('no-input');
  });

  it('is a stable, serializable shape (snapshot of command ids + flags)', () => {
    const shape = manifest.commands.map((c) => ({
      id: c.id,
      args: c.args?.map((a) => a.name) ?? [],
      flags: (c.flags ?? []).map((f) => f.long).sort(),
    }));
    expect(shape).toMatchSnapshot();
  });
});
