import { describe, it, expect, vi } from 'vitest';
import { aggregateSearch } from '../src/core/indexers/aggregate.js';
import { infoHashFromMagnet } from '../src/core/indexers/base.js';
import type { Indexer, TorrentResult } from '../src/core/indexers/types.js';

function fakeResult(infoHash: string, seeders: number, indexer: string): TorrentResult {
  return {
    schemaVersion: 1,
    infoHash,
    title: `Title ${infoHash}`,
    indexer,
    seeders,
    leechers: 0,
    sizeBytes: 1000,
    quality: {},
  };
}

describe('infoHashFromMagnet', () => {
  it('extracts a 40-char hex hash', () => {
    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=x';
    expect(infoHashFromMagnet(magnet)).toBe('0123456789abcdef0123456789abcdef01234567');
  });

  it('returns undefined for non-magnet', () => {
    expect(infoHashFromMagnet('not a magnet')).toBeUndefined();
  });
});

describe('aggregateSearch', () => {
  const idxA: Indexer = {
    id: 'a',
    displayName: 'A',
    search: vi.fn(async () => [
      fakeResult('hash1', 10, 'a'),
      fakeResult('hash2', 5, 'a'),
    ]),
  };
  const idxB: Indexer = {
    id: 'b',
    displayName: 'B',
    // hash1 duplicate with MORE seeders → should win the dedupe
    search: vi.fn(async () => [
      fakeResult('hash1', 50, 'b'),
      fakeResult('hash3', 7, 'b'),
    ]),
  };

  it('merges results from multiple indexers', async () => {
    const merged = await aggregateSearch('q', [idxA, idxB]);
    const hashes = merged.map((r) => r.infoHash).sort();
    expect(hashes).toEqual(['hash1', 'hash2', 'hash3']);
  });

  it('dedupes by infoHash keeping the higher seeder count', async () => {
    const merged = await aggregateSearch('q', [idxA, idxB]);
    const hash1 = merged.find((r) => r.infoHash === 'hash1');
    expect(hash1?.seeders).toBe(50);
    expect(hash1?.indexer).toBe('b');
  });

  it('tolerates a failing indexer', async () => {
    const broken: Indexer = {
      id: 'broken',
      displayName: 'Broken',
      search: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    const merged = await aggregateSearch('q', [idxA, broken]);
    expect(merged.length).toBe(2); // still got idxA's results
  });
});
