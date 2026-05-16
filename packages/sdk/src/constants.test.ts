import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_URL,
  DEFAULT_INITIAL_RETRY_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  MIN_VIEW_COLUMN_WIDTH,
} from './constants.ts';

describe('SDK constants', () => {
  it('match the @notionhq/client documented defaults exactly', () => {
    expect(DEFAULT_BASE_URL).toBe('https://api.notion.com');
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000);
    expect(DEFAULT_MAX_RETRIES).toBe(2);
    expect(DEFAULT_INITIAL_RETRY_DELAY_MS).toBe(1_000);
    expect(DEFAULT_MAX_RETRY_DELAY_MS).toBe(60_000);
    expect(MIN_VIEW_COLUMN_WIDTH).toBe(32);
  });
});
