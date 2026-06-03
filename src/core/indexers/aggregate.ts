import pLimit from 'p-limit';
import type { Indexer, TorrentResult, IndexerSearchOptions } from './types.js';
import { logger } from '../../util/logger.js';

export interface AggregateOptions extends IndexerSearchOptions {
  /** Max indexers queried in parallel (default 3). */
  concurrency?: number;
}

export interface AggregateResult {
  results: TorrentResult[];
  /** Number of indexers that returned results. */
  succeededCount: number;
  /** Number of indexers that threw or rejected. */
  failedCount: number;
}

/**
 * Fan-out a search across multiple indexers in parallel, then merge and
 * de-duplicate results by infoHash (keeping the entry with more seeders).
 * Returns success/failure counts so callers can distinguish NO_RESULTS from
 * NETWORK (all indexers failed).
 */
export async function aggregateSearch(
  query: string,
  indexers: Indexer[],
  opts: AggregateOptions = {},
): Promise<AggregateResult> {
  const limit = pLimit(opts.concurrency ?? 3);

  const settled = await Promise.allSettled(
    indexers.map((idx) =>
      limit(() => {
        logger.debug(`[${idx.id}] searching "${query}"`);
        return idx.search(query, { limit: opts.limit, signal: opts.signal });
      }),
    ),
  );

  const all: TorrentResult[] = [];
  let failedCount = 0;
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    if (result.status === 'fulfilled') {
      logger.debug(`[${indexers[i]!.id}] returned ${result.value.length} results`);
      all.push(...result.value);
    } else {
      failedCount++;
      logger.warn(`[${indexers[i]!.id}] failed: ${String(result.reason)}`);
    }
  }

  return { results: dedupe(all), succeededCount: indexers.length - failedCount, failedCount };
}

/** Deduplicate by infoHash — keep the entry with more seeders. */
function dedupe(results: TorrentResult[]): TorrentResult[] {
  const map = new Map<string, TorrentResult>();
  for (const r of results) {
    const key = r.infoHash ?? r.title.toLowerCase();
    const existing = map.get(key);
    if (!existing || r.seeders > existing.seeders) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}
