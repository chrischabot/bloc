export type TokenType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'ident'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'op'
  | 'eof';

export interface Token {
  type: TokenType;
  /** Lexeme as it appeared in the source (for diagnostics). */
  raw: string;
  /** Parsed value when `number`/`string`/`boolean`. */
  value?: number | string | boolean;
  /** Character offset of the token start. */
  pos: number;
}

export class TokenizerError extends Error {
  readonly pos: number;
  constructor(message: string, pos: number) {
    super(`${message} at column ${pos + 1}`);
    this.pos = pos;
  }
}

const OPERATORS = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '!',
] as const;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] ?? '';
    // Whitespace
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    // Number (integer or decimal)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] ?? ''))) {
      let j = i;
      while (j < input.length && /[\d.]/.test(input[j] ?? '')) j += 1;
      const raw = input.slice(i, j);
      const num = Number(raw);
      if (Number.isNaN(num)) throw new TokenizerError(`Invalid number '${raw}'`, i);
      tokens.push({ type: 'number', raw, value: num, pos: i });
      i = j;
      continue;
    }
    // String literal "..."
    if (ch === '"') {
      let j = i + 1;
      let body = '';
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && j + 1 < input.length) {
          const next = input[j + 1] ?? '';
          if (next === 'n') body += '\n';
          else if (next === 't') body += '\t';
          else if (next === '\\') body += '\\';
          else if (next === '"') body += '"';
          else body += next;
          j += 2;
        } else {
          body += input[j];
          j += 1;
        }
      }
      if (j >= input.length) throw new TokenizerError('Unterminated string', i);
      tokens.push({ type: 'string', raw: input.slice(i, j + 1), value: body, pos: i });
      i = j + 1;
      continue;
    }
    // Identifier (or boolean)
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j] ?? '')) j += 1;
      const raw = input.slice(i, j);
      if (raw === 'true') tokens.push({ type: 'boolean', raw, value: true, pos: i });
      else if (raw === 'false') tokens.push({ type: 'boolean', raw, value: false, pos: i });
      else tokens.push({ type: 'ident', raw, pos: i });
      i = j;
      continue;
    }
    // Parens / comma
    if (ch === '(') {
      tokens.push({ type: 'lparen', raw: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', raw: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', raw: ch, pos: i });
      i += 1;
      continue;
    }
    // Operator (longest match first)
    let matched = false;
    for (const op of OPERATORS) {
      if (input.slice(i, i + op.length) === op) {
        tokens.push({ type: 'op', raw: op, pos: i });
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    throw new TokenizerError(`Unexpected character '${ch}'`, i);
  }
  tokens.push({ type: 'eof', raw: '', pos: input.length });
  return tokens;
}
