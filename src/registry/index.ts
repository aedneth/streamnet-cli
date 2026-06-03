import { z } from 'zod';
import { ExitCode } from '../agent/exit.js';
import type { CommandSpec } from './types.js';
import { searchHandler, renderSearch } from '../commands/search.js';
import { streamHandler, renderStream } from '../commands/stream.js';
import { playHandler, renderPlay } from '../commands/play.js';
import { setupHandler } from '../commands/setup.js';
import { doctorHandler, renderDoctor, type DoctorResult } from '../commands/doctor.js';
import { configHandler, renderConfig } from '../commands/config.js';
import { subsHandler, renderSubs } from '../commands/subs.js';
import { downloadHandler, renderDownload } from '../commands/download.js';

const COMMON_EXIT_CODES = [
  { code: ExitCode.OK, meaning: 'Success' },
  { code: ExitCode.ERROR, meaning: 'Unexpected error' },
  { code: ExitCode.USAGE, meaning: 'Invalid arguments or flags' },
  {
    code: ExitCode.EX_NOINPUT,
    meaning: 'Prompt required but non-interactive; pass the flag',
  },
];

export const COMMAND_SPECS: CommandSpec[] = [
  {
    id: 'search',
    summary: 'Search indexers and show health-ranked torrent results.',
    args: [{ name: 'query', description: 'Title to search for', required: true }],
    flags: [
      {
        long: 'limit',
        description: 'Max results per indexer',
        schema: z.number(),
        default: 25,
      },
      {
        long: 'indexer',
        description: 'Restrict to a single indexer ID',
        schema: z.string().optional(),
      },
      {
        long: 'min-seeders',
        description: 'Minimum seeder count',
        schema: z.number(),
        default: 3,
        env: 'STREAMNET_MIN_SEEDERS',
      },
      {
        long: 'quality',
        description: 'Filter by quality label (e.g. 1080p)',
        schema: z.string().optional(),
      },
      {
        long: 'container',
        description: 'Filter by container (e.g. mkv)',
        schema: z.string().optional(),
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.NO_RESULTS, meaning: 'Search returned no results' },
      { code: ExitCode.NETWORK, meaning: 'All indexers failed' },
    ],
    examples: [
      'streamnet search "Blade Runner 2049"',
      'streamnet search "Blade Runner 2049" --json',
      'streamnet search "Blade Runner 2049" --container mkv --min-seeders 10',
    ],
    handler: searchHandler as unknown as CommandSpec['handler'],
    render: renderSearch as unknown as CommandSpec['render'],
  },

  {
    id: 'stream',
    summary: 'Stream a torrent (magnet/URL/infohash) to native VLC.',
    args: [
      {
        name: 'source',
        description: 'Magnet link, .torrent URL, or infohash. Use - to read from stdin.',
        required: true,
      },
    ],
    flags: [
      {
        long: 'file-index',
        description: 'Force a specific file index within the torrent',
        schema: z.number().optional(),
      },
      {
        long: 'port',
        description: 'Local stream server port (0=ephemeral)',
        schema: z.number(),
        default: 0,
      },
      {
        long: 'no-subs',
        description: 'Skip subtitle search/load',
        schema: z.boolean(),
        default: false,
      },
      {
        long: 'sub-lang',
        description: 'Subtitle language code (e.g. en, es)',
        schema: z.string().optional(),
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.DEP_MISSING, meaning: 'VLC or webtorrent not found' },
      { code: ExitCode.TORRENT_UNPLAYABLE, meaning: 'No peers / metadata timeout' },
      { code: ExitCode.PLAYER_FAILED, meaning: 'VLC failed to launch or crashed' },
    ],
    examples: [
      'streamnet stream "magnet:?xt=urn:btih:..."',
      'echo "$MAGNET" | streamnet stream -',
      'streamnet stream "magnet:?xt=urn:btih:..." --no-subs --json',
    ],
    handler: streamHandler as unknown as CommandSpec['handler'],
    render: renderStream as unknown as CommandSpec['render'],
  },

  {
    id: 'play',
    summary: 'One-shot: search → select best torrent → stream to VLC.',
    description:
      'Combines `search` and `stream`. With --yes (or non-interactive / agent mode) ' +
      'the top-ranked result is selected automatically.',
    args: [{ name: 'query', description: 'Title to search and play', required: true }],
    flags: [
      {
        long: 'yes',
        short: 'y',
        description: 'Auto-select top result without prompting',
        schema: z.boolean(),
        default: false,
        env: 'STREAMNET_YES',
      },
      {
        long: 'quality',
        description: 'Preferred quality label (e.g. 1080p)',
        schema: z.string().optional(),
      },
      {
        long: 'container',
        description: 'Preferred container (e.g. mkv)',
        schema: z.string().optional(),
      },
      {
        long: 'min-seeders',
        description: 'Minimum seeder count',
        schema: z.number(),
        default: 3,
      },
      {
        long: 'no-subs',
        description: 'Skip subtitle search/load',
        schema: z.boolean(),
        default: false,
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.NO_RESULTS, meaning: 'No results for the query' },
      { code: ExitCode.DEP_MISSING, meaning: 'VLC not found' },
      { code: ExitCode.TORRENT_UNPLAYABLE, meaning: 'No peers / metadata timeout' },
      { code: ExitCode.PLAYER_FAILED, meaning: 'VLC failed' },
    ],
    examples: [
      'streamnet play "Blade Runner 2049"',
      'streamnet play "Blade Runner 2049" --yes',
      'streamnet play "Blade Runner 2049" --yes --json',
    ],
    handler: playHandler as unknown as CommandSpec['handler'],
    render: renderPlay as unknown as CommandSpec['render'],
  },

  {
    id: 'setup',
    summary: 'Install native VLC for the current OS (no Flatpak/Snap).',
    flags: [
      {
        long: 'yes',
        short: 'y',
        description: 'Skip confirmation prompt',
        schema: z.boolean(),
        default: false,
        env: 'STREAMNET_YES',
      },
      {
        long: 'check',
        description: 'Check only, do not install',
        schema: z.boolean(),
        default: false,
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      {
        code: ExitCode.DEP_MISSING,
        meaning: 'Install command failed or unsupported platform',
      },
    ],
    examples: [
      'streamnet setup',
      'streamnet setup --yes',
      'streamnet setup --check --json',
    ],
    handler: setupHandler as unknown as CommandSpec['handler'],
  },

  {
    id: 'doctor',
    summary: 'Verify all dependencies (VLC, webtorrent, Node, network).',
    exitCodes: [
      { code: ExitCode.OK, meaning: 'All checks passed' },
      { code: ExitCode.ERROR, meaning: 'One or more checks failed' },
    ],
    examples: ['streamnet doctor', 'streamnet doctor --json'],
    handler: doctorHandler as unknown as CommandSpec['handler'],
    render: renderDoctor as unknown as CommandSpec['render'],
    exitCodeFor: ((data: DoctorResult) =>
      data.allOk ? ExitCode.OK : ExitCode.ERROR) as unknown as CommandSpec['exitCodeFor'],
  },

  {
    id: 'config',
    summary: 'Read or write configuration (get|set|list|path).',
    args: [
      { name: 'subcommand', description: 'get | set | list | path', required: true },
      {
        name: 'key',
        description: 'Dotted config key (e.g. opensubtitles.apiKey)',
        required: false,
      },
      { name: 'value', description: 'Value to set', required: false },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.CONFIG, meaning: 'Invalid key or unwritable config file' },
    ],
    examples: [
      'streamnet config list',
      'streamnet config get minSeeders',
      'streamnet config set minSeeders 5',
      'streamnet config path',
    ],
    handler: configHandler as unknown as CommandSpec['handler'],
    render: renderConfig as unknown as CommandSpec['render'],
  },

  {
    id: 'subs',
    summary: 'Find and download subtitles for a local video (by file hash).',
    description:
      'Computes the OpenSubtitles/VLSub moviehash of a local file and downloads the ' +
      'best matching subtitle as `<name>.<lang>.srt` beside it. Falls back to a text ' +
      'query. Requires an OpenSubtitles API key in config.',
    args: [
      {
        name: 'file',
        description: 'Path to a local video file (or any path when using --query)',
        required: true,
      },
    ],
    flags: [
      {
        long: 'lang',
        description: 'Comma-separated language codes, preference order (e.g. es,en)',
        schema: z.string().optional(),
      },
      {
        long: 'query',
        description: 'Force a text search (Title Year) instead of/after a hash match',
        schema: z.string().optional(),
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.SUBS_NOT_FOUND, meaning: 'No matching subtitles found' },
      { code: ExitCode.AUTH, meaning: 'OpenSubtitles API key missing/rejected' },
      { code: ExitCode.NETWORK, meaning: 'OpenSubtitles unreachable' },
    ],
    examples: [
      'streamnet subs ~/Videos/Movie.mp4',
      'streamnet subs ~/Videos/Movie.mp4 --lang es,en',
      'streamnet subs movie --query "Dune Part Two 2024" --json',
    ],
    handler: subsHandler as unknown as CommandSpec['handler'],
    render: renderSubs as unknown as CommandSpec['render'],
  },

  {
    id: 'download',
    summary: 'Download a torrent to disk (with subtitle auto-fetch for non-MKV).',
    description:
      'Full download to the configured download directory, with progress. On ' +
      'completion, non-MKV files trigger a subtitle search automatically (unless --no-subs).',
    args: [
      {
        name: 'source',
        description: 'Magnet link, .torrent URL, or infohash. Use - to read from stdin.',
        required: true,
      },
    ],
    flags: [
      {
        long: 'out',
        description: 'Output directory (overrides config.downloadDir)',
        schema: z.string().optional(),
      },
      {
        long: 'file-index',
        description: 'Force a specific file index within the torrent',
        schema: z.number().optional(),
      },
      {
        long: 'no-subs',
        description: 'Skip the post-download subtitle search',
        schema: z.boolean(),
        default: false,
      },
    ],
    exitCodes: [
      ...COMMON_EXIT_CODES,
      { code: ExitCode.DEP_MISSING, meaning: 'webtorrent not installed' },
      { code: ExitCode.TORRENT_UNPLAYABLE, meaning: 'No peers / metadata timeout' },
      { code: ExitCode.NETWORK, meaning: 'Write failure or download error' },
    ],
    examples: [
      'streamnet download "magnet:?xt=urn:btih:..."',
      'streamnet download "magnet:?xt=urn:btih:..." --out ~/Videos --json',
    ],
    handler: downloadHandler as unknown as CommandSpec['handler'],
    render: renderDownload as unknown as CommandSpec['render'],
  },

  {
    id: 'manifest',
    summary: 'Emit the machine-readable command manifest (agent discovery).',
    description:
      'Prints the full catalog of commands, flags, exit codes, and JSON schemas as ' +
      'a single JSON object. Agents use this to enumerate and call commands without ' +
      'bespoke glue. Analogous to `gh api` / `vercel --help --json`.',
    exitCodes: [{ code: ExitCode.OK, meaning: 'Manifest emitted on stdout' }],
    examples: ['streamnet manifest', 'streamnet manifest | jq .commands[].id'],
    // handler is wired specially in cli.ts because it needs access to all specs
    handler: async () => ({ placeholder: true }),
  },
];
