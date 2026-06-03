import { z } from 'zod';
import { downloadsDir } from './paths.js';

export const CONFIG_SCHEMA_VERSION = 1 as const;

export const ConfigSchema = z.object({
  schemaVersion: z.literal(CONFIG_SCHEMA_VERSION).default(CONFIG_SCHEMA_VERSION),
  player: z.enum(['vlc']).default('vlc'),
  subtitleLanguages: z.array(z.string()).default(['en', 'es']),
  minSeeders: z.number().int().min(0).default(3),
  preferredQuality: z.array(z.string()).default(['1080p', '720p', '2160p']),
  /** Container preference order — drives MKV-first ranking and the subtitle skip. */
  preferredContainers: z.array(z.string()).default(['mkv', 'mp4']),
  indexers: z
    .object({
      enabled: z.array(z.string()).default(['torrents-csv', 'yts']),
      order: z.array(z.string()).default(['torrents-csv', 'yts']),
    })
    .default({ enabled: ['torrents-csv', 'yts'], order: ['torrents-csv', 'yts'] }),
  opensubtitles: z
    .object({
      apiKey: z.string().optional(),
      username: z.string().optional(),
    })
    .default({}),
  /** 0 = ephemeral OS-assigned port for the local stream server. */
  streamPort: z.number().int().min(0).max(65535).default(0),
  downloadDir: z.string().default(() => downloadsDir()),
  telemetry: z.literal(false).default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Keys whose values must be redacted in `config list` / `--json`. */
export const SECRET_PATHS = new Set(['opensubtitles.apiKey']);

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}
