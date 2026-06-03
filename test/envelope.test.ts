import { describe, it, expect } from 'vitest';
import {
  successEnvelope,
  errorEnvelope,
  ENVELOPE_SCHEMA_VERSION,
} from '../src/agent/envelope.js';
import { ExitCode } from '../src/agent/exit.js';

describe('envelope', () => {
  it('builds a success envelope with stable shape', () => {
    const env = successEnvelope('search', '0.1.0', { results: [] });
    expect(env.ok).toBe(true);
    expect(env.command).toBe('search');
    expect(env.version).toBe('0.1.0');
    expect(env.schemaVersion).toBe(ENVELOPE_SCHEMA_VERSION);
    expect(env.data).toEqual({ results: [] });
    expect(env.meta.timestamp).toBeTypeOf('string');
    expect(env.error).toBeUndefined();
  });

  it('builds an error envelope with named code', () => {
    const env = errorEnvelope('play', '0.1.0', {
      code: ExitCode.NO_RESULTS,
      message: 'nothing found',
    });
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe(ExitCode.NO_RESULTS);
    expect(env.error?.name).toBe('NO_RESULTS');
    expect(env.error?.message).toBe('nothing found');
    expect(env.data).toBeUndefined();
  });

  it('serializes to valid single-line JSON', () => {
    const env = successEnvelope('doctor', '0.1.0', { allOk: true });
    const line = JSON.stringify(env);
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).not.toContain('\n');
  });
});
