import { join } from 'node:path';
import { ExitCode, StreamNetError, fail } from '../../agent/exit.js';
import { logger } from '../../util/logger.js';
import { selectVideoFile } from './select.js';

export interface TorrentStreamInfo {
  /** HTTP URL suitable for passing directly to VLC. */
  streamUrl: string;
  /** Filename of the selected file. */
  fileName: string;
  /** File index within the torrent. */
  fileIndex: number;
  /** Total size of the selected file in bytes. */
  sizeBytes: number;
  destroy: () => void;
}

export interface StreamOptions {
  /** magnet link or .torrent URL */
  source: string;
  /** Preferred file index (0-based). If omitted, selectVideoFile is used. */
  fileIndex?: number;
  /** Port for the local HTTP stream server; 0 = ephemeral. */
  port?: number;
  preferredContainers?: string[];
  /** Called with download progress 0..1 */
  onProgress?: (info: { progress: number; peers: number; downloadSpeed: number }) => void;
  signal?: AbortSignal;
  /** How long to wait for torrent metadata before giving up (ms). Default 30 s. */
  metadataTimeoutMs?: number;
}

/**
 * Start a WebTorrent stream and expose the selected file via a local HTTP server.
 *
 * WebTorrent is a heavy optional dependency — it is dynamically imported here so
 * commands that don't need streaming (search, config, doctor) don't pay the load
 * cost and so the module can be absent in test environments.
 */
/**
 * Dynamically load the WebTorrent constructor. It's a heavy optional dependency,
 * so it is imported lazily and absent-tolerant (commands that don't stream, and
 * test environments, don't pay for it).
 */
async function loadWebTorrent(): Promise<new () => WebTorrentInstance> {
  try {
    const mod = (await import('webtorrent')) as { default: new () => WebTorrentInstance };
    return mod.default;
  } catch {
    fail(
      ExitCode.DEP_MISSING,
      'webtorrent is not installed. Run `npm install webtorrent` or reinstall streamnet.',
    );
  }
}

