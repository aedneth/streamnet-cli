import { execa, type ResultPromise } from 'execa';
import { detectVlc } from './detect.js';
import { ExitCode, fail } from '../../agent/exit.js';
import { logger } from '../../util/logger.js';

export interface VlcSpawnOptions {
  streamUrl: string;
  subFile?: string;
  /** If provided, VLC's HTTP interface is enabled on this port for IPC. */
  httpPort?: number;
  httpPassword?: string;
  title?: string;
  extraArgs?: string[];
}

export interface VlcProcess {
  proc: ResultPromise;
  vlcPath: string;
}

/**
 * Spawn native VLC with a streaming URL.
 *
 * VLC is started detached so that the CLI can exit / keep the Node process
 * alive to seed while VLC plays. stdout/stderr from VLC are piped so that
 * unexpected crashes surface in the log.
 */
export function spawnVlc(opts: VlcSpawnOptions): VlcProcess {
  const vlcPath = detectVlc();

  const args: string[] = [opts.streamUrl];

  if (opts.subFile) {
    args.push('--sub-file', opts.subFile);
  }

  if (opts.httpPort) {
    args.push(
      '--intf',
      'http',
      '--http-host',
      '127.0.0.1',
      '--http-port',
      String(opts.httpPort),
      '--http-password',
      opts.httpPassword ?? 'streamnet',
    );
  }

  if (opts.title) {
    args.push('--meta-title', opts.title);
  }

  if (opts.extraArgs?.length) {
    args.push(...opts.extraArgs);
  }

  logger.info(`Spawning VLC: ${vlcPath} ${args.join(' ')}`);

  let proc: ResultPromise;
  try {
    proc = execa(vlcPath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    fail(ExitCode.PLAYER_FAILED, `Failed to spawn VLC: ${String(err)}`);
  }

  proc.on('error', (err: Error) => {
    logger.error(`VLC process error: ${err.message}`);
  });

  return { proc, vlcPath };
}

/** Wait for VLC to exit, resolve with exit code. */
export async function waitForVlc(vlcProc: VlcProcess): Promise<number> {
  try {
    await vlcProc.proc;
    return 0;
  } catch (err: unknown) {
    const exitCode = (err as { exitCode?: number }).exitCode ?? 1;
    logger.warn(`VLC exited with code ${exitCode}`);
    if (exitCode !== 0 && exitCode !== 1) {
      // code 1 is normal VLC quit; others may indicate a problem
      fail(ExitCode.PLAYER_FAILED, `VLC exited with non-zero code: ${exitCode}`);
    }
    return exitCode;
  }
}
