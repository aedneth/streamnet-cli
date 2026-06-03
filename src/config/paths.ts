import { homedir } from 'node:os';
import { join } from 'node:path';

const APP = 'streamnet';

function isWindows(): boolean {
  return process.platform === 'win32';
}

function winBase(envVar: string, fallback: string): string {
  return process.env[envVar] ?? join(homedir(), fallback);
}

/**
 * Resolve an XDG-style base directory.
 *
 * Order: explicit XDG_* env var → platform default. On Windows we use
 * %APPDATA% / %LOCALAPPDATA%; elsewhere we follow the XDG Base Directory spec
 * (the Korvex-suite convention, consistent across Linux and macOS).
 */
export interface Paths {
  config: string;
  cache: string;
  data: string;
  state: string;
}

export function resolvePaths(): Paths {
  if (isWindows()) {
    const appData = winBase('APPDATA', 'AppData/Roaming');
    const localAppData = winBase('LOCALAPPDATA', 'AppData/Local');
    return {
      config: join(appData, APP),
      cache: join(localAppData, APP, 'cache'),
      data: join(localAppData, APP, 'data'),
      state: join(localAppData, APP, 'state'),
    };
  }

  const home = homedir();
  const xdg = (envVar: string, fallback: string): string =>
    join(process.env[envVar] ?? join(home, fallback), APP);

  return {
    config: xdg('XDG_CONFIG_HOME', '.config'),
    cache: xdg('XDG_CACHE_HOME', '.cache'),
    data: xdg('XDG_DATA_HOME', '.local/share'),
    state: xdg('XDG_STATE_HOME', '.local/state'),
  };
}

export function configFile(override?: string): string {
  if (override) return override;
  if (process.env.STREAMNET_CONFIG) return process.env.STREAMNET_CONFIG;
  return join(resolvePaths().config, 'config.json');
}

export function downloadsDir(): string {
  return join(resolvePaths().data, 'downloads');
}

export function logFile(): string {
  return join(resolvePaths().data, 'logs', 'streamnet.log');
}
