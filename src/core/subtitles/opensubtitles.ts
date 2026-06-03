import { ExitCode, StreamNetError, fail } from '../../agent/exit.js';

/**
 * Minimal OpenSubtitles REST v1 client.
 *
 * Only the two endpoints StreamNet needs: subtitle search (by moviehash or text)
 * and download-link resolution. Auth is an Api-Key header — never hardcoded, it
 * comes from `config.opensubtitles.apiKey`. The base URL is overridable via
 * STREAMNET_OPENSUBTITLES_URL so tests can point at a mock.
 *
 * API docs: https://opensubtitles.stoplight.io/docs/opensubtitles-api
 */
const BASE_URL =
  process.env.STREAMNET_OPENSUBTITLES_URL ?? 'https://api.opensubtitles.com/api/v1';
const DEFAULT_UA = 'streamnet-cli/1.0';

export interface OpenSubtitlesConfig {
  apiKey?: string;
  /** Language preference order, e.g. ['es', 'en']. */
  languages?: string[];
  userAgent?: string;
}

export interface SubtitleMatch {
  fileId: number;
  fileName: string;
  language: string;
  /** True when the result matched by file hash rather than text — far more reliable. */
  hashMatch: boolean;
  downloadCount: number;
  release?: string;
}

export interface SubtitleSearchParams {
  moviehash?: string;
  query?: string;
  /** Overrides the config language preference for this call. */
  languages?: string[];
}

interface OsFile {
  file_id: number;
  file_name?: string;
}
interface OsAttributes {
  language?: string;
  download_count?: number;
  moviehash_match?: boolean;
  release?: string;
  files?: OsFile[];
}
interface OsSearchResponse {
  data?: { attributes?: OsAttributes }[];
}
interface OsDownloadResponse {
  link?: string;
  file_name?: string;
}

function headers(cfg: OpenSubtitlesConfig, json = false): Record<string, string> {
  if (!cfg.apiKey) {
    fail(
      ExitCode.AUTH,
      'OpenSubtitles API key not configured.',
      'Get a free key at https://www.opensubtitles.com/consumers and run: streamnet config set opensubtitles.apiKey <key>',
    );
  }
  const h: Record<string, string> = {
    'Api-Key': cfg.apiKey,
    'User-Agent': cfg.userAgent ?? DEFAULT_UA,
    Accept: 'application/json',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/** The init type of the global fetch, avoiding a direct reference to the DOM lib name. */
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

async function osFetch(url: string, init: FetchInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof StreamNetError) throw err;
    fail(ExitCode.NETWORK, `OpenSubtitles request failed: ${String(err)}`);
  }
  if (res.status === 401 || res.status === 403) {
    fail(ExitCode.AUTH, `OpenSubtitles rejected the API key (HTTP ${res.status}).`);
  }
  if (res.status === 429) {
    fail(ExitCode.AUTH, 'OpenSubtitles rate limit exceeded. Try again later.');
  }
  if (!res.ok) {
    fail(ExitCode.NETWORK, `OpenSubtitles HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Search for subtitles by moviehash and/or text query. Results are sorted so the
 * best candidate is first: hash matches beat text matches, then by the caller's
 * language preference, then by download count.
 */
export async function searchSubtitles(
  cfg: OpenSubtitlesConfig,
  params: SubtitleSearchParams,
): Promise<SubtitleMatch[]> {
  const langs = (params.languages ?? cfg.languages ?? ['en']).map((l) => l.toLowerCase());
  const qp = new URLSearchParams();
  if (params.moviehash) qp.set('moviehash', params.moviehash.toLowerCase());
  if (params.query) qp.set('query', params.query);
  if (langs.length) qp.set('languages', langs.join(','));

  const body = (await osFetch(`${BASE_URL}/subtitles?${qp.toString()}`, {
    method: 'GET',
    headers: headers(cfg),
  })) as OsSearchResponse;

  const matches: SubtitleMatch[] = [];
  for (const entry of body.data ?? []) {
    const a = entry.attributes ?? {};
    const file = a.files?.[0];
    if (!file?.file_id) continue;
    matches.push({
      fileId: file.file_id,
      fileName: file.file_name ?? `${params.query ?? 'subtitle'}.srt`,
      language: (a.language ?? 'unknown').toLowerCase(),
      hashMatch: Boolean(a.moviehash_match),
      downloadCount: a.download_count ?? 0,
      release: a.release,
    });
  }

  const langRank = (l: string): number => {
    const i = langs.indexOf(l);
    return i === -1 ? langs.length : i;
  };
  matches.sort((x, y) => {
    if (x.hashMatch !== y.hashMatch) return x.hashMatch ? -1 : 1;
    const lr = langRank(x.language) - langRank(y.language);
    if (lr !== 0) return lr;
    return y.downloadCount - x.downloadCount;
  });

  return matches;
}

/**
 * Resolve a download link for a subtitle file and fetch its contents. Returns the
 * raw subtitle text plus the server-provided filename.
 */
export async function downloadSubtitle(
  cfg: OpenSubtitlesConfig,
  fileId: number,
): Promise<{ content: string; fileName: string }> {
  const dl = (await osFetch(`${BASE_URL}/download`, {
    method: 'POST',
    headers: headers(cfg, true),
    body: JSON.stringify({ file_id: fileId }),
  })) as OsDownloadResponse;

  if (!dl.link) {
    fail(ExitCode.SUBS_NOT_FOUND, 'OpenSubtitles did not return a download link.');
  }

  let res: Response;
  try {
    res = await fetch(dl.link);
  } catch (err) {
    fail(ExitCode.NETWORK, `Failed to download subtitle file: ${String(err)}`);
  }
  if (!res.ok) {
    fail(ExitCode.NETWORK, `Subtitle download failed (HTTP ${res.status}).`);
  }
  return {
    content: await res.text(),
    fileName: dl.file_name ?? `subtitle-${fileId}.srt`,
  };
}
