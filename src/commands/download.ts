import { readFileSync, mkdirSync } from 'node:fs';
import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import { downloadTorrent } from '../core/torrent/engine.js';
import { isMkv } from '../core/torrent/select.js';
import { fetchSubtitle, osConfigFrom } from '../core/subtitles/fetch.js';
import { ExitCode, fail } from '../agent/exit.js';
import { formatBytes } from '../util/format.js';

export interface DownloadInput {
  source: string;
  out?: string;
  fileIndex?: number;
  noSubs?: boolean;
}

export interface DownloadCmdResult {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  subtitlePath?: string;
}

export async function downloadHandler(
  ctx: CommandContext,
  input: DownloadInput,
): Promise<DownloadCmdResult> {
  let source = input.source;
  if (source === '-') {
    source = readFileSync('/dev/stdin', 'utf8').trim();
    if (!source) fail(ExitCode.USAGE, 'No source provided via stdin.');
  }

  const outDir = input.out ?? ctx.config.downloadDir;
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (err) {
    fail(ExitCode.NETWORK, `Cannot create download directory ${outDir}: ${String(err)}`);
  }

  ctx.output.info(`Downloading to ${outDir}…`);

  const result = await downloadTorrent({
    source,
    outDir,
    fileIndex: input.fileIndex,
    preferredContainers: ctx.config.preferredContainers,
    onProgress: (p) => {
      ctx.output.progress({
        progress: (p.progress * 100).toFixed(1) + '%',
        peers: p.peers,
        speed: formatBytes(p.downloadSpeed) + '/s',
      });
    },
  });

  ctx.output.success(`Downloaded: ${result.filePath} (${formatBytes(result.sizeBytes)})`);

  // Auto subtitle search for non-MKV (best-effort; never fails the download).
  let subtitlePath: string | undefined;
  const haveKey = Boolean(ctx.config.opensubtitles.apiKey);
  if (!input.noSubs && !isMkv(result.fileName) && haveKey) {
    try {
      const sub = await fetchSubtitle({
        cfg: osConfigFrom(ctx.config),
        videoPath: result.filePath,
      });
      subtitlePath = sub.path;
      ctx.output.success(`Subtitle (${sub.language}) → ${sub.path}`);
    } catch (err) {
      ctx.output.warn(`Subtitle search failed: ${(err as Error).message}`);
    }
  }

  return {
    filePath: result.filePath,
    fileName: result.fileName,
    sizeBytes: result.sizeBytes,
    subtitlePath,
  };
}

export function renderDownload(data: DownloadCmdResult, output: OutputContext): void {
  output.success(`Saved ${data.fileName} → ${data.filePath}`);
  if (data.subtitlePath) output.info(`Subtitle: ${data.subtitlePath}`);
}
