import type { CommandContext } from '../registry/types.js';
import { ExitCode, EXIT_CODE_NAMES, EXIT_CODE_DESCRIPTIONS } from '../agent/exit.js';
import type { CommandSpec } from '../registry/types.js';

export interface ManifestResult {
  name: string;
  version: string;
  schemaVersion: number;
  description: string;
  commands: ManifestCommand[];
  exitCodes: ManifestExitCode[];
  globalFlags: ManifestFlag[];
  installHints: Record<string, string>;
}

interface ManifestCommand {
  id: string;
  summary: string;
  description?: string;
  args?: { name: string; required: boolean; description: string }[];
  flags?: ManifestFlag[];
  exitCodes?: { code: number; meaning: string }[];
  examples?: string[];
}

interface ManifestFlag {
  long: string;
  short?: string;
  description: string;
  default?: unknown;
  env?: string;
}

interface ManifestExitCode {
  code: number;
  name: string;
  description: string;
}

const GLOBAL_FLAGS: ManifestFlag[] = [
  {
    long: 'json',
    description: 'Emit machine-readable JSON envelope on stdout',
    env: 'STREAMNET_JSON',
  },
  {
    long: 'yes',
    short: 'y',
    description: 'Skip all prompts; auto-select top result',
    env: 'STREAMNET_YES',
  },
  {
    long: 'no-input',
    description: 'Disable all interactive prompts; exit 77 if one is needed',
    env: 'STREAMNET_NO_INPUT',
  },
  { long: 'quiet', short: 'q', description: 'Suppress diagnostic output' },
  {
    long: 'verbose',
    short: 'v',
    description: 'Verbose diagnostic output',
    env: 'STREAMNET_LOG_LEVEL',
  },
  { long: 'no-color', description: 'Disable ANSI colour', env: 'NO_COLOR' },
  { long: 'config', description: 'Path to config file', env: 'STREAMNET_CONFIG' },
  { long: 'version', description: 'Print version and exit' },
  { long: 'help', short: 'h', description: 'Show help' },
];

export function buildManifest(specs: CommandSpec[], version: string): ManifestResult {
  return {
    name: 'streamnet',
    version,
    schemaVersion: 1,
    description:
      'Torrent search + in-process WebTorrent streaming to native VLC with hash-based subtitles. Agent-native CLI.',
    globalFlags: GLOBAL_FLAGS,
    commands: specs.map((s) => ({
      id: s.id,
      summary: s.summary,
      description: s.description,
      args: s.args?.map((a) => ({
        name: a.name,
        required: a.required,
        description: a.description,
      })),
      flags: s.flags?.map((f) => ({
        long: f.long,
        short: f.short,
        description: f.description,
        default: f.default,
        env: f.env,
      })),
      exitCodes: s.exitCodes?.map((e) => ({ code: e.code, meaning: e.meaning })),
      examples: s.examples,
    })),
    exitCodes: Object.values(ExitCode)
      .filter((v): v is ExitCode => typeof v === 'number')
      .map((code) => ({
        code,
        name: EXIT_CODE_NAMES[code] ?? String(code),
        description: EXIT_CODE_DESCRIPTIONS[code] ?? '',
      })),
    installHints: {
      npm: 'npm install -g streamnet-cli',
      binary: 'https://github.com/eduardoborjas/streamnet-cli/releases',
      homebrew: 'brew install eduardoborjas/tap/streamnet (v1.0)',
      scoop: 'scoop install streamnet (v1.0)',
    },
  };
}

export async function manifestHandler(
  ctx: CommandContext,
  _input: Record<string, unknown>,
  specs: CommandSpec[],
): Promise<ManifestResult> {
  const manifest = buildManifest(specs, ctx.version);

  // Always emit as JSON regardless of --json flag — manifest IS the machine interface
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
