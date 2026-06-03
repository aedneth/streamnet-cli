import { ExitCode, fail } from '../agent/exit.js';

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Thin fetch wrapper with timeout + a browser-like User-Agent so indexer sites
 * don't reject the request. All HTTP errors surface as NETWORK StreamNetErrors.
 */
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Merge caller signal so external cancellation also works.
  const signal = opts.signal
    ? anySignal([controller.signal, opts.signal])
    : controller.signal;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...opts.headers,
      },
    });
    if (!res.ok) {
      fail(ExitCode.NETWORK, `HTTP ${res.status} from ${url}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      fail(ExitCode.NETWORK, `Request timed out after ${timeout}ms: ${url}`);
    }
    fail(ExitCode.NETWORK, `Network error fetching ${url}: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGetJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await httpGet(url, {
    ...opts,
    headers: { Accept: 'application/json', ...opts.headers },
  });
  return res.json() as Promise<T>;
}

export async function httpGetText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await httpGet(url, opts);
  return res.text();
}

/** Combine multiple AbortSignals — aborts as soon as any one fires. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      ctrl.abort();
      break;
    }
    sig.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}
