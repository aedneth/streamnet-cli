import { readFileSync } from 'node:fs';
import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import { startStream } from '../core/torrent/engine.js';
import { isMkv } from '../core/torrent/select.js';
import { spawnVlc, waitForVlc } from '../core/player/vlc.js';
import { ExitCode, fail } from '../agent/exit.js';
import { formatBytes } from '../util/format.js';

export interface StreamInput {
  source: string;
  fileIndex?: number;
  port?: number;
  noSubs?: boolean;
  subLang?: string;
  player?: string;
}

export interface StreamResult {
  streamUrl: string;
  fileName: string;
  fileIndex: number;
  sizeBytes: number;
  subtitleFile?: string;
  vlcExitCode: number;
}

export async function streamHandler(
  ctx: CommandContext,
  input: StreamInput,
): Promise<StreamResult> {
  // Support `-` for stdin piped source
  let source = input.source;
  if (source === '-') {
    source = readFileSync('/dev/stdin', 'utf8').trim();
    if (!source) fail(ExitCode.USAGE, 'No source provided via stdin.');
  }

  ctx.output.info(`Starting stream: ${source.slice(0, 72)}…`);

  const info = await startStream({
    source,
    fileIndex: input.fileIndex,
    port: input.port ?? ctx.config.streamPort,
    preferredContainers: ctx.config.preferredContainers,
    onProgress: (p) => {
      ctx.output.progress({
        progress: (p.progress * 100).toFixed(1) + '%',
        peers: p.peers,
        speed: formatBytes(p.downloadSpeed) + '/s',
      });
    },
  });

  ctx.output.success(`Streaming: ${info.fileName} (${formatBytes(info.sizeBytes)})`);
  ctx.output.info(`Local URL: ${info.streamUrl}`);

  try {
    let subtitleFile: string | undefined;
    const skipSubs = input.noSubs || isMkv(info.fileName);

    if (!skipSubs) {
      // Subtitle search happens in v0.3; for now inform the user
      ctx.output.info('Non-MKV file detected. Subtitle search will be added in v0.3.');
    }

    const vlcProc = spawnVlc({
      streamUrl: info.streamUrl,
      subFile: subtitleFile,
      title: info.fileName,
    });
    ctx.output.success(`VLC launched: ${vlcProc.vlcPath}`);

    const vlcExitCode = await waitForVlc(vlcProc);

    return {
      streamUrl: info.streamUrl,
      fileName: info.fileName,
      fileIndex: info.fileIndex,
      sizeBytes: info.sizeBytes,
      subtitleFile,
      vlcExitCode,
    };
  } finally {
    info.destroy();
  }
}

export function renderStream(data: StreamResult, output: OutputContext): void {
  output.success(`Playback finished: ${data.fileName} (VLC exit: ${data.vlcExitCode})`);
}
