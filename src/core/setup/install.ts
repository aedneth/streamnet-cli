import { execa } from 'execa';
import { detectOs } from './os.js';
import { ExitCode, fail } from '../../agent/exit.js';
import { logger } from '../../util/logger.js';

/**
 * Install native VLC for the current OS using the appropriate package manager.
 *
 * Explicitly avoids Flatpak/Snap so that spawn+IPC works correctly.
 */
export async function installVlc(yes: boolean): Promise<void> {
  const os = detectOs();
  logger.info(`Installing VLC on ${os.platform}/${os.distro}`);

  switch (os.platform) {
    case 'linux':
      await installVlcLinux(os.distro, yes);
      break;
    case 'darwin':
      await installVlcMacos(yes);
      break;
    case 'win32':
      await installVlcWindows(yes);
      break;
    default:
      fail(
        ExitCode.DEP_MISSING,
        `Unsupported platform: ${os.platform}. Install VLC manually.`,
      );
  }
}

async function installVlcLinux(distro: string, _yes: boolean): Promise<void> {
  switch (distro) {
    case 'ubuntu':
    case 'debian': {
      // Ensure we're NOT installing the Snap version — pin to apt
      await run('sudo', ['apt-get', 'update', '-qq']);
      await run('sudo', ['apt-get', 'install', '-y', 'vlc', '--no-install-recommends']);
      // Prevent automatic Snap substitution (Ubuntu 24.04+)
      await runOptional('sudo', ['apt-mark', 'hold', 'vlc']);
      break;
    }
    case 'fedora':
      await run('sudo', ['dnf', 'install', '-y', 'vlc']);
      break;
    case 'arch':
      await run('sudo', ['pacman', '-Sy', '--noconfirm', 'vlc']);
      break;
    case 'opensuse':
      await run('sudo', ['zypper', 'install', '-y', 'vlc']);
      break;
    default:
      fail(
        ExitCode.DEP_MISSING,
        'Could not detect Linux distro. Install VLC manually via your package manager.',
        'Then re-run `streamnet setup`.',
      );
  }
}

async function installVlcMacos(_yes: boolean): Promise<void> {
  // Prefer Homebrew cask for the full macOS app
  await run('brew', ['install', '--cask', 'vlc']);
}

async function installVlcWindows(_yes: boolean): Promise<void> {
  // winget is available on Windows 10 1709+ / Windows 11
  try {
    await run('winget', [
      'install',
      '--id',
      'VideoLAN.VLC',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ]);
  } catch {
    // Fallback: choco
    await run('choco', ['install', 'vlc', '-y']);
  }
}

async function run(cmd: string, args: string[]): Promise<void> {
  logger.info(`> ${cmd} ${args.join(' ')}`);
  try {
    await execa(cmd, args, { stdio: 'inherit' });
  } catch (err) {
    fail(
      ExitCode.DEP_MISSING,
      `Install command failed: ${cmd} ${args.join(' ')}`,
      String(err),
    );
  }
}

async function runOptional(cmd: string, args: string[]): Promise<void> {
  try {
    await execa(cmd, args, { stdio: 'pipe' });
  } catch {
    // best-effort — non-fatal
  }
}
