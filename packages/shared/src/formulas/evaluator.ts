import { type Node, parseFormula } from './parser.ts';

export type FormulaValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };

export class FormulaEvalError extends Error {
  override readonly name = 'FormulaEvalError';
}

export interface EvalContext {
  /** Property accessor: `prop("Name")` → resolved value. */
  getProperty: (name: string) => FormulaValue;
}

function asNumber(v: FormulaValue): number {
  if (v.type === 'number') return v.value;
  if (v.type === 'boolean') return v.value ? 1 : 0;
  const n = Number(v.value);
  return Number.isNaN(n) ? 0 : n;
}
function asString(v: FormulaValue): string {
  if (v.type === 'string') return v.value;
  if (v.type === 'number') return String(v.value);
  return v.value ? 'true' : 'false';
}
function asBoolean(v: FormulaValue): boolean {
  if (v.type === 'boolean') return v.value;
  if (v.type === 'number') return v.value !== 0;
  return v.value.length > 0;
}

function makeNumber(value: number): FormulaValue {
  return { type: 'number', value };
}
function makeString(value: string): FormulaValue {
  return { type: 'string', value };
}
function makeBoolean(value: boolean): FormulaValue {
  return { type: 'boolean', value };
}

type Fn = (args: FormulaValue[]) => FormulaValue;

const FUNCTIONS: Record<string, Fn> = {
  // Strings
  concat: (args) => makeString(args.map(asString).join('')),
  length: (args) => makeNumber(asString(args[0] ?? makeString('')).length),
  upper: (args) => makeString(asString(args[0] ?? makeString('')).toUpperCase()),
  lower: (args) => makeString(asString(args[0] ?? makeString('')).toLowerCase()),
  contains: (args) =>
    makeBoolean(asString(args[0] ?? makeString('')).includes(asString(args[1] ?? makeString('')))),
  startsWith: (args) =>
    makeBoolean(
      asString(args[0] ?? makeString('')).startsWith(asString(args[1] ?? makeString(''))),
    ),
  endsWith: (args) =>
    makeBoolean(asString(args[0] ?? makeString('')).endsWith(asString(args[1] ?? makeString('')))),
  replace: (args) => {
    const haystack = asString(args[0] ?? makeString(''));
    const needle = asString(args[1] ?? makeString(''));
    const repl = asString(args[2] ?? makeString(''));
    if (needle === '') return makeString(haystack);
    return makeString(haystack.split(needle).join(repl));
  },
  slice: (args) => {
    const s = asString(args[0] ?? makeString(''));
    const start = Math.trunc(asNumber(args[1] ?? makeNumber(0)));
    const end = args[2] !== undefined ? Math.trunc(asNumber(args[2])) : undefined;
    return makeString(end === undefined ? s.slice(start) : s.slice(start, end));
  },
  format: (args) => makeString(asString(args[0] ?? makeString(''))),
  toNumber: (args) => {
    const n = Number(asString(args[0] ?? makeString('0')));
    return makeNumber(Number.isFinite(n) ? n : 0);
  },
  // Numbers
  abs: (args) => makeNumber(Math.abs(asNumber(args[0] ?? makeNumber(0)))),
  round: (args) => makeNumber(Math.round(asNumber(args[0] ?? makeNumber(0)))),
  floor: (args) => makeNumber(Math.floor(asNumber(args[0] ?? makeNumber(0)))),
  ceil: (args) => makeNumber(Math.ceil(asNumber(args[0] ?? makeNumber(0)))),
  min: (args) => makeNumber(args.length === 0 ? 0 : Math.min(...args.map((a) => asNumber(a)))),
  max: (args) => makeNumber(args.length === 0 ? 0 : Math.max(...args.map((a) => asNumber(a)))),
  add: (args) =>
    makeNumber(asNumber(args[0] ?? makeNumber(0)) + asNumber(args[1] ?? makeNumber(0))),
  subtract: (args) =>
    makeNumber(asNumber(args[0] ?? makeNumber(0)) - asNumber(args[1] ?? makeNumber(0))),
  multiply: (args) =>
    makeNumber(asNumber(args[0] ?? makeNumber(1)) * asNumber(args[1] ?? makeNumber(1))),
  divide: (args) => {
    const denom = asNumber(args[1] ?? makeNumber(1));
    if (denom === 0) throw new FormulaEvalError('Division by zero');
    return makeNumber(asNumber(args[0] ?? makeNumber(0)) / denom);
  },
  pow: (args) =>
    makeNumber(asNumber(args[0] ?? makeNumber(0)) ** asNumber(args[1] ?? makeNumber(0))),
  sqrt: (args) => makeNumber(Math.sqrt(asNumber(args[0] ?? makeNumber(0)))),
  log: (args) => makeNumber(Math.log(asNumber(args[0] ?? makeNumber(1)))),
  // Booleans
  not: (args) => makeBoolean(!asBoolean(args[0] ?? makeBoolean(false))),
  empty: (args) => {
    const v = args[0];
    if (v === undefined) return makeBoolean(true);
    if (v.type === 'string') return makeBoolean(v.value.length === 0);
    if (v.type === 'number') return makeBoolean(v.value === 0);
    return makeBoolean(!v.value);
  },
};

