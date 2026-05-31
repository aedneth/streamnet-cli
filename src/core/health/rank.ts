import type { TorrentResult } from '../indexers/types.js';

export interface RankOptions {
  preferredContainers?: string[];
  preferredQuality?: string[];
  minSeeders?: number;
}

const CONTAINER_BONUS: Record<string, number> = {
  mkv: 15, // MKV first — embedded subs, fewer subtitle lookups
  mp4: 8,
  avi: 2,
};

const RESOLUTION_BONUS: Record<string, number> = {
  '1080p': 12,
  '2160p': 10, // 4K is large — prefer 1080p slightly
  '720p': 6,
  '480p': 2,
};

const SOURCE_BONUS: Record<string, number> = {
  BluRay: 10,
  'WEB-DL': 8,
  WEBRip: 6,
  HDTV: 4,
  DVDRip: 2,
};

const CODEC_BONUS: Record<string, number> = {
  x265: 4,
  x264: 3,
};

/**
 * Score a torrent 0–100. Higher is healthier/more preferred.
 *
 * Weights:
 *   seeder count  (30 pts)  — primary health signal
 *   seeder ratio  (15 pts)  — liveness: seeders/(seeders+leechers)
 *   container     (15 pts)  — MKV beats MP4 beats AVI
 *   resolution    (12 pts)  — 1080p > 4K > 720p
 *   source        (10 pts)  — BluRay > WEB-DL > …
 *   codec          (4 pts)  — x265 > x264
 *   preferred Q   (+6 bonus if user-preferred quality matches)
 *   preferred C   (+8 bonus if user-preferred container matches)
 */
export function scoreResult(result: TorrentResult, opts: RankOptions = {}): number {
  let score = 0;

  // Seeder count (log-scaled, cap at 1000 → 30 pts)
  const seeders = Math.max(0, result.seeders);
  score += Math.min(30, (Math.log10(seeders + 1) / Math.log10(1001)) * 30);

  // Seeder/leecher ratio (15 pts)
  const total = seeders + Math.max(0, result.leechers);
  if (total > 0) {
    score += (seeders / total) * 15;
  }

  const c = (result.quality.container ?? '').toLowerCase();
  score += CONTAINER_BONUS[c] ?? 0;

  const res = result.quality.resolution ?? '';
  score += RESOLUTION_BONUS[res] ?? 0;

  const src = result.quality.source ?? '';
  score += SOURCE_BONUS[src] ?? 0;

  const codec = result.quality.codec ?? '';
  score += CODEC_BONUS[codec] ?? 0;

  // User preference bonuses
  const prefContainers = opts.preferredContainers?.map((x) => x.toLowerCase()) ?? [];
  if (prefContainers.length > 0 && prefContainers.includes(c)) {
    const idx = prefContainers.indexOf(c);
    score += 8 - idx * 2; // first preference gets full bonus
  }

  const prefQuality = opts.preferredQuality ?? [];
  if (prefQuality.length > 0 && prefQuality.includes(res)) {
    const idx = prefQuality.indexOf(res);
    score += 6 - idx;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Rank an array of results in-place, attaching healthScore and filtering out
 * those below minSeeders.
 */
export function rankResults(
  results: TorrentResult[],
  opts: RankOptions = {},
): TorrentResult[] {
  const min = opts.minSeeders ?? 0;
  return results
    .filter((r) => r.seeders >= min)
    .map((r) => ({ ...r, healthScore: scoreResult(r, opts) }))
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0));
}
