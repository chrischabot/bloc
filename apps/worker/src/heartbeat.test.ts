import { describe, expect, it } from 'vitest';

describe('worker package', () => {
  it('is importable as a Node module', () => {
    expect(typeof process.uptime()).toBe('number');
  });
});
