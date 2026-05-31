import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { logFile } from '../config/paths.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let _level: LogLevel = 'info';
let _logPath: string | null = null;
let _initialized = false;

export function setLogLevel(level: LogLevel): void {
  _level = level;
}

export function initFileLog(): void {
  if (_initialized) return;
  _logPath = logFile();
  try {
    mkdirSync(dirname(_logPath), { recursive: true });
  } catch {
    _logPath = null;
  }
  _initialized = true;
}

function write(level: LogLevel, message: string): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[_level]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  if (_logPath) {
    try {
      appendFileSync(_logPath, line);
    } catch {
      // file log failure is non-fatal
    }
  }
}

export const logger = {
  debug: (msg: string) => write('debug', msg),
  info: (msg: string) => write('info', msg),
  warn: (msg: string) => write('warn', msg),
  error: (msg: string) => write('error', msg),
};
