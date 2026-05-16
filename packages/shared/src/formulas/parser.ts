import { type Token, tokenize } from './tokenizer.ts';

export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'binop'; op: string; left: Node; right: Node }
  | { kind: 'unop'; op: string; operand: Node }
  | { kind: 'call'; name: string; args: Node[] };

export class ParseError extends Error {
  readonly pos: number;
  constructor(message: string, pos: number) {
    super(`${message} at column ${pos + 1}`);
    this.pos = pos;
  }
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    const tok = this.tokens[this.pos];
    if (!tok) throw new ParseError('Unexpected end of input', this.tokens.length);
    return tok;
  }

  private advance(): Token {
    const tok = this.peek();
    this.pos += 1;
    return tok;
  }

  private consume(type: Token['type'], raw?: string): Token {
    const tok = this.peek();
    if (tok.type !== type || (raw !== undefined && tok.raw !== raw)) {
      throw new ParseError(`Expected ${raw ?? type} but found '${tok.raw}' (${tok.type})`, tok.pos);
    }
    return this.advance();
  }

  private matchOp(...ops: string[]): Token | null {
    const tok = this.peek();
    if (tok.type === 'op' && ops.includes(tok.raw)) {
      this.advance();
      return tok;
    }
    return null;
  }

  parseExpr(): Node {
    const node = this.parseOr();
    if (this.peek().type !== 'eof') {
      throw new ParseError(`Unexpected token '${this.peek().raw}'`, this.peek().pos);
    }
    return node;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.matchOp('||')) {
      const right = this.parseAnd();
      left = { kind: 'binop', op: '||', left, right };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseEquality();
    while (this.matchOp('&&')) {
      const right = this.parseEquality();
      left = { kind: 'binop', op: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    let opTok = this.matchOp('==', '!=');
    while (opTok !== null) {
      const right = this.parseComparison();
      left = { kind: 'binop', op: opTok.raw, left, right };
      opTok = this.matchOp('==', '!=');
    }
    return left;
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    let opTok = this.matchOp('<', '>', '<=', '>=');
    while (opTok !== null) {
      const right = this.parseAdditive();
      left = { kind: 'binop', op: opTok.raw, left, right };
      opTok = this.matchOp('<', '>', '<=', '>=');
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    let opTok = this.matchOp('+', '-');
    while (opTok !== null) {
      const right = this.parseMultiplicative();
      left = { kind: 'binop', op: opTok.raw, left, right };
      opTok = this.matchOp('+', '-');
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    let opTok = this.matchOp('*', '/', '%');
    while (opTok !== null) {
      const right = this.parseUnary();
      left = { kind: 'binop', op: opTok.raw, left, right };
      opTok = this.matchOp('*', '/', '%');
    }
    return left;
  }

  private parseUnary(): Node {
    const opTok = this.matchOp('-', '!');
    if (opTok !== null) {
      const operand = this.parseUnary();
      return { kind: 'unop', op: opTok.raw, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const tok = this.peek();
    if (tok.type === 'number') {
      this.advance();
      return { kind: 'number', value: tok.value as number };
    }
    if (tok.type === 'string') {
      this.advance();
      return { kind: 'string', value: tok.value as string };
    }
    if (tok.type === 'boolean') {
      this.advance();
      return { kind: 'boolean', value: tok.value as boolean };
    }
    if (tok.type === 'lparen') {
      this.advance();
      const inner = this.parseOr();
      this.consume('rparen');
      return inner;
    }
    if (tok.type === 'ident') {
      this.advance();
      this.consume('lparen');
      const args: Node[] = [];
      if (this.peek().type !== 'rparen') {
        args.push(this.parseOr());
        while (this.peek().type === 'comma') {
          this.advance();
          args.push(this.parseOr());
        }
      }
      this.consume('rparen');
      return { kind: 'call', name: tok.raw, args };
    }
    throw new ParseError(`Unexpected token '${tok.raw}'`, tok.pos);
  }
}

export function parseFormula(input: string): Node {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parseExpr();
}
