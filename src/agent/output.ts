import pc from 'picocolors';
import { successEnvelope, errorEnvelope, type Envelope } from './envelope.js';
import { ExitCode } from './exit.js';

export type OutputMode = 'human' | 'json';

export interface OutputOptions {
  json: boolean;
  yes: boolean;
  noInput: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
}

/**
 * Central output adapter. Commands never write to stdout/stderr directly; they
 * call into an OutputContext so the same handler renders cleanly as a human TUI
 * line *or* a single JSON envelope, with progress and logs kept on stderr.
 *
 * Contract: in JSON mode, stdout receives exactly one line — the envelope.
 * Everything diagnostic (logs, progress, prompts) goes to stderr.
 */
export class OutputContext {
  readonly mode: OutputMode;
  readonly interactive: boolean;
  readonly options: OutputOptions;

  constructor(options: OutputOptions) {
    this.options = options;
    this.mode = options.json ? 'json' : 'human';
    // Interactive only when a real TTY is present, JSON is off, --no-input is
    // off, and we are not in CI. Agents get a fully non-interactive surface.
    this.interactive =
      !options.json &&
      !options.noInput &&
      Boolean(process.stdout.isTTY) &&
      Boolean(process.stdin.isTTY) &&
      !isCI();
  }

  private paint(fn: (s: string) => string, s: string): string {
    return this.options.color ? fn(s) : s;
  }

  /** Diagnostic log — always stderr, suppressed by --quiet. */
  log(message: string): void {
    if (this.options.quiet) return;
    process.stderr.write(message + '\n');
  }

  info(message: string): void {
    this.log(this.paint(pc.cyan, 'ℹ ') + message);
  }

  success(message: string): void {
    this.log(this.paint(pc.green, '✔ ') + message);
  }

  warn(message: string): void {
    this.log(this.paint(pc.yellow, '⚠ ') + message);
  }

  error(message: string): void {
    process.stderr.write(this.paint(pc.red, '✖ ') + message + '\n');
  }

  /** Verbose-only diagnostic. */
  debug(message: string): void {
    if (this.options.verbose && !this.options.quiet) {
      process.stderr.write(this.paint(pc.dim, '· ' + message) + '\n');
    }
  }

  /** A structured progress event — NDJSON on stderr for agents, human line otherwise. */
  progress(event: Record<string, unknown>): void {
    if (this.options.quiet) return;
    if (this.mode === 'json') {
      process.stderr.write(JSON.stringify({ type: 'progress', ...event }) + '\n');
    } else {
      const parts = Object.entries(event)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');
      process.stderr.write(this.paint(pc.dim, parts) + '\r');
    }
  }

  /**
   * Emit the terminal result for a command. In JSON mode writes the stdout
   * envelope and awaits the OS pipe flush before returning; in human mode
   * invokes the renderer synchronously. Must be awaited before process.exit().
   */
  async emit<T>(command: string, version: string, data: T, render: (data: T) => void): Promise<void> {
    if (this.mode === 'json') {
      await this.writeLine(JSON.stringify(successEnvelope(command, version, data)));
    } else {
      render(data);
    }
  }

  /** Emit a failure envelope or human error line. Must be awaited before process.exit(). */
  async emitError(
    command: string,
    version: string,
    error: { code: ExitCode; message: string; hint?: string },
  ): Promise<void> {
    if (this.mode === 'json') {
      await this.writeLine(JSON.stringify(errorEnvelope(command, version, error)));
    } else {
      this.error(error.message);
      if (error.hint) this.log(this.paint(pc.dim, '  ' + error.hint));
    }
  }

  /** Raw envelope passthrough. Must be awaited before process.exit(). */
  async emitEnvelope(envelope: Envelope): Promise<void> {
    await this.writeLine(JSON.stringify(envelope));
  }

  private writeLine(s: string): Promise<void> {
    return new Promise((resolve, reject) =>
      process.stdout.write(s + '\n', (err) => (err ? reject(err) : resolve())),
    );
  }
}

export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI,
  );
}
