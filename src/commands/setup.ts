import type { CommandContext } from '../registry/types.js';
import { installVlc } from '../core/setup/install.js';
import { findVlc } from '../core/player/detect.js';

export interface SetupInput {
  yes?: boolean;
  check?: boolean;
}

export interface SetupResult {
  vlcPath: string | null;
  installed: boolean;
}

export async function setupHandler(
  ctx: CommandContext,
  input: SetupInput,
): Promise<SetupResult> {
  const existing = findVlc();

  if (existing) {
    ctx.output.success(`Native VLC already installed: ${existing}`);
    return { vlcPath: existing, installed: false };
  }

  if (input.check) {
    ctx.output.warn('VLC not found (check-only mode, not installing).');
    return { vlcPath: null, installed: false };
  }

  if (!ctx.output.options.yes && !input.yes && ctx.output.interactive) {
    ctx.output.info('VLC not found. Installing native VLC...');
  }

  await installVlc(Boolean(ctx.output.options.yes || input.yes));
  const vlcPath = findVlc();
  ctx.output.success(`VLC installed: ${vlcPath ?? '(not found after install?)'}`);

  return { vlcPath, installed: true };
}