function compareValues(left: FormulaValue, right: FormulaValue): number {
  // Same-type ordering; mixed types coerce to number.
  if (left.type === 'string' && right.type === 'string') {
    return left.value === right.value ? 0 : left.value < right.value ? -1 : 1;
  }
  if (left.type === 'boolean' && right.type === 'boolean') {
    return left.value === right.value ? 0 : left.value ? 1 : -1;
  }
  const a = asNumber(left);
  const b = asNumber(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function evalNode(node: Node, ctx: EvalContext): FormulaValue {
  switch (node.kind) {
    case 'number':
      return makeNumber(node.value);
    case 'string':
      return makeString(node.value);
    case 'boolean':
      return makeBoolean(node.value);
    case 'unop': {
      const v = evalNode(node.operand, ctx);
      if (node.op === '-') return makeNumber(-asNumber(v));
      if (node.op === '!') return makeBoolean(!asBoolean(v));
      throw new FormulaEvalError(`Unknown unary operator '${node.op}'`);
    }
    case 'binop': {
      // Short-circuit evaluation for && and ||.
      if (node.op === '&&') {
        const left = evalNode(node.left, ctx);
        if (!asBoolean(left)) return makeBoolean(false);
        return makeBoolean(asBoolean(evalNode(node.right, ctx)));
      }
      if (node.op === '||') {
        const left = evalNode(node.left, ctx);
        if (asBoolean(left)) return makeBoolean(true);
        return makeBoolean(asBoolean(evalNode(node.right, ctx)));
      }
      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);
      switch (node.op) {
        case '+':
          if (left.type === 'string' || right.type === 'string') {
            return makeString(asString(left) + asString(right));
          }
          return makeNumber(asNumber(left) + asNumber(right));
        case '-':
          return makeNumber(asNumber(left) - asNumber(right));
        case '*':
          return makeNumber(asNumber(left) * asNumber(right));
        case '/': {
          const denom = asNumber(right);
          if (denom === 0) throw new FormulaEvalError('Division by zero');
          return makeNumber(asNumber(left) / denom);
        }
        case '%': {
          const denom = asNumber(right);
          if (denom === 0) throw new FormulaEvalError('Modulo by zero');
          return makeNumber(asNumber(left) % denom);
        }
        case '==':
          return makeBoolean(compareValues(left, right) === 0);
        case '!=':
          return makeBoolean(compareValues(left, right) !== 0);
        case '<':
          return makeBoolean(compareValues(left, right) < 0);
        case '>':
          return makeBoolean(compareValues(left, right) > 0);
        case '<=':
          return makeBoolean(compareValues(left, right) <= 0);
        case '>=':
          return makeBoolean(compareValues(left, right) >= 0);
        default:
          throw new FormulaEvalError(`Unknown operator '${node.op}'`);
      }
    }
    case 'call': {
      // Built-in `prop("Name")` and `if(cond, a, b)` get special handling because
      // they need access to the parser context.
      if (node.name === 'prop') {
        if (node.args.length !== 1) {
          throw new FormulaEvalError(`prop() expects 1 argument, got ${node.args.length}`);
        }
        const nameArg = node.args[0];
        if (nameArg === undefined) {
          throw new FormulaEvalError('prop() requires a property name');
        }
        const nameVal = evalNode(nameArg, ctx);
        return ctx.getProperty(asString(nameVal));
      }
      if (node.name === 'if') {
        if (node.args.length !== 3) {
          throw new FormulaEvalError(`if() expects 3 arguments, got ${node.args.length}`);
        }
        const cond = evalNode(node.args[0] as Node, ctx);
        return asBoolean(cond)
          ? evalNode(node.args[1] as Node, ctx)
          : evalNode(node.args[2] as Node, ctx);
      }
      const fn = FUNCTIONS[node.name];
      if (fn === undefined) {
        throw new FormulaEvalError(`Unknown function '${node.name}'`);
      }
      const args = node.args.map((arg) => evalNode(arg, ctx));
      return fn(args);
    }
  }
}

/** Evaluate a formula expression against an evaluation context. */
export function evaluateFormula(expression: string, ctx: EvalContext): FormulaValue {
  const ast = parseFormula(expression);
  return evalNode(ast, ctx);
}

/** Parse only; useful for validation / caching. */
export { parseFormula };
