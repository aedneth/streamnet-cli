/**
 * Deterministic POSIX exit codes.
 *
 * These are part of the public, stable contract: agents and shell scripts branch
 * on them. They are surfaced in `streamnet manifest` and documented in the README.
 * Do not renumber existing codes — only append.
 */
export enum ExitCode {
  OK = 0,
  ERROR = 1,
  USAGE = 2,
  NO_RESULTS = 3,
  DEP_MISSING = 4,
  NETWORK = 5,
  TORRENT_UNPLAYABLE = 6,
  PLAYER_FAILED = 7,
  SUBS_NOT_FOUND = 8,
  CONFIG = 9,
  AUTH = 10,
  /** A prompt was required but the CLI is running non-interactively. */
  EX_NOINPUT = 77,
  SIGINT = 130,
}

export const EXIT_CODE_NAMES: Record<ExitCode, string> = {
  [ExitCode.OK]: 'OK',
  [ExitCode.ERROR]: 'ERROR',
  [ExitCode.USAGE]: 'USAGE',
  [ExitCode.NO_RESULTS]: 'NO_RESULTS',
  [ExitCode.DEP_MISSING]: 'DEP_MISSING',
  [ExitCode.NETWORK]: 'NETWORK',
  [ExitCode.TORRENT_UNPLAYABLE]: 'TORRENT_UNPLAYABLE',
  [ExitCode.PLAYER_FAILED]: 'PLAYER_FAILED',
  [ExitCode.SUBS_NOT_FOUND]: 'SUBS_NOT_FOUND',
  [ExitCode.CONFIG]: 'CONFIG',
  [ExitCode.AUTH]: 'AUTH',
  [ExitCode.EX_NOINPUT]: 'EX_NOINPUT',
  [ExitCode.SIGINT]: 'SIGINT',
};

export const EXIT_CODE_DESCRIPTIONS: Record<ExitCode, string> = {
  [ExitCode.OK]: 'Success.',
  [ExitCode.ERROR]: 'Generic or unexpected error.',
  [ExitCode.USAGE]: 'Invalid arguments or flags.',
  [ExitCode.NO_RESULTS]: 'Search returned no results.',
  [ExitCode.DEP_MISSING]: 'A required dependency (e.g. VLC) was not found.',
  [ExitCode.NETWORK]: 'An indexer, API, or network call failed.',
  [ExitCode.TORRENT_UNPLAYABLE]: 'No peers or torrent metadata timed out.',
  [ExitCode.PLAYER_FAILED]: 'The media player failed to spawn or exited with an error.',
  [ExitCode.SUBS_NOT_FOUND]: 'No matching subtitles were found.',
  [ExitCode.CONFIG]: 'Configuration is invalid or could not be written.',
  [ExitCode.AUTH]: 'Authentication failed or rate limit exceeded (OpenSubtitles).',
  [ExitCode.EX_NOINPUT]:
    'A prompt was required but the CLI is running non-interactively (pass the flag or --yes).',
  [ExitCode.SIGINT]: 'Interrupted by signal.',
};

/**
 * A typed, user-facing error that carries an exit code. Thrown by handlers and
 * caught at the top level, where it is rendered (human or JSON) and used as the
 * process exit code.
 */
export class StreamNetError extends Error {
  readonly code: ExitCode;
  readonly hint?: string;

  constructor(code: ExitCode, message: string, hint?: string) {
    super(message);
    this.name = 'StreamNetError';
    this.code = code;
    this.hint = hint;
  }
}

/** Convenience constructor mirroring the Go-style `fail(code, msg)` idiom. */
export function fail(code: ExitCode, message: string, hint?: string): never {
  throw new StreamNetError(code, message, hint);
}
