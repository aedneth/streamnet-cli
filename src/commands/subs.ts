import { existsSync } from 'node:fs';
import type { CommandContext } from '../registry/types.js';
import type { OutputContext } from '../agent/output.js';
import { fetchSubtitle, osConfigFrom } from '../core/subtitles/fetch.js';
import { ExitCode, fail } from '../agent/exit.js';

export interface SubsInput {
  file: string;
  lang?: string;
  query?: string;
}

export interface SubsResult {
  subtitlePath: string;
  language: string;
  matchedByHash: boolean;
  source: string;
}

export async function subsHandler(
  ctx: CommandContext,
  input: SubsInput,
): Promise<SubsResult> {
  const file = input.file?.trim();
  if (!file) {
    fail(ExitCode.USAGE, '`subs` requires a video file path (or use --query).');
  }

  const isLocalFile = existsSync(file);
  if (!isLocalFile && !input.query) {
    fail(
      ExitCode.USAGE,
      `File not found: ${file}`,
      'Pass an existing video file, or use --query "Title Year" for a text search.',
    );
  }

  const languages = input.lang
    ? input.lang
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)
    : undefined;

  ctx.output.info(
    isLocalFile
      ? `Searching subtitles by file hash: ${file}`
      : `Searching subtitles: ${input.query}`,
  );

  const result = await fetchSubtitle({
    cfg: osConfigFrom(ctx.config),
    videoPath: isLocalFile ? file : undefined,
    query: input.query,
    languages,
  });

  return {
    subtitlePath: result.path,
    language: result.language,
    matchedByHash: result.matchedByHash,
    source: result.fileName,
  };
}

export function renderSubs(data: SubsResult, output: OutputContext): void {
  const how = data.matchedByHash ? 'hash match' : 'text match';
  output.success(`Subtitle (${data.language}, ${how}) → ${data.subtitlePath}`);
}
