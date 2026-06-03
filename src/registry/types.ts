import type { ZodTypeAny, z } from 'zod';
import type { ExitCode } from '../agent/exit.js';
import type { OutputContext } from '../agent/output.js';
import type { Config } from '../config/schema.js';

/** Runtime context injected into every command handler. */
export interface CommandContext {
  output: OutputContext;
  config: Config;
  version: string;
}

export interface ExitCodeEntry {
  code: ExitCode;
  meaning: string;
}

export interface ArgSpec {
  name: string;
  description: string;
  required: boolean;
  variadic?: boolean;
}

export interface FlagSpec {
  long: string;
  short?: string;
  description: string;
  /** Zod schema for the flag value. Boolean flags have z.boolean(). */
  schema: ZodTypeAny;
  default?: unknown;
  env?: string;
}

/**
 * A CommandSpec<TInput, TOutput> is the single declaration for a streamnet
 * command. It is consumed by:
 *   - registry/build.ts   → Commander .command()
 *   - agent/manifest.ts   → streamnet manifest JSON
 *   - agent/mcp/tools.ts  → MCP tool definition
 *
 * Because all three derive from the same spec, a command cannot drift between
 * its CLI surface, its manifest entry, and its MCP tool.
 */
export interface CommandSpec<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  /** Stable machine identifier used as the MCP tool name and manifest key. */
  id: string;
  /** One-line description for --help and the manifest. */
  summary: string;
  /** Optional multi-line usage / detail. */
  description?: string;
  args?: ArgSpec[];
  flags?: FlagSpec[];
  exitCodes: ExitCodeEntry[];
  examples?: string[];
  /**
   * The actual implementation. Returns the data that populates Envelope.data.
   * Handlers MUST NOT emit the final envelope themselves — they return data and
   * the registry wrapper emits exactly one envelope. Handlers may still write
   * diagnostics/progress to stderr via ctx.output.info/success/progress.
   */
  handler: (ctx: CommandContext, input: TInput) => Promise<TOutput>;
  /**
   * Optional human-mode renderer. Called only when --json is off. If absent the
   * wrapper pretty-prints the data as JSON.
   */
  render?: (data: TOutput, output: OutputContext) => void;
  /**
   * Optional success-path exit code resolver. Lets a command emit a full
   * (ok:true) envelope while still returning a non-zero code for scripting —
   * e.g. `doctor` exits 1 when a check fails but still reports every check.
   */
  exitCodeFor?: (data: TOutput) => ExitCode;
  /** Schema for validating input in MCP / programmatic calls. */
  inputSchema?: z.ZodType<TInput>;
}
