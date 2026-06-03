import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ExitCode, fail } from '../../agent/exit.js';

const FLATPAK_PREFIXES = [
  '/var/lib/flatpak',
  '/run/flatpak',
  `${process.env.HOME ?? ''}/.local/share/flatpak`,
];
const SNAP_PREFIX = '/snap/';

/** Known native VLC binary locations per platform. */
const VLC_CANDIDATES: Record<string, string[]> = {
  linux: ['/usr/bin/vlc', '/usr/local/bin/vlc', '/bin/vlc'],
  darwin: [
    '/Applications/VLC.app/Contents/MacOS/VLC',
    '/usr/local/bin/vlc',
    '/opt/homebrew/bin/vlc',
  ],
  win32: [
    'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
  ],
};

function isSandboxed(resolved: string): boolean {
  for (const prefix of FLATPAK_PREFIXES) {
    if (resolved.startsWith(prefix)) return true;
  }
  return resolved.startsWith(SNAP_PREFIX);
}

function resolveSymlink(p: string): string {
  try {
    return execSync(`readlink -f "${p}"`, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return p;
  }
}

/**
 * Locate the native VLC binary for the current OS.
 *
 * Explicitly rejects Flatpak and Snap paths because their sandboxing prevents
 * the spawn+IPC integration that is the core purpose of this tool.
 *
 * Returns the absolute path or throws DEP_MISSING.
 */
export function detectVlc(): string {
  const platform = process.platform as string;
  const candidates = VLC_CANDIDATES[platform] ?? VLC_CANDIDATES.linux!;

  // Also try PATH (for distros that place VLC elsewhere)
  try {
    const which =
      platform === 'win32'
        ? execSync('where vlc 2>nul', { stdio: ['pipe', 'pipe', 'pipe'] })
            .toString()
            .split('\r\n')[0]!
            .trim()
        : execSync('which vlc 2>/dev/null', { stdio: ['pipe', 'pipe', 'pipe'] })
            .toString()
            .trim();
    if (which) candidates.unshift(which);
  } catch {
    // which/where not available or VLC not on PATH — fall through to candidates
  }

  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const resolved = resolveSymlink(p);
    if (isSandboxed(resolved)) {
      // Found a Flatpak/Snap VLC — record but keep searching for a native install
      continue;
    }
    return p;
  }

  // Check if the only VLC found was sandboxed
  for (const p of candidates) {
    if (existsSync(p)) {
      const resolved = resolveSymlink(p);
      if (isSandboxed(resolved)) {
        fail(
          ExitCode.DEP_MISSING,
          'Only a Flatpak or Snap VLC was found. StreamNet requires native VLC.',
          'Run `streamnet setup` to install native VLC, then re-run.',
        );
      }
    }
  }

  fail(
    ExitCode.DEP_MISSING,
    'VLC was not found. StreamNet requires native VLC (not Flatpak/Snap).',
    'Run `streamnet setup` to install native VLC, then re-run.',
  );
}

/** Check if VLC is available without throwing; returns path or null. */
export function findVlc(): string | null {
  try {
    return detectVlc();
  } catch {
    return null;
  }
}
