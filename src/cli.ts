import { Command, CommanderError } from 'commander';
import { createRequire } from 'node:module';
import { buildCommand } from './registry/build.js';
import { COMMAND_SPECS } from './registry/index.js';
import { OutputContext, type OutputOptions } from './agent/output.js';
import { loadConfig } from './config/store.js';
import { configFile } from './config/paths.js';
import { ExitCode } from './agent/exit.js';
import { errorEnvelope } from './agent/envelope.js';
import { manifestHandler } from './commands/manifest.js';
import type { CommandContext } from './registry/types.js';

// Resolve package.json version without relying on import assertions (Node 20 ESM)
const req = createRequire(import.meta.url);
const pkg = req('../package.json') as { version: string };
const VERSION = pkg.version;

const program = new Command('streamnet')
  .version(VERSION, '-V, --version')
  .description('Torrent search + in-process WebTorrent streaming to native VLC.')
  .option('--json', 'Machine-readable JSON output', false)
  .option('-y, --yes', 'Skip prompts; auto-select top result', false)
  // --no-input: Commander stores value under `input` (opts.input === false when passed)
  .option('--no-input', 'Disable interactive prompts; exit 77 if one is needed')
  .option('-q, --quiet', 'Suppress diagnostic output', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--no-color', 'Disable ANSI colour')
  .option('--config <path>', 'Path to config file', process.env.STREAMNET_CONFIG)
  .addHelpText(
    'after',
    `
Environment variables:
  STREAMNET_JSON=1         Same as --json
  STREAMNET_YES=1          Same as --yes
  STREAMNET_NO_INPUT=1     Same as --no-input
  STREAMNET_CONFIG=<path>  Path to config file
  STREAMNET_LOG_LEVEL=debug|info|warn|error
  STREAMNET_OPENSUBTITLES_API_KEY=<key>
  NO_COLOR=1               Disable ANSI colour

Exit codes:
  0  OK          2  USAGE       3  NO_RESULTS   4  DEP_MISSING
  5  NETWORK     6  UNPLAYABLE  7  PLAYER_FAIL  8  SUBS_NOT_FOUND
  9  CONFIG     10  AUTH       77  EX_NOINPUT  130  SIGINT
`,
  );

// Prevent Commander from calling process.exit; suppress its default stderr writes
// so we own all error output formatting (envelope in JSON mode, plain text otherwise).
program.exitOverride();
program.configureOutput({ writeErr: () => {} });

/** Build a CommandContext from the current program option values. */
function makeContext(opts: Record<string, unknown>): CommandContext {
  const json = Boolean(opts.json) || process.env.STREAMNET_JSON === '1';
  const yes = Boolean(opts.yes) || process.env.STREAMNET_YES === '1';
  // Commander's --no-X stores under the positive key: opts.input === false when --no-input passed
  const noInput = opts.input === false || process.env.STREAMNET_NO_INPUT === '1';
  const quiet = Boolean(opts.quiet);
  const verbose = Boolean(opts.verbose);
  const color = opts.color !== false && !process.env.NO_COLOR;

  const outputOpts: OutputOptions = { json, yes, noInput, quiet, verbose, color };
  const output = new OutputContext(outputOpts);

  const configOverride = opts.config as string | undefined;
  const config = loadConfig(configOverride);
  const resolvedConfigPath = configFile(configOverride);

  return { output, config, configPath: resolvedConfigPath, version: VERSION };
}

// Wire each CommandSpec onto the program
for (const spec of COMMAND_SPECS) {
  if (spec.id === 'manifest') continue; // wired separately — needs all specs
  const cmd = buildCommand(spec, () => {
    const opts = program.opts<Record<string, unknown>>();
    return makeContext(opts);
  });
  program.addCommand(cmd);
}

// manifest — special case: handler receives the full spec list
program
  .command('manifest')
  .description('Emit the machine-readable command manifest (agent discovery).')
  .action(async () => {
    const opts = program.opts<Record<string, unknown>>();
    const ctx = makeContext(opts);
    await manifestHandler(ctx, {}, COMMAND_SPECS);
    process.exit(ExitCode.OK);
  });

// mcp — stub; emits proper envelope in JSON mode
program
  .command('mcp')
  .description('Start an MCP stdio server exposing all commands as tools.')
  .option('--stdio', 'Use stdio transport (default)', true)
  .action(async () => {
    const opts = program.opts<Record<string, unknown>>();
    const ctx = makeContext(opts);
    if (ctx.output.mode === 'json') {
      await ctx.output.emitError('mcp', VERSION, {
        code: ExitCode.USAGE,
        message: 'MCP server not yet implemented — arrives in v0.4.',
        hint: 'Track: https://github.com/aedneth/streamnet-cli/issues',
      });
      process.exit(ExitCode.USAGE);
    } else {
      ctx.output.info('MCP server (stdio) — available in v0.4');
      process.exit(ExitCode.OK);
    }
  });

// completion — stub; emits proper envelope in JSON mode
program
  .command('completion <shell>')
  .description('Print shell completion script (bash|zsh|fish|pwsh).')
  .action(async (shell: string) => {
    const opts = program.opts<Record<string, unknown>>();
    const ctx = makeContext(opts);
    if (ctx.output.mode === 'json') {
      await ctx.output.emitError('completion', VERSION, {
        code: ExitCode.USAGE,
        message: `Shell completion for ${shell} not yet implemented — arrives in v0.5.`,
      });
      process.exit(ExitCode.USAGE);
    } else {
      ctx.output.info(`Shell completion for ${shell} — available in v0.5`);
      process.exit(ExitCode.OK);
    }
  });

// Handle SIGINT cleanly
process.on('SIGINT', () => {
  process.exit(ExitCode.SIGINT);
});

// Detect JSON mode from raw argv — needed before program.opts() is available,
// so Commander errors can be rendered as envelopes when --json is in argv.
function isJsonMode(): boolean {
  return process.argv.includes('--json') || process.env.STREAMNET_JSON === '1';
}

// parseAsync with exitOverride throws CommanderError instead of calling process.exit.
program.parseAsync(process.argv).catch(async (err: unknown) => {
  if (err instanceof CommanderError) {
    if (err.exitCode === 0) {
      // --help / --version: Commander already wrote to stdout; exit cleanly.
      process.exit(0);
    }
    // Usage error (missing arg, unknown option, etc.) → exit 2 with USAGE envelope
    if (isJsonMode()) {
      await new Promise<void>((resolve, reject) =>
        process.stdout.write(
          JSON.stringify(
            errorEnvelope('streamnet', VERSION, {
              code: ExitCode.USAGE,
              message: err.message,
            }),
          ) + '\n',
          (e) => (e ? reject(e) : resolve()),
        ),
      );
    } else {
      process.stderr.write(`error: ${err.message}\n`);
    }
    process.exit(ExitCode.USAGE);
  }
  process.stderr.write(`Unhandled error: ${String(err)}\n`);
  process.exit(ExitCode.ERROR);
});
