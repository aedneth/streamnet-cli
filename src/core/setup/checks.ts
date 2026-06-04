import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { findVlc } from '../player/detect.js';
import { httpGetText } from '../../util/http.js';
import { logger } from '../../util/logger.js';
import { downloadsDir } from '../../config/paths.js';
import type { Config } from '../../config/schema.js';

export interface CheckResult {
  name: string;
  /** Contributes to `allOk` / the doctor exit code. A `warn` is reported with ok=true. */
  ok: boolean;
  message: string;
  hint?: string;
  /** Advisory-only: surfaced as a warning but does not fail doctor. */
  warn?: boolean;
}

async function checkVlc(): Promise<CheckResult> {
  const path = findVlc();
  if (path) {
    return { name: 'vlc', ok: true, message: `Native VLC found at ${path}` };
  }
  return {
    name: 'vlc',
    ok: false,
    message: 'Native VLC not found (Flatpak/Snap not accepted)',
    hint: 'Run `streamnet setup` to install native VLC.',
  };
}

async function checkNode(): Promise<CheckResult> {
  const ver = process.version;
  const major = parseInt(ver.slice(1).split('.')[0] ?? '0', 10);
  if (major >= 20) {
    return { name: 'node', ok: true, message: `Node.js ${ver}` };
  }
  return {
    name: 'node',
    ok: false,
    message: `Node.js ${ver} — requires >=20`,
    hint: 'Upgrade Node.js: https://nodejs.org',
  };
}

async function checkNetwork(): Promise<CheckResult> {
  try {
    await httpGetText('https://torrents-csv.com', { timeoutMs: 5000 });
    return { name: 'network', ok: true, message: 'Network reachable (torrents-csv)' };
  } catch {
    return {
      name: 'network',
      ok: false,
      message: 'Network check failed (torrents-csv unreachable)',
      hint: 'Check your internet connection or proxy settings.',
    };
  }
}

async function checkWebtorrent(): Promise<CheckResult> {
  try {
    await import('webtorrent');
    return { name: 'webtorrent', ok: true, message: 'webtorrent module available' };
  } catch {
    return {
      name: 'webtorrent',
      ok: false,
      message: 'webtorrent optional dep not installed',
      hint: 'Run: npm install -g webtorrent  (or reinstall streamnet-cli)',
    };
  }
}

async function checkDownloadDir(dir: string): Promise<CheckResult> {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.streamnet-write-test-${process.pid}`);
    writeFileSync(probe, 'ok');
    rmSync(probe, { force: true });
    return { name: 'downloadDir', ok: true, message: `Writable: ${dir}` };
  } catch {
    return {
      name: 'downloadDir',
      ok: false,
      message: `Download directory not writable: ${dir}`,
      hint: 'Set a writable path: streamnet config set downloadDir <path>',
    };
  }
}

async function checkOpenSubtitles(config?: Config): Promise<CheckResult> {
  if (config?.opensubtitles.apiKey) {
    return { name: 'opensubtitles', ok: true, message: 'API key configured' };
  }
  return {
    name: 'opensubtitles',
    ok: true,
    warn: true,
    message: 'No API key — subtitle search disabled (optional)',
    hint: 'Free key at https://www.opensubtitles.com/consumers, then: streamnet config set opensubtitles.apiKey <key>',
  };
}

export async function runAllChecks(config?: Config): Promise<CheckResult[]> {
  const downloadDir = config?.downloadDir ?? downloadsDir();
  const results = await Promise.allSettled([
    checkNode(),
    checkVlc(),
    checkWebtorrent(),
    checkNetwork(),
    checkDownloadDir(downloadDir),
    checkOpenSubtitles(config),
  ]);

  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    logger.error(`Check threw: ${String(r.reason)}`);
    return { name: 'unknown', ok: false, message: String(r.reason) };
  });
}
