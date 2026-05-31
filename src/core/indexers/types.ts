export const TORRENT_RESULT_SCHEMA_VERSION = 1 as const;

export interface TorrentQuality {
  resolution?: string; // e.g. '1080p', '4K'
  codec?: string; // e.g. 'x264', 'x265', 'HEVC'
  source?: string; // e.g. 'BluRay', 'WEB-DL', 'HDTV'
  container?: string; // e.g. 'mkv', 'mp4', 'avi'
}

export interface TorrentFile {
  name: string;
  sizeBytes: number;
}

export interface TorrentResult {
  schemaVersion: typeof TORRENT_RESULT_SCHEMA_VERSION;
  infoHash?: string;
  magnet?: string;
  torrentUrl?: string;
  title: string;
  indexer: string;
  seeders: number;
  leechers: number;
  sizeBytes: number;
  quality: TorrentQuality;
  /** Composite 0–100 score computed by health/rank.ts — absent until ranking pass. */
  healthScore?: number;
  uploadedAt?: string;
  files?: TorrentFile[];
  /** Original detail page URL for scrapers that need a second request. */
  detailUrl?: string;
}

/**
 * An Indexer adapter fetches results for a query. Each adapter is responsible
 * for parsing its source into TorrentResults, including infoHash extraction and
 * quality parsing from the title (delegating to core/health/quality.ts).
 */
export interface Indexer {
  id: string;
  displayName: string;
  search(query: string, opts?: IndexerSearchOptions): Promise<TorrentResult[]>;
}

export interface IndexerSearchOptions {
  limit?: number;
  signal?: AbortSignal;
}
