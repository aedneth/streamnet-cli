import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { ExitCode, fail } from '../../agent/exit.js';
import { movieHash } from './hash.js';
import {
  searchSubtitles,
  downloadSubtitle,
  type OpenSubtitlesConfig,
} from './opensubtitles.js';
import { logger } from '../../util/logger.js';

export interface FetchSubtitleOptions {
  cfg: OpenSubtitlesConfig;
  /** Local video path — when present (and large enough) a moviehash search is used. */
  videoPath?: string;
  /** Text query — used as a fallback, or as the primary signal for live streams. */
  query?: string;
  languages?: string[];
  /** Directory to write the .srt into. Defaults to the video's directory or cwd. */
  outDir?: string;
}

export interface FetchedSubtitle {
  path: string;
  language: string;
  fileName: string;
  matchedByHash: boolean;
}

/** Strip extension and common scene/torrent noise to make a usable text query. */
export function queryFromFileName(name: string): string {
  return basename(name, extname(name))
    .replace(/[._]+/g, ' ')
    .replace(
      /\b(1080p|720p|2160p|4k|x264|x265|hevc|web-?dl|bluray|hdtv|aac|ac3)\b/gi,
      ' ',
    )
    .replace(/[[(].*?[\])]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Locate and download the best subtitle, writing it next to the video as
 * `<base>.<lang>.srt` (a path VLC auto-discovers). Prefers a moviehash match on
 * the local file and falls back to a text query.
 *
 * @throws SUBS_NOT_FOUND when nothing matches; AUTH when the key is missing/rejected.
 */
export async function fetchSubtitle(
  opts: FetchSubtitleOptions,
): Promise<FetchedSubtitle> {
  let moviehash: string | undefined;
  if (opts.videoPath && existsSync(opts.videoPath)) {
    try {
      moviehash = (await movieHash(opts.videoPath)).hash;
    } catch (err) {
      // File too small or unreadable — fall back to the text query.
      logger.debug(`moviehash skipped: ${String(err)}`);
    }
  }

  const query =
    opts.query ?? (opts.videoPath ? queryFromFileName(opts.videoPath) : undefined);

  if (!moviehash && !query) {
    fail(ExitCode.USAGE, 'Subtitle search needs a local file or a --query.');
  }

  const matches = await searchSubtitles(opts.cfg, {
    moviehash,
    query,
    languages: opts.languages,
  });

  if (matches.length === 0) {
    fail(
      ExitCode.SUBS_NOT_FOUND,
      `No subtitles found${query ? ` for "${query}"` : ''}.`,
      'Try a different --lang, or pass --query with the exact title and year.',
    );
  }

  const best = matches[0]!;
  const { content, fileName } = await downloadSubtitle(opts.cfg, best.fileId);

  const outDir =
    opts.outDir ?? (opts.videoPath ? dirname(opts.videoPath) : process.cwd());
  const base = opts.videoPath
    ? basename(opts.videoPath, extname(opts.videoPath))
    : basename(fileName, extname(fileName));
  const outPath = join(outDir, `${base}.${best.language}.srt`);

  await writeFile(outPath, content, 'utf8');

  return {
    path: outPath,
    language: best.language,
    fileName,
    matchedByHash: best.hashMatch,
  };
}

/** Build the OpenSubtitles client config from the resolved app config. */
export function osConfigFrom(config: {
  opensubtitles: { apiKey?: string };
  subtitleLanguages: string[];
}): OpenSubtitlesConfig {
  return {
    apiKey: config.opensubtitles.apiKey,
    languages: config.subtitleLanguages,
  };
}
