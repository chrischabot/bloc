import { describe, expect, it } from 'vitest';
import { StepSchema, renderTemplate, renderTemplateDeep } from './index.ts';

describe('renderTemplate', () => {
  it('resolves a flat path', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('resolves a nested path', () => {
    expect(renderTemplate('id={{page.id}}', { page: { id: '42' } })).toBe('id=42');
  });

  it('emits empty string for unknown path', () => {
    expect(renderTemplate('x={{missing}}', {})).toBe('x=');
  });

  it('emits empty string for prototype access', () => {
    expect(renderTemplate('{{__proto__}}', {})).toBe('');
    expect(renderTemplate('{{constructor}}', {})).toBe('');
    expect(renderTemplate('{{a.prototype}}', { a: {} })).toBe('');
  });

  it('rejects malformed paths', () => {
    expect(renderTemplate('{{a-b}}', { a: { b: 'x' } })).toBe('');
    expect(renderTemplate('{{a.b.}}', { a: { b: 'x' } })).toBe('');
  });

  it('json-stringifies objects', () => {
    expect(renderTemplate('{{obj}}', { obj: { x: 1 } })).toBe('{"x":1}');
  });
});

describe('renderTemplateDeep', () => {
  it('walks nested structures', () => {
    const out = renderTemplateDeep(
      { msg: 'hi {{name}}', list: ['{{name}}!', 42] },
      { name: 'Alice' },
    );
    expect(out).toEqual({ msg: 'hi Alice', list: ['Alice!', 42] });
  });

  it('does not recurse into prototype-polluted keys', () => {
    // Even if a bag contains __proto__ pollution it must not affect the engine.
    const malicious: Record<string, unknown> = JSON.parse('{"__proto__": { "polluted": "yes" } }');
    expect(renderTemplate('{{polluted}}', malicious)).toBe('');
  });

  it('stops at depth 10', () => {
    let nested: unknown = '{{name}}';
    for (let i = 0; i < 15; i++) nested = { inner: nested };
    const result = renderTemplateDeep(nested, { name: 'Alice' });
    // Anything past depth 10 is left raw.
    expect(JSON.stringify(result)).toContain('{{name}}');
  });
});

describe('StepSchema', () => {
  it('validates add_page_to_database', () => {
    const result = StepSchema.safeParse({
      type: 'add_page_to_database',
      database_id: '11111111-1111-1111-1111-111111111111',
      properties: { Name: { title: [{ type: 'text', text: { content: 'x' } }] } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown step type', () => {
    const result = StepSchema.safeParse({ type: 'not_a_step' });
    expect(result.success).toBe(false);
  });

  it('validates send_email', () => {
    const result = StepSchema.safeParse({
      type: 'send_email',
      to: ['{{actor.email}}'],
      subject: 'Hello',
      body: 'You have a new task',
    });
    expect(result.success).toBe(true);
  });

  it('validates delay duration ISO 8601', () => {
    expect(StepSchema.safeParse({ type: 'delay', duration: 'PT15M' }).success).toBe(true);
    expect(StepSchema.safeParse({ type: 'delay', duration: 'invalid' }).success).toBe(false);
  });
});
