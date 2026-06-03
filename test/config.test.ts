import { describe, it, expect } from 'vitest';
import { getConfigValue, setConfigValue, redactConfig } from '../src/config/store.js';
import { defaultConfig } from '../src/config/schema.js';
import { StreamNetError } from '../src/agent/exit.js';

describe('config store', () => {
  it('reads dotted keys', () => {
    const cfg = defaultConfig();
    expect(getConfigValue(cfg, 'minSeeders')).toBe(3);
    expect(getConfigValue(cfg, 'indexers.enabled')).toContain('torrents-csv');
  });

  it('sets and coerces scalar values', () => {
    const cfg = defaultConfig();
    const updated = setConfigValue(cfg, 'minSeeders', '10');
    expect(updated.minSeeders).toBe(10);
  });

  it('coerces comma lists to arrays', () => {
    const cfg = defaultConfig();
    const updated = setConfigValue(cfg, 'preferredContainers', 'mkv,mp4,avi');
    expect(updated.preferredContainers).toEqual(['mkv', 'mp4', 'avi']);
  });

  it('rejects invalid values via schema', () => {
    const cfg = defaultConfig();
    expect(() => setConfigValue(cfg, 'minSeeders', '-5')).toThrow(StreamNetError);
  });

  it('redacts secrets', () => {
    const cfg = defaultConfig();
    cfg.opensubtitles.apiKey = 'super-secret';
    const redacted = redactConfig(cfg);
    expect(redacted.opensubtitles.apiKey).toBe('***');
    // original untouched
    expect(cfg.opensubtitles.apiKey).toBe('super-secret');
  });
});
