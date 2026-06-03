import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import type { TorrentResult } from '../core/indexers/types.js';
import { getEnabledIndexers, getIndexerById } from '../core/indexers/registry.js';
import { aggregateSearch } from '../core/indexers/aggregate.js';
import { rankResults } from '../core/health/rank.js';
import { formatBytes, truncate } from '../util/format.js';
import { ExitCode, fail } from '../agent/exit.js';
import pc from 'picocolors';

export interface SearchInput {
  query: string;
  limit?: number;
  indexer?: string;
  minSeeders?: number;
  quality?: string;
  container?: string;
  sort?: string;
}

export interface SearchResult {
  query: string;
  results: TorrentResult[];
  total: number;
}

export async function searchHandler(
  ctx: CommandContext,
  input: SearchInput,
): Promise<SearchResult> {
  const query = input.query;
  if (!query?.trim()) {
    fail(ExitCode.USAGE, 'Search query cannot be empty.');
  }

  const indexers = input.indexer
    ? [getIndexerById(input.indexer)].filter(Boolean).map((i) => i!)
    : getEnabledIndexers(ctx.config);

  if (indexers.length === 0) {
    fail(ExitCode.CONFIG, 'No indexers enabled. Check `streamnet config get indexers`.');
  }

  ctx.output.info(`Searching ${indexers.map((i) => i.id).join(', ')} for "${query}"…`);

  const raw = await aggregateSearch(query, indexers, { limit: input.limit ?? 25 });

  const minSeeders = input.minSeeders ?? ctx.config.minSeeders;
  let ranked = rankResults(raw, {
    minSeeders,
    preferredContainers: ctx.config.preferredContainers,
    preferredQuality: ctx.config.preferredQuality,
  });

  // Optional post-filters
  if (input.container) {
    const want = input.container.toLowerCase();
    ranked = ranked.filter((r) => (r.quality.container ?? '').toLowerCase() === want);
  }
  if (input.quality) {
    ranked = ranked.filter((r) => r.quality.resolution === input.quality);
  }

  if (ranked.length === 0) {
    fail(ExitCode.NO_RESULTS, `No results for "${query}" (min seeders: ${minSeeders}).`);
  }

  return { query, results: ranked, total: ranked.length };
}

export function renderSearch(data: SearchResult, _output: OutputContext): void {
  const W = { idx: 4, score: 6, seeders: 7, size: 9, title: 58 };
  const header =
    '#'.padEnd(W.idx) +
    'Score'.padStart(W.score) +
    ' ' +
    'Seeds'.padStart(W.seeders) +
    ' ' +
    'Size'.padStart(W.size) +
    '  ' +
    'Title';
  process.stdout.write(pc.dim(header) + '\n');
  process.stdout.write(pc.dim('─'.repeat(header.length)) + '\n');

  data.results.slice(0, 30).forEach((r, i) => {
    const idx = String(i + 1).padEnd(W.idx);
    const score = String(r.healthScore ?? 0).padStart(W.score);
    const seeds = String(r.seeders).padStart(W.seeders);
    const size = formatBytes(r.sizeBytes).padStart(W.size);
    const container = r.quality.container
      ? pc.cyan(`[${r.quality.container.toUpperCase()}]`)
      : '';
    const title = truncate(r.title, W.title);
    process.stdout.write(`${idx}${score} ${seeds} ${size}  ${container} ${title}\n`);
  });
}
