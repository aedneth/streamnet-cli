import type { TorrentQuality } from '../indexers/types.js';

const RESOLUTIONS: [RegExp, string][] = [
  [/\b4k|2160p|uhd\b/i, '2160p'],
  [/\b1080p|1080i|fhd\b/i, '1080p'],
  [/\b720p|720i|hd\b/i, '720p'],
  [/\b480p\b/i, '480p'],
  [/\b360p\b/i, '360p'],
];

const CODECS: [RegExp, string][] = [
  [/\bx265|h\.?265|hevc\b/i, 'x265'],
  [/\bx264|h\.?264|avc\b/i, 'x264'],
  [/\bav1\b/i, 'AV1'],
  [/\bvp9\b/i, 'VP9'],
  [/\bxvid\b/i, 'XviD'],
  [/\bdivx\b/i, 'DivX'],
];

const SOURCES: [RegExp, string][] = [
  [/\bblu[-.]?ray|bluray|bd[-.]?rip|bdrip\b/i, 'BluRay'],
  [/\bweb[-.]?dl\b/i, 'WEB-DL'],
  [/\bweb[-.]?rip\b/i, 'WEBRip'],
  [/\bhd[-.]?tv\b/i, 'HDTV'],
  [/\bdvd[-.]?rip\b/i, 'DVDRip'],
  [/\bcam|ts\b/i, 'CAM'],
];

const CONTAINERS: [RegExp, string][] = [
  [/\.mkv\b/i, 'mkv'],
  [/\.mp4\b/i, 'mp4'],
  [/\.avi\b/i, 'avi'],
  [/\.mov\b/i, 'mov'],
  [/\.wmv\b/i, 'wmv'],
];

/** Parse quality signals from a torrent title string. */
export function parseQuality(title: string): TorrentQuality {
  const q: TorrentQuality = {};

  for (const [re, label] of RESOLUTIONS) {
    if (re.test(title)) {
      q.resolution = label;
      break;
    }
  }
  for (const [re, label] of CODECS) {
    if (re.test(title)) {
      q.codec = label;
      break;
    }
  }
  for (const [re, label] of SOURCES) {
    if (re.test(title)) {
      q.source = label;
      break;
    }
  }
  for (const [re, label] of CONTAINERS) {
    if (re.test(title)) {
      q.container = label;
      break;
    }
  }

  return q;
}

/** Normalise a container string to lower-case without the leading dot. */
export function normaliseContainer(raw: string): string {
  return raw.toLowerCase().replace(/^\./, '');
}
