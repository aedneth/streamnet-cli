import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchSubtitles,
  downloadSubtitle,
  type OpenSubtitlesConfig,
} from '../src/core/subtitles/opensubtitles.js';
import { StreamNetError, ExitCode } from '../src/agent/exit.js';

const cfg: OpenSubtitlesConfig = { apiKey: 'test-key', languages: ['es', 'en'] };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('searchSubtitles', () => {
  it('ranks hash matches first, then language preference, then downloads', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: unknown) =>
      jsonResponse({
        data: [
          {
            attributes: {
              language: 'en',
              download_count: 999,
              moviehash_match: false,
              files: [{ file_id: 1, file_name: 'en-text.srt' }],
            },
          },
          {
            attributes: {
              language: 'en',
              download_count: 5,
              moviehash_match: true,
              files: [{ file_id: 2, file_name: 'en-hash.srt' }],
            },
          },
          {
            attributes: {
              language: 'es',
              download_count: 5,
              moviehash_match: true,
              files: [{ file_id: 3, file_name: 'es-hash.srt' }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await searchSubtitles(cfg, { moviehash: 'ABC123', query: 'movie' });
    // es-hash (hashMatch + preferred lang) → en-hash (hashMatch) → en-text
    expect(out.map((m) => m.fileId)).toEqual([3, 2, 1]);

    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toContain('moviehash=abc123');
    expect(calledUrl).toContain('languages=es%2Cen');
  });

  it('throws AUTH when no API key is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ data: [] })),
    );
    await expect(searchSubtitles({}, { query: 'x' })).rejects.toMatchObject({
      code: ExitCode.AUTH,
    });
  });

  it('throws AUTH on HTTP 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 401)),
    );
    const err = await searchSubtitles(cfg, { query: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(StreamNetError);
    expect((err as StreamNetError).code).toBe(ExitCode.AUTH);
  });
});

describe('downloadSubtitle', () => {
  it('resolves the download link then fetches the subtitle text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ link: 'https://cdn.example/sub.srt', file_name: 'movie.srt' }),
      )
      .mockResolvedValueOnce(jsonResponse('1\n00:00:01,000 --> 00:00:02,000\nHola\n'));
    vi.stubGlobal('fetch', fetchMock);

    const { content, fileName } = await downloadSubtitle(cfg, 42);
    expect(fileName).toBe('movie.srt');
    expect(content).toContain('Hola');

    // First call POSTs the file_id
    const firstInit = fetchMock.mock.calls[0]![1] as { method?: string; body?: unknown };
    expect(firstInit.method).toBe('POST');
    expect(String(firstInit.body)).toContain('"file_id":42');
  });
});
