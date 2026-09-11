import { describe, expect, it } from 'vitest';

/**
 * Guards the shim rather than the app: if `setImmediate` is back, React's scheduler will
 * queue through Node again and the run starts failing on an uncaught error that names no
 * test. That is a hard failure to trace from the symptom, so it is asserted directly.
 */
describe('the scheduler transport shim', () => {
  it('removes setImmediate before React can capture it', () => {
    expect(typeof (globalThis as { setImmediate?: unknown }).setImmediate).toBe('undefined');
  });

  it('leaves a MessageChannel for React to fall back to', () => {
    expect(typeof MessageChannel).toBe('function');
  });
});
