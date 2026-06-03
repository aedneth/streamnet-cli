import { readFileSync, existsSync } from 'node:fs';

export type Platform = 'linux' | 'darwin' | 'win32' | 'unknown';
export type Distro = 'ubuntu' | 'debian' | 'fedora' | 'arch' | 'opensuse' | 'unknown';

export interface OsInfo {
  platform: Platform;
  arch: string;
  distro: Distro;
  /** e.g. '22.04' on Ubuntu */
  distroVersion?: string;
  isWsl: boolean;
}

export function detectOs(): OsInfo {
  const platform = (process.platform as Platform) ?? 'unknown';
  const arch = process.arch;
  const isWsl = Boolean(
    process.env.WSL_DISTRO_NAME ||
    (existsSync('/proc/version') &&
      readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')),
  );

  let distro: Distro = 'unknown';
  let distroVersion: string | undefined;

  if (platform === 'linux' && existsSync('/etc/os-release')) {
    const text = readFileSync('/etc/os-release', 'utf8');
    const id = (text.match(/^ID=(.+)$/m)?.[1] ?? '').toLowerCase().replace(/"/g, '');
    const ver = text.match(/^VERSION_ID="?([^"\n]+)"?/m)?.[1] ?? '';

    if (['ubuntu', 'pop'].includes(id) || id.includes('ubuntu')) distro = 'ubuntu';
    else if (id === 'debian' || id === 'linuxmint') distro = 'debian';
    else if (['fedora', 'rhel', 'centos'].includes(id)) distro = 'fedora';
    else if (id === 'arch' || id === 'manjaro') distro = 'arch';
    else if (id.includes('suse')) distro = 'opensuse';

    distroVersion = ver || undefined;
  }

  return { platform, arch, distro, distroVersion, isWsl };
}
