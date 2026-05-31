import { findVlc } from '../player/detect.js';
import { httpGetText } from '../../util/http.js';
import { logger } from '../../util/logger.js';

export interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  hint?: string;
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

export async function runAllChecks(): Promise<CheckResult[]> {
  const results = await Promise.allSettled([
    checkNode(),
    checkVlc(),
    checkWebtorrent(),
    checkNetwork(),
  ]);

  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    logger.error(`Check threw: ${String(r.reason)}`);
    return { name: 'unknown', ok: false, message: String(r.reason) };
  });
}
