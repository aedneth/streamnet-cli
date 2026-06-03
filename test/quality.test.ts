import { describe, it, expect } from 'vitest';
import { parseQuality, normaliseContainer } from '../src/core/health/quality.js';

describe('parseQuality', () => {
  it('extracts resolution', () => {
    expect(parseQuality('Movie 2049 1080p BluRay').resolution).toBe('1080p');
    expect(parseQuality('Movie 2160p UHD').resolution).toBe('2160p');
    expect(parseQuality('Movie 720p WEB-DL').resolution).toBe('720p');
  });

  it('extracts codec', () => {
    expect(parseQuality('Movie x265 HEVC').codec).toBe('x265');
    expect(parseQuality('Movie h.264').codec).toBe('x264');
  });

  it('extracts source', () => {
    expect(parseQuality('Movie BluRay').source).toBe('BluRay');
    expect(parseQuality('Movie WEB-DL').source).toBe('WEB-DL');
    expect(parseQuality('Movie HDTV').source).toBe('HDTV');
  });

  it('extracts container', () => {
    expect(parseQuality('Movie.1080p.mkv').container).toBe('mkv');
    expect(parseQuality('Movie.720p.mp4').container).toBe('mp4');
  });

  it('returns empty object when nothing matches', () => {
    expect(parseQuality('Some Random Title')).toEqual({});
  });
});

describe('normaliseContainer', () => {
  it('strips leading dot and lowercases', () => {
    expect(normaliseContainer('.MKV')).toBe('mkv');
    expect(normaliseContainer('MP4')).toBe('mp4');
  });
});
