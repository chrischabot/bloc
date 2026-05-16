import { describe, expect, it } from 'vitest';
import { isUnblocked, unblocked } from './matrix.ts';

describe('sdk-progressive matrix', () => {
  it('has every entry resolved to true or false', () => {
    for (const value of Object.values(unblocked)) {
      expect(typeof value).toBe('boolean');
    }
  });

  it('exposes isUnblocked', () => {
    expect(isUnblocked('blocks.retrieve')).toBe(true);
  });

  it('Phase 2/3/4/5 surface is unblocked', () => {
    expect(isUnblocked('blocks.children.append')).toBe(true);
    expect(isUnblocked('pages.create')).toBe(true);
    expect(isUnblocked('databases.query')).toBe(true);
    expect(isUnblocked('users.me')).toBe(true);
  });

  it('Phase 24 v3 surface is unblocked', () => {
    expect(isUnblocked('v3.loadPageChunk')).toBe(true);
    expect(isUnblocked('v3.submitTransaction')).toBe(true);
  });
});
