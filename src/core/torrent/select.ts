import type { TorrentFile } from '../indexers/types.js';
import { normaliseContainer } from '../health/quality.js';

const VIDEO_EXTS = new Set([
  'mkv',
  'mp4',
  'avi',
  'mov',
  'wmv',
  'flv',
  'webm',
  'm4v',
  'ts',
  'mpg',
  'mpeg',
]);

function isVideoFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTS.has(ext);
}

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Select the best video file from a torrent's file list.
 *
 * Priority:
 *   1. MKV files (usually have embedded subtitles)
 *   2. Largest video file (generally the main feature, not a sample)
 *
 * Returns the 0-based index into the files array.
 */
export function selectVideoFile(
  files: TorrentFile[],
  preferredContainers: string[] = ['mkv', 'mp4'],
): number {
  const videoFiles = files
    .map((f, idx) => ({ ...f, idx }))
    .filter((f) => isVideoFile(f.name));

  if (videoFiles.length === 0) return 0;

  // Apply container preference in order
  for (const container of preferredContainers.map(normaliseContainer)) {
    const matching = videoFiles.filter((f) => getExt(f.name) === container);
    if (matching.length > 0) {
      // Among matching container type, pick the largest
      return matching.sort((a, b) => b.sizeBytes - a.sizeBytes)[0]!.idx;
    }
  }

  // Fallback: largest video file regardless of container
  return videoFiles.sort((a, b) => b.sizeBytes - a.sizeBytes)[0]!.idx;
}

/** True if the selected file is an MKV (embedded subs likely — skip subtitle search). */
export function isMkv(fileName: string): boolean {
  return getExt(fileName) === 'mkv';
}
