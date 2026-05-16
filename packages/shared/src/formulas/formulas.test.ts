import { describe, expect, it } from 'vitest';
import {
  type EvalContext,
  FormulaEvalError,
  evaluateFormula,
  parseFormula,
  tokenize,
} from './index.ts';

function makeCtx(props: Record<string, unknown>): EvalContext {
  return {
    getProperty: (name) => {
      const v = props[name];
      if (typeof v === 'string') return { type: 'string', value: v };
      if (typeof v === 'number') return { type: 'number', value: v };
      if (typeof v === 'boolean') return { type: 'boolean', value: v };
      return { type: 'string', value: '' };
    },
  };
}

describe('tokenizer', () => {
  it('tokenises numbers + operators', () => {
    const toks = tokenize('1 + 2.5 * 3');
    expect(toks.map((t) => t.type)).toEqual(['number', 'op', 'number', 'op', 'number', 'eof']);
  });

  it('tokenises strings with escapes', () => {
    const toks = tokenize('"a\\nb"');
    expect(toks[0]!.value).toBe('a\nb');
  });

  it('tokenises booleans + identifiers', () => {
    const toks = tokenize('true && foo(false)');
    expect(toks.map((t) => t.type)).toEqual([
      'boolean',
      'op',
      'ident',
      'lparen',
      'boolean',
      'rparen',
      'eof',
    ]);
  });

  it('rejects unterminated strings', () => {
    expect(() => tokenize('"oops')).toThrow(/Unterminated string/);
  });

  it('rejects unknown characters', () => {
    expect(() => tokenize('1 @ 2')).toThrow(/Unexpected character/);
  });
});

describe('parser', () => {
  it('respects operator precedence', () => {
    const ast = parseFormula('1 + 2 * 3');
    expect(ast).toEqual({
      kind: 'binop',
      op: '+',
      left: { kind: 'number', value: 1 },
      right: {
        kind: 'binop',
        op: '*',
        left: { kind: 'number', value: 2 },
        right: { kind: 'number', value: 3 },
      },
    });
  });

  it('parses function calls', () => {
    const ast = parseFormula('add(1, multiply(2, 3))');
    expect(ast.kind).toBe('call');
  });

  it('rejects trailing tokens', () => {
    expect(() => parseFormula('1 + 2 garbage')).toThrow(/Unexpected token/);
  });
});

describe('evaluator', () => {
  const ctx = makeCtx({ Score: 8, Name: 'Alice', Done: true });

  it('arithmetic', () => {
    expect(evaluateFormula('1 + 2 * 3', ctx)).toEqual({ type: 'number', value: 7 });
    expect(evaluateFormula('(1 + 2) * 3', ctx)).toEqual({ type: 'number', value: 9 });
    expect(evaluateFormula('-5 + 10', ctx)).toEqual({ type: 'number', value: 5 });
  });

  it('comparisons', () => {
    expect(evaluateFormula('1 < 2', ctx)).toEqual({ type: 'boolean', value: true });
    expect(evaluateFormula('1 >= 2', ctx)).toEqual({ type: 'boolean', value: false });
    expect(evaluateFormula('"a" == "a"', ctx)).toEqual({ type: 'boolean', value: true });
  });

  it('logical short-circuit', () => {
    expect(evaluateFormula('false && (1 / 0 == 0)', ctx)).toEqual({
      type: 'boolean',
      value: false,
    });
    expect(evaluateFormula('true || (1 / 0 == 0)', ctx)).toEqual({
      type: 'boolean',
      value: true,
    });
  });

  it('prop() looks up the context', () => {
    expect(evaluateFormula('prop("Score") * 2', ctx)).toEqual({ type: 'number', value: 16 });
    expect(evaluateFormula('prop("Name")', ctx)).toEqual({ type: 'string', value: 'Alice' });
    expect(evaluateFormula('prop("Done")', ctx)).toEqual({ type: 'boolean', value: true });
  });

  it('if() conditional', () => {
    expect(evaluateFormula('if(prop("Score") > 5, "high", "low")', ctx)).toEqual({
      type: 'string',
      value: 'high',
    });
    expect(evaluateFormula('if(prop("Score") < 5, "low", "high")', ctx)).toEqual({
      type: 'string',
      value: 'high',
    });
  });

  it('string functions', () => {
    expect(evaluateFormula('concat("Hello, ", prop("Name"))', ctx)).toEqual({
      type: 'string',
      value: 'Hello, Alice',
    });
    expect(evaluateFormula('length(prop("Name"))', ctx)).toEqual({ type: 'number', value: 5 });
    expect(evaluateFormula('upper(prop("Name"))', ctx)).toEqual({
      type: 'string',
      value: 'ALICE',
    });
    expect(evaluateFormula('contains(prop("Name"), "ic")', ctx)).toEqual({
      type: 'boolean',
      value: true,
    });
    expect(evaluateFormula('startsWith(prop("Name"), "Al")', ctx)).toEqual({
      type: 'boolean',
      value: true,
    });
    expect(evaluateFormula('replace("foo", "o", "x")', ctx)).toEqual({
      type: 'string',
      value: 'fxx',
    });
    expect(evaluateFormula('slice("hello world", 6)', ctx)).toEqual({
      type: 'string',
      value: 'world',
    });
  });

  it('number functions', () => {
    expect(evaluateFormula('abs(-5)', ctx)).toEqual({ type: 'number', value: 5 });
    expect(evaluateFormula('round(3.7)', ctx)).toEqual({ type: 'number', value: 4 });
    expect(evaluateFormula('floor(3.7)', ctx)).toEqual({ type: 'number', value: 3 });
    expect(evaluateFormula('min(3, 1, 2)', ctx)).toEqual({ type: 'number', value: 1 });
    expect(evaluateFormula('max(3, 1, 2)', ctx)).toEqual({ type: 'number', value: 3 });
    expect(evaluateFormula('pow(2, 8)', ctx)).toEqual({ type: 'number', value: 256 });
    expect(evaluateFormula('sqrt(16)', ctx)).toEqual({ type: 'number', value: 4 });
  });

  it('boolean functions', () => {
    expect(evaluateFormula('not(prop("Done"))', ctx)).toEqual({ type: 'boolean', value: false });
    expect(evaluateFormula('empty("")', ctx)).toEqual({ type: 'boolean', value: true });
    expect(evaluateFormula('empty("x")', ctx)).toEqual({ type: 'boolean', value: false });
    expect(evaluateFormula('empty(0)', ctx)).toEqual({ type: 'boolean', value: true });
  });

  it('division by zero throws', () => {
    expect(() => evaluateFormula('1 / 0', ctx)).toThrow(FormulaEvalError);
    expect(() => evaluateFormula('divide(1, 0)', ctx)).toThrow(FormulaEvalError);
  });

  it('unknown function throws', () => {
    expect(() => evaluateFormula('fizzbuzz(1)', ctx)).toThrow(/Unknown function/);
  });

  it('string + non-string concatenates', () => {
    expect(evaluateFormula('"score=" + prop("Score")', ctx)).toEqual({
      type: 'string',
      value: 'score=8',
    });
  });

  it('complex realistic formula', () => {
    const result = evaluateFormula(
      'if(prop("Done") && prop("Score") >= 5, concat("Pass (", prop("Name"), ")"), "Fail")',
      ctx,
    );
    expect(result).toEqual({ type: 'string', value: 'Pass (Alice)' });
  });
});
