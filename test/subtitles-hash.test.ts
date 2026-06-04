import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { movieHash, MIN_HASHABLE_BYTES } from '../src/core/subtitles/hash.js';

const tmpDirs: string[] = [];

function makeFile(bytes: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'snhash-'));
  tmpDirs.push(dir);
  const p = join(dir, 'video.mp4');
  writeFileSync(p, bytes);
  return p;
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('movieHash', () => {
  it('hashes an all-zero 256 KiB file to size-only (known vector)', async () => {
    const buf = Buffer.alloc(256 * 1024); // all zeros → only file size contributes
    const { hash, size } = await movieHash(makeFile(buf));
    expect(size).toBe(262144);
    expect(hash).toBe('0000000000040000'); // 0x40000 == 262144
  });

  it('sums the first and last 64 KiB qwords with the file size', async () => {
    const buf = Buffer.alloc(MIN_HASHABLE_BYTES); // exactly 128 KiB
    buf.writeBigUInt64LE(1n, 0); // first qword of the head window
    buf.writeBigUInt64LE(2n, MIN_HASHABLE_BYTES - 8); // last qword of the tail window
    const { hash } = await movieHash(makeFile(buf));
    // 0x20000 (131072) + 1 + 2 == 0x20003
    expect(hash).toBe('0000000000020003');
  });

  it('throws for a file smaller than the minimum hashable size', async () => {
    const buf = Buffer.alloc(1024);
    await expect(movieHash(makeFile(buf))).rejects.toThrow(/too small/i);
  });
});
