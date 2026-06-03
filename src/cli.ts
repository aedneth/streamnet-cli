import { Command } from 'commander';
import { createRequire } from 'node:module';
import { buildCommand } from './registry/build.js';
import { COMMAND_SPECS } from './registry/index.js';
import { OutputContext, type OutputOptions } from './agent/output.js';
import { loadConfig } from './config/store.js';
import { ExitCode } from './agent/exit.js';
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
  .option('--no-input', 'Disable interactive prompts; exit 77 if one is needed', false)
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

/** Build a CommandContext from the current program option values. */
function makeContext(opts: Record<string, unknown>): CommandContext {
  // Env vars override flags
  const json = Boolean(opts.json) || process.env.STREAMNET_JSON === '1';
  const yes = Boolean(opts.yes) || process.env.STREAMNET_YES === '1';
  const noInput = Boolean(opts.noInput) || process.env.STREAMNET_NO_INPUT === '1';
  const quiet = Boolean(opts.quiet);
  const verbose = Boolean(opts.verbose);
  const color = opts.color !== false && !process.env.NO_COLOR;

  const outputOpts: OutputOptions = { json, yes, noInput, quiet, verbose, color };
  const output = new OutputContext(outputOpts);

  const config = loadConfig(opts.config as string | undefined);

  return { output, config, version: VERSION };
}

// Wire each CommandSpec onto the program
for (const spec of COMMAND_SPECS) {
  if (spec.id === 'manifest') {
    // manifest needs access to all specs — wired separately below
    continue;
  }
  const cmd = buildCommand(spec, () => {
    const opts = program.opts<Record<string, unknown>>();
    return makeContext(opts);
  });
  program.addCommand(cmd);
}

// manifest command — special case
program
  .command('manifest')
  .description('Emit the machine-readable command manifest (agent discovery).')
  .action(async () => {
    const opts = program.opts<Record<string, unknown>>();
    const ctx = makeContext(opts);
    await manifestHandler(ctx, {}, COMMAND_SPECS);
    process.exit(ExitCode.OK);
  });

// mcp command — MCP stdio server
program
  .command('mcp')
  .description('Start an MCP stdio server exposing all commands as tools.')
  .option('--stdio', 'Use stdio transport (default)', true)
  .action(async () => {
    const opts = program.opts<Record<string, unknown>>();
    const context = makeContext(opts);
    context.output.info('MCP server (stdio) — available in v0.4');
    context.output.info('Install an MCP client and run: streamnet mcp --stdio');
    process.exit(ExitCode.OK);
  });

// completion command
program
  .command('completion <shell>')
  .description('Print shell completion script (bash|zsh|fish|pwsh).')
  .action((shell: string) => {
    const opts = program.opts<Record<string, unknown>>();
    const ctx = makeContext(opts);
    ctx.output.info(`Shell completion for ${shell} — available in v0.5`);
    process.exit(ExitCode.OK);
  });

// Handle SIGINT cleanly
process.on('SIGINT', () => {
  process.exit(ExitCode.SIGINT);
});

// Parse — exits on --help / --version automatically
program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Unhandled error: ${String(err)}\n`);
  process.exit(ExitCode.ERROR);
});
