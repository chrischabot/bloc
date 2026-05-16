import { describe, expect, it } from 'vitest';
import { getCapturedSpans, resetCapturedSpans } from './assert-trace.ts';

describe('assert-trace helper module', () => {
  it('starts with an empty buffer after reset', () => {
    resetCapturedSpans();
    expect(getCapturedSpans()).toEqual([]);
  });
});
