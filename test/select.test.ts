import { describe, it, expect } from 'vitest';
import { selectVideoFile, isMkv } from '../src/core/torrent/select.js';

describe('selectVideoFile', () => {
  it('prefers MKV even when a larger MP4 exists', () => {
    const files = [
      { name: 'movie.mp4', sizeBytes: 2_000_000_000 },
      { name: 'movie.mkv', sizeBytes: 1_500_000_000 },
    ];
    expect(selectVideoFile(files, ['mkv', 'mp4'])).toBe(1);
  });

  it('picks the largest video when no preferred container present', () => {
    const files = [
      { name: 'sample.avi', sizeBytes: 50_000_000 },
      { name: 'feature.avi', sizeBytes: 1_200_000_000 },
    ];
    expect(selectVideoFile(files, ['mkv', 'mp4'])).toBe(1);
  });

  it('ignores non-video files', () => {
    const files = [
      { name: 'readme.txt', sizeBytes: 9_000_000_000 },
      { name: 'movie.mkv', sizeBytes: 1_000_000_000 },
    ];
    expect(selectVideoFile(files)).toBe(1);
  });

  it('falls back to index 0 when no video files', () => {
    const files = [{ name: 'a.txt', sizeBytes: 1 }];
    expect(selectVideoFile(files)).toBe(0);
  });
});

describe('isMkv', () => {
  it('detects mkv files', () => {
    expect(isMkv('movie.mkv')).toBe(true);
    expect(isMkv('movie.MKV')).toBe(true);
    expect(isMkv('movie.mp4')).toBe(false);
  });
});
