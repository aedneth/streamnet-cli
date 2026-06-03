import { describe, it, expect } from 'vitest';
import { scoreResult, rankResults } from '../src/core/health/rank.js';
import type { TorrentResult } from '../src/core/indexers/types.js';

function makeResult(over: Partial<TorrentResult>): TorrentResult {
  return {
    schemaVersion: 1,
    title: 'Test',
    indexer: 'test',
    seeders: 0,
    leechers: 0,
    sizeBytes: 0,
    quality: {},
    ...over,
  };
}

describe('scoreResult', () => {
  it('rewards higher seeder counts', () => {
    const low = scoreResult(makeResult({ seeders: 1 }));
    const high = scoreResult(makeResult({ seeders: 500 }));
    expect(high).toBeGreaterThan(low);
  });

  it('prefers MKV over MP4 over AVI (MKV-first)', () => {
    const mkv = scoreResult(makeResult({ seeders: 100, quality: { container: 'mkv' } }));
    const mp4 = scoreResult(makeResult({ seeders: 100, quality: { container: 'mp4' } }));
    const avi = scoreResult(makeResult({ seeders: 100, quality: { container: 'avi' } }));
    expect(mkv).toBeGreaterThan(mp4);
    expect(mp4).toBeGreaterThan(avi);
  });

  it('applies seeder/leecher ratio', () => {
    const healthy = scoreResult(makeResult({ seeders: 100, leechers: 0 }));
    const leechy = scoreResult(makeResult({ seeders: 100, leechers: 900 }));
    expect(healthy).toBeGreaterThan(leechy);
  });

  it('caps at 100', () => {
    const score = scoreResult(
      makeResult({
        seeders: 100000,
        leechers: 0,
        quality: {
          container: 'mkv',
          resolution: '1080p',
          source: 'BluRay',
          codec: 'x265',
        },
      }),
      { preferredContainers: ['mkv'], preferredQuality: ['1080p'] },
    );
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('rankResults', () => {
  it('sorts by health descending and filters below minSeeders', () => {
    const results = [
      makeResult({ title: 'A', seeders: 2 }),
      makeResult({ title: 'B', seeders: 500, quality: { container: 'mkv' } }),
      makeResult({ title: 'C', seeders: 50 }),
    ];
    const ranked = rankResults(results, { minSeeders: 5 });
    expect(ranked.map((r) => r.title)).toEqual(['B', 'C']); // A filtered out
    expect(ranked[0]!.healthScore).toBeGreaterThan(ranked[1]!.healthScore!);
  });

  it('attaches a healthScore to every result', () => {
    const ranked = rankResults([makeResult({ seeders: 10 })]);
    expect(ranked[0]!.healthScore).toBeTypeOf('number');
  });
});
