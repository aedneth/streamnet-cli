import { existsSync } from 'node:fs';
import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import {
  saveConfig,
  getConfigValue,
  setConfigValue,
  redactConfig,
} from '../config/store.js';
import { configFile } from '../config/paths.js';
import { ExitCode, fail } from '../agent/exit.js';

export interface ConfigInput {
  subcommand: string;
  key?: string;
  value?: string;
}

export interface ConfigResult {
  subcommand: string;
  key?: string;
  value?: unknown;
  config?: unknown;
  path?: string;
  exists?: boolean;
}

export async function configHandler(
  ctx: CommandContext,
  input: ConfigInput,
): Promise<ConfigResult> {
  const sub = input.subcommand?.toLowerCase();

  switch (sub) {
    case 'get': {
      if (!input.key) fail(ExitCode.USAGE, '`config get` requires a key argument.');
      return {
        subcommand: 'get',
        key: input.key,
        value: getConfigValue(ctx.config, input.key),
      };
    }

    case 'set': {
      if (!input.key)
        fail(ExitCode.USAGE, '`config set` requires key and value arguments.');
      if (input.value === undefined)
        fail(ExitCode.USAGE, '`config set` requires a value.');
      const updated = setConfigValue(ctx.config, input.key, input.value);
      saveConfig(updated, ctx.configPath);
      return { subcommand: 'set', key: input.key, value: input.value };
    }

    case 'list':
      return { subcommand: 'list', config: redactConfig(ctx.config) };

    case 'path': {
      const p = configFile();
      return { subcommand: 'path', path: p, exists: existsSync(p) };
    }

    default:
      fail(ExitCode.USAGE, `Unknown config subcommand: "${sub}". Use get|set|list|path`);
  }
}

export function renderConfig(data: ConfigResult, output: OutputContext): void {
  switch (data.subcommand) {
    case 'get':
      process.stdout.write(`${data.key}: ${JSON.stringify(data.value, null, 2)}\n`);
      break;
    case 'set':
      output.success(`Set ${data.key} = ${String(data.value)}`);
      break;
    case 'list':
      process.stdout.write(JSON.stringify(data.config, null, 2) + '\n');
      break;
    case 'path':
      process.stdout.write(data.path + (data.exists ? '\n' : ' (not yet created)\n'));
      break;
  }
}
