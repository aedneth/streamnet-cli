import { load as cheerioLoad } from 'cheerio';
import { httpGetText } from '../../util/http.js';
import type { FetchOptions } from '../../util/http.js';
import { parseQuality } from '../health/quality.js';
import type { TorrentResult, TorrentQuality } from './types.js';
import { TORRENT_RESULT_SCHEMA_VERSION } from './types.js';

export { cheerioLoad, parseQuality };

/** Extract infoHash from a magnet link. */
export function infoHashFromMagnet(magnet: string): string | undefined {
  const m = magnet.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return m?.[1]?.toLowerCase();
}

/** Extract infoHash from various URL forms (detail URLs, announce lists…). */
export function infoHashFromUrl(url: string): string | undefined {
  const m = url.match(
    /(?:info_hash=|\/torrent\/|\/detail\/|torrent\/)([a-fA-F0-9]{40})/i,
  );
  return m?.[1]?.toLowerCase();
}

/** Build a well-formed TorrentResult from partial data. */
export function buildResult(
  partial: Omit<TorrentResult, 'schemaVersion' | 'quality'> & {
    title: string;
    rawTitle?: string;
  },
  indexer: string,
): TorrentResult {
  const { rawTitle, ...rest } = partial;
  const q: TorrentQuality = parseQuality(rawTitle ?? partial.title);
  return {
    ...rest,
    schemaVersion: TORRENT_RESULT_SCHEMA_VERSION,
    indexer: rest.indexer ?? indexer,
    quality: q,
  };
}

export async function fetchPage(
  url: string,
  opts?: FetchOptions,
): Promise<ReturnType<typeof cheerioLoad>> {
  const html = await httpGetText(url, opts);
  return cheerioLoad(html);
}
