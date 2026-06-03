import { ExitCode, EXIT_CODE_NAMES } from './exit.js';

/** Bumped only on breaking changes to the machine-readable envelope shape. */
export const ENVELOPE_SCHEMA_VERSION = 1 as const;

export interface EnvelopeError {
  code: ExitCode;
  name: string;
  message: string;
  hint?: string;
}

/**
 * The stable JSON envelope emitted on stdout in `--json` mode. Every command
 * returns exactly one of these. Agents may rely on this shape across a major
 * version; `schemaVersion` guards breaking changes.
 */
export interface Envelope<T = unknown> {
  ok: boolean;
  command: string;
  version: string;
  schemaVersion: typeof ENVELOPE_SCHEMA_VERSION;
  data?: T;
  error?: EnvelopeError;
  meta: {
    timestamp: string;
    durationMs?: number;
  };
}

export function successEnvelope<T>(
  command: string,
  version: string,
  data: T,
  durationMs?: number,
): Envelope<T> {
  return {
    ok: true,
    command,
    version,
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    data,
    meta: { timestamp: new Date().toISOString(), durationMs },
  };
}

export function errorEnvelope(
  command: string,
  version: string,
  error: { code: ExitCode; message: string; hint?: string },
  durationMs?: number,
): Envelope<never> {
  return {
    ok: false,
    command,
    version,
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    error: {
      code: error.code,
      name: EXIT_CODE_NAMES[error.code] ?? 'ERROR',
      message: error.message,
      hint: error.hint,
    },
    meta: { timestamp: new Date().toISOString(), durationMs },
  };
}
