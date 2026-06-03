import { Command } from 'commander';
import type { CommandSpec, CommandContext } from './types.js';
import { ExitCode, StreamNetError, fail } from '../agent/exit.js';

/**
 * Wire a CommandSpec onto a Commander Command, binding:
 *  - positional args
 *  - flags (long/short, default, env)
 *  - handler that calls spec.handler and routes stdout/stderr through OutputContext
 */
export function buildCommand(spec: CommandSpec, ctx: () => CommandContext): Command {
  const cmd = new Command(spec.id).description(spec.summary);

  for (const arg of spec.args ?? []) {
    const syntax = arg.variadic
      ? arg.required
        ? `<${arg.name}...>`
        : `[${arg.name}...]`
      : arg.required
        ? `<${arg.name}>`
        : `[${arg.name}]`;
    cmd.argument(syntax, arg.description);
  }

  for (const flag of spec.flags ?? []) {
    const short = flag.short ? `-${flag.short}, ` : '';
    const isBoolean =
      flag.schema._def?.typeName === 'ZodBoolean' ||
      flag.schema._def?.typeName === 'ZodOptional';
    const syntax = isBoolean
      ? `${short}--${flag.long}`
      : `${short}--${flag.long} <value>`;
    cmd.option(syntax, flag.description, flag.default as string | undefined);
  }

  if (spec.examples?.length) {
    cmd.addHelpText(
      'after',
      '\nExamples:\n' + spec.examples.map((e) => `  ${e}`).join('\n'),
    );
  }

  cmd.action(async (...actionArgs: unknown[]) => {
    const context = ctx();

    // Build input: positional args + resolved flags (env overrides first).
    const positionals = actionArgs.slice(0, (spec.args ?? []).length) as string[];
    const rawOpts = actionArgs[actionArgs.length - 2] as Record<string, unknown>;
    const input = buildInput(spec, positionals, rawOpts);

    try {
      const data = await spec.handler(context, input);
      // await ensures the OS pipe buffer is flushed before process.exit()
      await context.output.emit(spec.id, context.version, data, (d) => {
        if (spec.render) {
          spec.render(d, context.output);
        } else {
          process.stdout.write(JSON.stringify(d, null, 2) + '\n');
        }
      });
      const exitCode = spec.exitCodeFor ? spec.exitCodeFor(data) : ExitCode.OK;
      process.exit(exitCode);
    } catch (err) {
      const sne =
        err instanceof StreamNetError
          ? err
          : new StreamNetError(ExitCode.ERROR, String(err));

      await context.output.emitError(spec.id, context.version, {
        code: sne.code,
        message: sne.message,
        hint: sne.hint,
      });
      process.exit(sne.code);
    }
  });

  return cmd;
}

function buildInput(
  spec: CommandSpec,
  positionals: string[],
  opts: Record<string, unknown>,
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  // Positional args
  for (let i = 0; i < (spec.args ?? []).length; i++) {
    const arg = spec.args![i]!;
    input[camel(arg.name)] = positionals[i];
  }

  // Flags — env var wins over CLI flag wins over default
  for (const flag of spec.flags ?? []) {
    const envVal = flag.env ? process.env[flag.env] : undefined;
    const cliVal = opts[camel(flag.long)];
    const typeName = flag.schema._def?.typeName as string | undefined;
    if (envVal !== undefined) {
      input[camel(flag.long)] = coerceEnv(envVal, typeName);
    } else if (cliVal !== undefined) {
      // Coerce string values for numeric flags (Commander always gives strings)
      input[camel(flag.long)] = typeName === 'ZodNumber' ? coerceNum(cliVal, flag.long) : cliVal;
    } else if (flag.default !== undefined) {
      input[camel(flag.long)] = flag.default;
    }
  }

  return input;
}

function coerceEnv(val: string, typeName: string | undefined): unknown {
  if (val === '1' || val === 'true') return true;
  if (val === '0' || val === 'false') return false;
  if (typeName === 'ZodNumber') return coerceNum(val, '');
  return val;
}

function coerceNum(val: unknown, flagName: string): number {
  const n = Number(val);
  if (Number.isNaN(n)) fail(ExitCode.USAGE, `--${flagName} requires a numeric value, got: ${String(val)}`);
  return n;
}

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export { fail };
