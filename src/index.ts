// Public programmatic API — for agents that want to import streamnet as a library.
export { searchHandler } from './commands/search.js';
export { streamHandler } from './commands/stream.js';
export { playHandler } from './commands/play.js';
export { doctorHandler } from './commands/doctor.js';
export { setupHandler } from './commands/setup.js';
export { configHandler } from './commands/config.js';
export { manifestHandler, buildManifest } from './commands/manifest.js';

export { rankResults, scoreResult } from './core/health/rank.js';
export { parseQuality } from './core/health/quality.js';
export { aggregateSearch } from './core/indexers/aggregate.js';
export { getEnabledIndexers, listAllIndexers } from './core/indexers/registry.js';

export { OutputContext } from './agent/output.js';
export { ExitCode, StreamNetError, fail } from './agent/exit.js';
export { successEnvelope, errorEnvelope } from './agent/envelope.js';
export { loadConfig, saveConfig } from './config/store.js';
export { resolvePaths } from './config/paths.js';

export type { TorrentResult, Indexer } from './core/indexers/types.js';
export type { Config } from './config/schema.js';
export type { Envelope } from './agent/envelope.js';
export type { CommandSpec, CommandContext } from './registry/types.js';
