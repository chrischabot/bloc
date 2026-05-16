import { describe, expect, it } from 'vitest';
import {
  PROPERTY_CONFIGS,
  PROPERTY_TYPES,
  PROPERTY_VALUE_PAYLOADS,
  PropertyValueInputSchema,
  isPropertyType,
  isReadonlyPropertyType,
} from './index.ts';

describe('properties catalogue', () => {
  it('exposes 23 property types (Notion superset)', () => {
    expect(PROPERTY_TYPES.length).toBeGreaterThanOrEqual(23);
  });

  it('every type has a config and a value-payload entry', () => {
    for (const t of PROPERTY_TYPES) {
      expect(PROPERTY_CONFIGS[t]).toBeDefined();
      expect(PROPERTY_VALUE_PAYLOADS[t]).toBeDefined();
    }
  });

  it('isPropertyType narrows', () => {
    expect(isPropertyType('title')).toBe(true);
    expect(isPropertyType('not_a_property')).toBe(false);
  });

  it('classifies read-only property types', () => {
    expect(isReadonlyPropertyType('formula')).toBe(true);
    expect(isReadonlyPropertyType('rollup')).toBe(true);
    expect(isReadonlyPropertyType('created_time')).toBe(true);
    expect(isReadonlyPropertyType('title')).toBe(false);
    expect(isReadonlyPropertyType('number')).toBe(false);
  });
});

describe('title value', () => {
  it('accepts a rich-text array', () => {
    const result = PropertyValueInputSchema('title').safeParse({
      title: [{ type: 'text', text: { content: 'Hello', link: null } }],
    });
    expect(result.success).toBe(true);
  });
});

describe('number value', () => {
  it('accepts a number', () => {
    const result = PropertyValueInputSchema('number').safeParse({ number: 3.14 });
    expect(result.success).toBe(true);
  });

  it('accepts null', () => {
    const result = PropertyValueInputSchema('number').safeParse({ number: null });
    expect(result.success).toBe(true);
  });

  it('rejects a string', () => {
    const result = PropertyValueInputSchema('number').safeParse({ number: 'not a number' });
    expect(result.success).toBe(false);
  });
});

describe('select value', () => {
  it('accepts an option name', () => {
    const result = PropertyValueInputSchema('select').safeParse({
      select: { name: 'High', color: 'red' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts null', () => {
    const result = PropertyValueInputSchema('select').safeParse({ select: null });
    expect(result.success).toBe(true);
  });
});

describe('multi_select value', () => {
  it('accepts an array of options', () => {
    const result = PropertyValueInputSchema('multi_select').safeParse({
      multi_select: [{ name: 'A' }, { name: 'B', color: 'blue' }],
    });
    expect(result.success).toBe(true);
  });
});

describe('date value', () => {
  it('accepts a start-only date', () => {
    const result = PropertyValueInputSchema('date').safeParse({
      date: { start: '2026-05-15' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a date range with time-zone', () => {
    const result = PropertyValueInputSchema('date').safeParse({
      date: {
        start: '2026-05-15T09:00:00Z',
        end: '2026-05-15T10:00:00Z',
        time_zone: 'Europe/London',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('checkbox value', () => {
  it('accepts boolean', () => {
    expect(PropertyValueInputSchema('checkbox').safeParse({ checkbox: true }).success).toBe(true);
    expect(PropertyValueInputSchema('checkbox').safeParse({ checkbox: false }).success).toBe(true);
  });

  it('rejects non-boolean', () => {
    expect(PropertyValueInputSchema('checkbox').safeParse({ checkbox: 'yes' }).success).toBe(false);
  });
});

describe('url value', () => {
  it('accepts http(s) URL', () => {
    expect(PropertyValueInputSchema('url').safeParse({ url: 'https://example.com' }).success).toBe(
      true,
    );
  });

  it('rejects javascript: URL', () => {
    expect(PropertyValueInputSchema('url').safeParse({ url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });
});

describe('relation value', () => {
  it('accepts an array of page refs', () => {
    expect(
      PropertyValueInputSchema('relation').safeParse({
        relation: [{ id: '11111111-1111-1111-1111-111111111111' }],
      }).success,
    ).toBe(true);
  });
});
