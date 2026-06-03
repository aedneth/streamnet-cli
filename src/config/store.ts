import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { ExitCode, fail } from '../agent/exit.js';
import { configFile } from './paths.js';
import { ConfigSchema, type Config, defaultConfig, SECRET_PATHS } from './schema.js';

/**
 * Load config from disk, validating against the schema. A missing file yields
 * defaults (the CLI works zero-config). Invalid JSON or schema violations are a
 * hard CONFIG error so agents get a deterministic signal.
 */
export function loadConfig(override?: string): Config {
  const file = configFile(override);
  if (!existsSync(file)) {
    return defaultConfig();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(ExitCode.CONFIG, `Config file is not valid JSON: ${file}`, String(err));
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    fail(
      ExitCode.CONFIG,
      `Config file failed validation: ${file}`,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}

export function saveConfig(config: Config, override?: string): void {
  const file = configFile(override);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (err) {
    fail(ExitCode.CONFIG, `Could not write config file: ${file}`, String(err));
  }
}

/** Read a dotted key path from config (e.g. `opensubtitles.apiKey`). */
export function getConfigValue(config: Config, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, config);
}

/**
 * Set a dotted key path, coercing scalars/arrays from string input, then
 * re-validate the whole object so we never persist an invalid config.
 */
export function setConfigValue(config: Config, key: string, value: string): Config {
  const parts = key.split('.');
  for (const part of parts) {
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      fail(ExitCode.CONFIG, `Invalid config key segment: "${part}"`);
    }
  }
  const draft = structuredClone(config) as Record<string, unknown>;
  let cursor = draft;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof cursor[part] !== 'object' || cursor[part] === null) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = coerce(value);

  const parsed = ConfigSchema.safeParse(draft);
  if (!parsed.success) {
    fail(
      ExitCode.CONFIG,
      `Invalid value for "${key}"`,
      parsed.error.issues.map((iss) => iss.message).join('; '),
    );
  }
  return parsed.data;
}

function coerce(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.includes(',')) return value.split(',').map((s) => s.trim());
  return value;
}

/** Produce a config copy with secret values redacted for display. */
export function redactConfig(config: Config): Config {
  const copy = structuredClone(config) as Record<string, unknown>;
  for (const path of SECRET_PATHS) {
    const parts = path.split('.');
    let cursor = copy;
    let ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = cursor[parts[i]!];
      if (typeof next !== 'object' || next === null) {
        ok = false;
        break;
      }
      cursor = next as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1]!;
    if (ok && cursor[leaf] !== undefined) {
      cursor[leaf] = '***';
    }
  }
  return copy as unknown as Config;
}

/** Resolve the OpenSubtitles API key: env wins over config. */
export function resolveOpenSubtitlesKey(config: Config): string | undefined {
  return process.env.STREAMNET_OPENSUBTITLES_API_KEY ?? config.opensubtitles.apiKey;
}
