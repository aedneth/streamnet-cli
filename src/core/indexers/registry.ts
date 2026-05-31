import type { Indexer } from './types.js';
import { torrentsCsvIndexer } from './torrents-csv.js';
import { ytsIndexer } from './yts.js';
import type { Config } from '../../config/schema.js';

const ALL_INDEXERS: Indexer[] = [torrentsCsvIndexer, ytsIndexer];

export function getEnabledIndexers(config: Config): Indexer[] {
  const { enabled, order } = config.indexers;
  const byId = new Map(ALL_INDEXERS.map((i) => [i.id, i]));
  // Follow user-configured order, filter to enabled set
  return order
    .filter((id) => enabled.includes(id))
    .map((id) => byId.get(id))
    .filter((i): i is Indexer => i !== undefined);
}

export function getIndexerById(id: string): Indexer | undefined {
  return ALL_INDEXERS.find((i) => i.id === id);
}

export function listAllIndexers(): Indexer[] {
  return [...ALL_INDEXERS];
}
