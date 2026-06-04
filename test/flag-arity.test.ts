import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { unwrappedTypeName } from '../src/registry/build.js';

/**
 * Regression guard: optional/default-wrapped flags must report their underlying
 * value type, not the wrapper. A previous bug classified every `ZodOptional` as
 * boolean, which made `--container <value>`, `--query`, `--out`, etc. swallow no
 * argument and pushed the value into positionals ("too many arguments").
 */
describe('unwrappedTypeName', () => {
  it('unwraps optional strings to ZodString (value-taking, not boolean)', () => {
    expect(unwrappedTypeName(z.string().optional())).toBe('ZodString');
  });

  it('unwraps default numbers to ZodNumber (so numeric coercion applies)', () => {
    expect(unwrappedTypeName(z.number().default(25))).toBe('ZodNumber');
    expect(unwrappedTypeName(z.number().optional())).toBe('ZodNumber');
  });

  it('keeps real booleans as ZodBoolean (value-less flags)', () => {
    expect(unwrappedTypeName(z.boolean())).toBe('ZodBoolean');
    expect(unwrappedTypeName(z.boolean().default(false))).toBe('ZodBoolean');
  });
});
