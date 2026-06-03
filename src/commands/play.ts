import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import { searchHandler } from './search.js';
import { streamHandler, type StreamResult } from './stream.js';
import { ExitCode, fail } from '../agent/exit.js';
import type { TorrentResult } from '../core/indexers/types.js';

export interface PlayInput {
  query: string;
  quality?: string;
  container?: string;
  minSeeders?: number;
  yes?: boolean;
  fileIndex?: number;
  noSubs?: boolean;
  subLang?: string;
}

export interface PlayResult extends StreamResult {
  selectedTorrent: TorrentResult;
}

export async function playHandler(
  ctx: CommandContext,
  input: PlayInput,
): Promise<PlayResult> {
  // 1. Search
  const searchResult = await searchHandler(ctx, {
    query: input.query,
    minSeeders: input.minSeeders,
    container: input.container,
    quality: input.quality,
  });

  const results = searchResult.results;
  if (results.length === 0) {
    fail(ExitCode.NO_RESULTS, `No results found for "${input.query}".`);
  }

  // 2. Select: agent/--yes → top result; interactive → prompt (TUI in v0.7)
  let selected: TorrentResult;
  const useTop = input.yes || ctx.output.options.yes || !ctx.output.interactive;

  if (useTop) {
    selected = results[0]!;
    ctx.output.info(`Auto-selecting top result: ${selected.title}`);
  } else {
    // Non-interactive fallback until TUI lands in v0.7
    selected = results[0]!;
    ctx.output.info(`Selecting top result: ${selected.title}`);
    ctx.output.info('(Interactive selection will be available in v0.7)');
  }

  const source = selected.magnet ?? selected.torrentUrl;
  if (!source) {
    fail(ExitCode.TORRENT_UNPLAYABLE, `No magnet or URL for: ${selected.title}`);
  }

  // 3. Stream → VLC
  const streamResult = await streamHandler(ctx, {
    source,
    fileIndex: input.fileIndex,
    noSubs: input.noSubs,
    subLang: input.subLang,
  });

  return { ...streamResult, selectedTorrent: selected };
}

export function renderPlay(data: PlayResult, output: OutputContext): void {
  output.success(
    `Played: ${data.selectedTorrent.title} → ${data.fileName} (VLC exit: ${data.vlcExitCode})`,
  );
}