export async function startStream(opts: StreamOptions): Promise<TorrentStreamInfo> {
  const WebTorrentCtor = await loadWebTorrent();

  return new Promise<TorrentStreamInfo>((resolve, reject) => {
    const client = new WebTorrentCtor();
    const metaTimeout = opts.metadataTimeoutMs ?? 30_000;

    const timer = setTimeout(() => {
      client.destroy();
      reject(
        new StreamNetError(
          ExitCode.TORRENT_UNPLAYABLE,
          'Torrent metadata timed out — no peers responded.',
        ),
      );
    }, metaTimeout);

    if (opts.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          client.destroy();
          reject(new StreamNetError(ExitCode.TORRENT_UNPLAYABLE, 'Stream aborted.'));
        },
        { once: true },
      );
    }

    client.add(opts.source, (torrent: TorrentHandle) => {
      clearTimeout(timer);
      logger.info(`Torrent ready: ${torrent.name} (${torrent.files.length} files)`);

      const fileList = torrent.files.map((f: TorrentFileHandle) => ({
        name: f.name,
        sizeBytes: f.length,
      }));

      const fileIndex =
        opts.fileIndex ?? selectVideoFile(fileList, opts.preferredContainers);

      const file = torrent.files[fileIndex];
      if (!file) {
        client.destroy();
        reject(
          new StreamNetError(
            ExitCode.TORRENT_UNPLAYABLE,
            `File index ${fileIndex} not found in torrent.`,
          ),
        );
        return;
      }

      logger.info(`Streaming [${fileIndex}]: ${file.name} (${file.length} bytes)`);

      torrent.on('download', () => {
        opts.onProgress?.({
          progress: torrent.progress,
          peers: torrent.numPeers,
          downloadSpeed: torrent.downloadSpeed,
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = (torrent as any).createServer() as import('node:http').Server;
      const listenPort = opts.port ?? 0;

      server.listen(listenPort, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        const streamUrl = `http://127.0.0.1:${addr.port}/${fileIndex}/${encodeURIComponent(file.name)}`;
        logger.info(`Stream server: ${streamUrl}`);

        resolve({
          streamUrl,
          fileName: file.name,
          fileIndex,
          sizeBytes: file.length,
          destroy: () => {
            server.close();
            client.destroy();
          },
        });
      });
    });

    client.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export interface DownloadOptions {
  /** magnet link or .torrent URL */
  source: string;
  /** Destination directory; the torrent's files are written under it. */
  outDir: string;
  /** Preferred file index (0-based). If omitted, selectVideoFile is used. */
  fileIndex?: number;
  preferredContainers?: string[];
  onProgress?: (info: { progress: number; peers: number; downloadSpeed: number }) => void;
  signal?: AbortSignal;
  /** How long to wait for torrent metadata before giving up (ms). Default 30 s. */
  metadataTimeoutMs?: number;
}

export interface DownloadResult {
  /** Absolute path to the primary (selected) video file on disk. */
  filePath: string;
  fileName: string;
  fileIndex: number;
  sizeBytes: number;
}

/**
 * Download a torrent fully to disk and resolve once complete. Files persist after
 * the client is destroyed because they are written under `opts.outDir`.
 */
export async function downloadTorrent(opts: DownloadOptions): Promise<DownloadResult> {
  const WebTorrentCtor = await loadWebTorrent();

  return new Promise<DownloadResult>((resolve, reject) => {
    const client = new WebTorrentCtor();
    const metaTimeout = opts.metadataTimeoutMs ?? 30_000;

    const timer = setTimeout(() => {
      client.destroy();
      reject(
        new StreamNetError(
          ExitCode.TORRENT_UNPLAYABLE,
          'Torrent metadata timed out — no peers responded.',
        ),
      );
    }, metaTimeout);

    if (opts.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          client.destroy();
          reject(new StreamNetError(ExitCode.TORRENT_UNPLAYABLE, 'Download aborted.'));
        },
        { once: true },
      );
    }

    client.add(opts.source, { path: opts.outDir }, (torrent: TorrentHandle) => {
      clearTimeout(timer);
      logger.info(`Downloading: ${torrent.name} (${torrent.files.length} files)`);

      const fileList = torrent.files.map((f: TorrentFileHandle) => ({
        name: f.name,
        sizeBytes: f.length,
      }));
      const fileIndex =
        opts.fileIndex ?? selectVideoFile(fileList, opts.preferredContainers);
      const file = torrent.files[fileIndex];
      if (!file) {
        client.destroy();
        reject(
          new StreamNetError(
            ExitCode.TORRENT_UNPLAYABLE,
            `File index ${fileIndex} not found in torrent.`,
          ),
        );
        return;
      }

      torrent.on('download', () => {
        opts.onProgress?.({
          progress: torrent.progress,
          peers: torrent.numPeers,
          downloadSpeed: torrent.downloadSpeed,
        });
      });

      torrent.on('done', () => {
        const filePath = join(opts.outDir, file.path ?? file.name);
        client.destroy();
        resolve({ filePath, fileName: file.name, fileIndex, sizeBytes: file.length });
      });
    });

    client.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Minimal type stubs (avoids @types/webtorrent dependency)
interface TorrentFileHandle {
  name: string;
  length: number;
  /** Relative path of the file within the torrent (used for on-disk location). */
  path?: string;
}
interface TorrentHandle {
  name: string;
  files: TorrentFileHandle[];
  progress: number;
  numPeers: number;
  downloadSpeed: number;
  on(event: string, cb: () => void): void;
}
interface WebTorrentInstance {
  add(
    src: string,
    optsOrCb: { path?: string } | ((t: TorrentHandle) => void),
    cb?: (t: TorrentHandle) => void,
  ): void;
  on(event: string, cb: (e: Error) => void): void;
  destroy(): void;
}
