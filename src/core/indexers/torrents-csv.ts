import { httpGetJson } from '../../util/http.js';
import { buildResult } from './base.js';
import type { Indexer, TorrentResult, IndexerSearchOptions } from './types.js';

/** Base URL for the public torrents-csv API. Configurable via env for self-hosted installs. */
const BASE_URL = process.env.STREAMNET_TORRENTS_CSV_URL ?? 'https://torrents-csv.com';

interface TorrentsCsvItem {
  info_hash: string;
  name: string;
  size_bytes: number;
  seeders: number;
  leechers: number;
  completed?: number;
  created_unix?: number;
}

interface TorrentsCsvResponse {
  torrents?: TorrentsCsvItem[];
}

export const torrentsCsvIndexer: Indexer = {
  id: 'torrents-csv',
  displayName: 'Torrents CSV',

  async search(query: string, opts?: IndexerSearchOptions): Promise<TorrentResult[]> {
    const params = new URLSearchParams({ q: query, size: String(opts?.limit ?? 25) });
    const url = `${BASE_URL}/service/search?${params}`;
    const data = await httpGetJson<TorrentsCsvResponse>(url, {
      signal: opts?.signal,
      headers: { Accept: 'application/json' },
    });

    return (data.torrents ?? []).map((item) => {
      const magnet = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`;
      return buildResult(
        {
          infoHash: item.info_hash.toLowerCase(),
          magnet,
          title: item.name,
          indexer: 'torrents-csv',
          seeders: item.seeders ?? 0,
          leechers: item.leechers ?? 0,
          sizeBytes: item.size_bytes ?? 0,
          uploadedAt: item.created_unix
            ? new Date(item.created_unix * 1000).toISOString()
            : undefined,
        },
        'torrents-csv',
      );
    });
  },
};
