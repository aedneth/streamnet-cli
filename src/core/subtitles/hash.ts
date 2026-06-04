import { open, stat } from 'node:fs/promises';

/**
 * OpenSubtitles / VLSub "moviehash".
 *
 * The hash is a 64-bit value: the file size plus the 64-bit (little-endian)
 * checksum of the first 64 KiB and the last 64 KiB of the file, all summed with
 * unsigned 64-bit wraparound. It is the most reliable way to match a subtitle to
 * a video because it depends on the bytes, not a fuzzy title match.
 *
 * Reference: https://trac.opensubtitles.org/projects/opensubtitles/wiki/HashSourceCodes
 *
 * Implementation reads only the two 64 KiB windows, never the whole file, so it
 * is cheap even for multi-gigabyte videos.
 */
const CHUNK_SIZE = 64 * 1024; // 64 KiB
const U64_MASK = (1n << 64n) - 1n;

/** Minimum file size OpenSubtitles considers hashable (two non-overlapping chunks). */
export const MIN_HASHABLE_BYTES = 2 * CHUNK_SIZE;

/** Sum every little-endian uint64 in a buffer into `acc`, with uint64 wraparound. */
function sumQwords(buf: Buffer, acc: bigint): bigint {
  let sum = acc;
  // Only whole 8-byte words contribute (matches the reference implementation).
  const end = buf.length - (buf.length % 8);
  for (let i = 0; i < end; i += 8) {
    sum = (sum + buf.readBigUInt64LE(i)) & U64_MASK;
  }
  return sum;
}

/**
 * Compute the moviehash for a file on disk.
 *
 * @returns lowercase 16-char hex string (zero-padded).
 * @throws if the file is smaller than {@link MIN_HASHABLE_BYTES}; callers should
 *         fall back to a title/query search in that case.
 */
export async function movieHash(
  filePath: string,
): Promise<{ hash: string; size: number }> {
  const { size } = await stat(filePath);
  if (size < MIN_HASHABLE_BYTES) {
    throw new Error(
      `File too small to hash (${size} bytes; need >= ${MIN_HASHABLE_BYTES}).`,
    );
  }

  const fh = await open(filePath, 'r');
  try {
    let hash = BigInt(size) & U64_MASK;

    const head = Buffer.alloc(CHUNK_SIZE);
    await fh.read(head, 0, CHUNK_SIZE, 0);
    hash = sumQwords(head, hash);

    const tail = Buffer.alloc(CHUNK_SIZE);
    await fh.read(tail, 0, CHUNK_SIZE, size - CHUNK_SIZE);
    hash = sumQwords(tail, hash);

    return { hash: hash.toString(16).padStart(16, '0'), size };
  } finally {
    await fh.close();
  }
}
