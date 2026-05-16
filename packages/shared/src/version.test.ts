import { describe, expect, it } from 'vitest';
import {
  LATEST_VERSION,
  MIN_SUPPORTED_VERSION,
  SUPPORTED_VERSIONS,
  compareVersions,
  isCurrentVersion,
  isSupportedVersion,
} from './version.ts';

describe('version', () => {
  it('orders versions chronologically', () => {
    for (let i = 1; i < SUPPORTED_VERSIONS.length; i++) {
      expect(compareVersions(SUPPORTED_VERSIONS[i - 1]!, SUPPORTED_VERSIONS[i]!)).toBeLessThan(0);
    }
  });

  it('detects the latest as current', () => {
    expect(isCurrentVersion(LATEST_VERSION)).toBe(true);
    expect(isCurrentVersion(MIN_SUPPORTED_VERSION)).toBe(false);
  });

  it('type guards supported strings', () => {
    expect(isSupportedVersion(LATEST_VERSION)).toBe(true);
    expect(isSupportedVersion('1999-01-01')).toBe(false);
    expect(isSupportedVersion(42)).toBe(false);
  });
});
