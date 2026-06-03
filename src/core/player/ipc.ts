/**
 * VLC HTTP/Lua interface — used to inject subtitles or query status after
 * VLC has already started. This is optional; the primary path is --sub-file
 * at spawn time. IPC is only used when the subtitle file arrives after VLC
 * has opened (e.g. the hash-download raced the torrent metadata fetch).
 */

import { logger } from '../../util/logger.js';

export interface VlcIpcOptions {
  host?: string;
  port: number;
  password: string;
}

async function vlcRequest(opts: VlcIpcOptions, path: string): Promise<string> {
  const host = opts.host ?? '127.0.0.1';
  const credentials = Buffer.from(`:${opts.password}`).toString('base64');
  const url = `http://${host}:${opts.port}/requests/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error(`VLC IPC HTTP ${res.status}`);
  return res.text();
}

/** Add a subtitle track to a running VLC instance. */
export async function loadSubtitlesIpc(
  opts: VlcIpcOptions,
  subFilePath: string,
): Promise<void> {
  try {
    await vlcRequest(
      opts,
      `command.xml?command=sub-track&val=${encodeURIComponent(subFilePath)}`,
    );
    logger.info(`Loaded subtitles via VLC IPC: ${subFilePath}`);
  } catch (err) {
    logger.warn(`VLC IPC subtitle load failed: ${String(err)}`);
  }
}

/** Returns true if the VLC HTTP interface responds. */
export async function isVlcIpcReady(opts: VlcIpcOptions): Promise<boolean> {
  try {
    await vlcRequest(opts, 'status.json');
    return true;
  } catch {
    return false;
  }
}
