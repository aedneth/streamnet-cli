import { describe, it, expect, vi, afterEach } from 'vitest';
import { join } from 'node:path';

// Mock the heavy optional dependency with a torrent that completes immediately.
vi.mock('webtorrent', () => {
  class FakeTorrent {
    name = 'Movie';
    files = [
      { name: 'sample.mp4', length: 50, path: 'Movie/sample.mp4' },
      { name: 'Movie.mp4', length: 5000, path: 'Movie/Movie.mp4' },
    ];
    progress = 1;
    numPeers = 7;
    downloadSpeed = 0;
    on(event: string, cb: () => void): void {
      if (event === 'done') setTimeout(cb, 0);
    }
  }
  class FakeClient {
    add(_src: string, _opts: { path?: string }, cb: (t: FakeTorrent) => void): void {
      cb(new FakeTorrent());
    }
    on(): void {}
    destroy(): void {}
  }
  return { default: FakeClient };
});

import { downloadTorrent } from '../src/core/torrent/engine.js';

afterEach(() => vi.restoreAllMocks());

describe('downloadTorrent', () => {
  it('selects the largest video file and resolves its on-disk path', async () => {
    const out = await downloadTorrent({
      source: 'magnet:?xt=urn:btih:abc',
      outDir: '/tmp/dl',
    });
    expect(out.fileName).toBe('Movie.mp4'); // larger than sample.mp4
    expect(out.sizeBytes).toBe(5000);
    expect(out.filePath).toBe(join('/tmp/dl', 'Movie/Movie.mp4'));
  });
});
