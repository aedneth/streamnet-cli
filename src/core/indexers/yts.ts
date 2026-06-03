import { httpGetJson } from '../../util/http.js';
import { buildResult } from './base.js';
import type { Indexer, TorrentResult, IndexerSearchOptions } from './types.js';

const BASE_URL = process.env.STREAMNET_YTS_URL ?? 'https://yts.mx/api/v2';

interface YtsTorrent {
  hash: string;
  quality: string;
  type: string;
  seeds: number;
  peers: number;
  size_bytes: number;
}

interface YtsMovie {
  title: string;
  year: number;
  torrents?: YtsTorrent[];
}

interface YtsData {
  movies?: YtsMovie[];
}

interface YtsResponse {
  data?: YtsData;
}

export const ytsIndexer: Indexer = {
  id: 'yts',
  displayName: 'YTS',

  async search(query: string, opts?: IndexerSearchOptions): Promise<TorrentResult[]> {
    const params = new URLSearchParams({
      query_term: query,
      limit: String(opts?.limit ?? 20),
      sort_by: 'seeds',
      order_by: 'desc',
    });
    const url = `${BASE_URL}/list_movies.json?${params}`;
    const data = await httpGetJson<YtsResponse>(url, { signal: opts?.signal });

    const results: TorrentResult[] = [];
    for (const movie of data.data?.movies ?? []) {
      for (const t of movie.torrents ?? []) {
        const title = `${movie.title} (${movie.year}) [${t.quality}] [${t.type}]`;
        const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(title)}`;
        results.push(
          buildResult(
            {
              infoHash: t.hash.toLowerCase(),
              magnet,
              title,
              indexer: 'yts',
              seeders: t.seeds ?? 0,
              leechers: t.peers ?? 0,
              sizeBytes: t.size_bytes ?? 0,
            },
            'yts',
          ),
        );
      }
    }
    return results;
  },
};
