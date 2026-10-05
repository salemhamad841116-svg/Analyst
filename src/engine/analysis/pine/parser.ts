/**
 * Pine Script parser — recursive descent / precedence climbing.
 * Produces a real AST (see ast.ts). Syntax errors are collected with
 * line:col and the parser recovers at the next logical line.
 */

import {
  Arg, BlockExpr, Diagnostic, Expr, FuncParam, Loc, Program, Stmt, SwitchCase, VarDecl,
} from './ast';
import { extractVersion, lex, Token } from './lexer';

class ParseError extends Error {
  loc: Loc;
  constructor(message: string, loc: Loc) {
    super(message);
    this.loc = loc;
  }
}

const TYPE_WORDS = new Set([
  'int', 'float', 'bool', 'string', 'color', 'series', 'simple', 'const',
  'label', 'line', 'box', 'table', 'linefill', 'polyline', 'chart.point',
]);
const GENERIC_TYPES = new Set(['array', 'matrix', 'map']);

export interface ParseOutput {
  program: Program;
  syntaxErrors: Diagnostic[];
  tokenCount: number;
}

export function parsePine(source: string): ParseOutput {
  const { tokens, errors: lexErrors } = lex(source);
  const parser = new Parser(tokens);
  const body = parser.parseProgram();
  const syntaxErrors: Diagnostic[] = [...lexErrors, ...parser.errors];
  return {
    program: { version: extractVersion(source), body },
    syntaxErrors,
    tokenCount: tokens.length,
  };
}

class Parser {
  private pos = 0;
  private nextId = 1;
  errors: Diagnostic[] = [];

  constructor(private toks: Token[]) {}

  // -------------------------------------------------------------------------
  // Token helpers
  // -------------------------------------------------------------------------
  private peek(off = 0): Token {
    return this.toks[Math.min(this.pos + off, this.toks.length - 1)];
  }
  private next(): Token {
    const t = this.peek();
    if (this.pos < this.toks.length - 1) this.pos++;
    return t;
  }
  private isOp(v: string, off = 0): boolean {
    const t = this.peek(off);
    return t.type === 'op' && t.value === v;
  }
  private isKw(v: string, off = 0): boolean {
    const t = this.peek(off);
    return t.type === 'kw' && t.value === v;
  }
  private loc(t: Token = this.peek()): Loc {
    return { line: t.line, col: t.col };
  }
  private id(): number {
    return this.nextId++;
  }
  private expectOp(v: string): Token {
    if (!this.isOp(v)) {
      throw new ParseError(`Expected '${v}' but found ${this.describe(this.peek())}`, this.loc());
    }
    return this.next();
  }
  private describe(t: Token): string {
    if (t.type === 'eof') return 'end of file';
    if (t.type === 'newline') return 'end of line';
    if (t.type === 'indent') return 'unexpected indent';
    if (t.type === 'dedent') return 'end of block';
    return `'${t.value}'`;
  }
  private skipNewlines(): void {
    while (this.peek().type === 'newline') this.next();
  }

  // -------------------------------------------------------------------------
  // Program / blocks
  // -------------------------------------------------------------------------
  parseProgram(): Stmt[] {
    const body: Stmt[] = [];
    this.skipNewlines();
    while (this.peek().type !== 'eof') {
      if (this.peek().type === 'dedent' || this.peek().type === 'indent') {
        // stray structure token at top level: report once and move on
        this.errors.push({
          severity: 'error', code: 'UNEXPECTED_INDENT', stage: 'SYNTAX',
          message: `Unexpected ${this.peek().type === 'indent' ? 'indentation' : 'dedent'}`,
          loc: this.loc(),
        });
        this.next();
        continue;
      }
      const s = this.safeStatement();
      if (s) body.push(s);
      this.skipNewlines();
    }
    return body;
  }

  private safeStatement(): Stmt | null {
    const startPos = this.pos;
    try {
      return this.parseStatement();
    } catch (e) {
      if (e instanceof ParseError) {
        this.errors.push({ severity: 'error', code: 'SYNTAX_ERROR', stage: 'SYNTAX', message: e.message, loc: e.loc });
        this.recover(startPos);
        return null;
      }
      throw e;
    }
  }

  /** Skip to the end of the current logical line (and over any indented block that follows). */
  private recover(startPos: number): void {
    if (this.pos === startPos) this.next();
    while (!['newline', 'eof'].includes(this.peek().type)) {
      if (this.peek().type === 'dedent') return;
      this.next();
    }
    if (this.peek().type === 'newline') this.next();
    if (this.peek().type === 'indent') {
      let d = 0;
      while (this.peek().type !== 'eof') {
        const t = this.next();
        if (t.type === 'indent') d++;
        else if (t.type === 'dedent') { d--; if (d === 0) break; }
      }
    }
  }

  /** Block after a header: either NEWLINE INDENT stmts DEDENT, or a single inline statement. */
  private parseBlock(): Stmt[] {
    if (this.peek().type === 'newline') {
      this.next();
      if (this.peek().type !== 'indent') {
        throw new ParseError('Expected an indented block', this.loc());
      }
      this.next(); // indent
      const body: Stmt[] = [];
      this.skipNewlines();
      while (this.peek().type !== 'dedent' && this.peek().type !== 'eof') {
        const s = this.safeStatement();
        if (s) body.push(s);
        this.skipNewlines();
      }
      if (this.peek().type === 'dedent') this.next();
      return body;
    }
    // inline single statement (e.g. `f(x) => x * 2`)
    return [this.parseStatement()];
  }

  private endStatement(): void {
    const t = this.peek();
    if (t.type === 'newline') { this.next(); return; }
    if (t.type === 'eof' || t.type === 'dedent') return;
    if (this.isOp(';')) { this.next(); return; }
    throw new ParseError(`Unexpected ${this.describe(t)}`, this.loc());
  }

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------
  private parseStatement(): Stmt {
    const t = this.peek();

    if (t.type === 'kw') {
      switch (t.value) {
        case 'if': return this.parseIf();
        case 'for': return this.parseFor();
        case 'while': return this.parseWhile();
        case 'switch': return this.parseSwitch();
        case 'break': { this.next(); this.endStatement(); return { kind: 'Break', id: this.id(), loc: this.loc(t) }; }
        case 'continue': { this.next(); this.endStatement(); return { kind: 'Continue', id: this.id(), loc: this.loc(t) }; }
        case 'var':
        case 'varip':
          return this.parseVarDecl();
        default:
          break;
      }
    }

    // method / export function definitions
    if (t.type === 'ident' && (t.value === 'method' || t.value === 'export') && this.peek(1).type === 'ident' && this.isOp('(', 2)) {
      const isMethod = t.value === 'method';
      this.next();
      return this.parseFuncDef(isMethod);
    }

    // function definition:  name(params) =>
    if (t.type === 'ident' && this.isOp('(', 1) && this.looksLikeFuncDef()) {
      return this.parseFuncDef(false);
    }

    // tuple declaration:  [a, b] = expr
    if (this.isOp('[') && this.looksLikeTupleDecl()) {
      return this.parseTupleDecl();
    }

    // typed / plain variable declaration or assignment
    if (this.looksLikeVarDecl()) {
      return this.parseVarDecl();
    }

    // expression statement
    const e = this.parseExpr();
    const stmt: Stmt = { kind: 'ExprStmt', id: this.id(), loc: e.loc, expr: e };
    this.endStatement();
    return stmt;
  }

  private looksLikeFuncDef(): boolean {
    // ident '(' ... ')' '=>'
    let i = 1;
    let depth = 0;
    for (;; i++) {
      const t = this.peek(i);
      if (t.type === 'eof' || t.type === 'newline') return false;
      if (t.type === 'op' && t.value === '(') depth++;
      if (t.type === 'op' && t.value === ')') {
        depth--;
        if (depth === 0) {
          const nx = this.peek(i + 1);
          return nx.type === 'op' && nx.value === '=>';
        }
      }
    }
  }

  private looksLikeTupleDecl(): boolean {
    let i = 1;
    let depth = 1;
    for (;; i++) {
      const t = this.peek(i);
      if (t.type === 'eof' || t.type === 'newline') return false;
      if (t.type === 'op' && t.value === '[') depth++;
      if (t.type === 'op' && t.value === ']') {
        depth--;
        if (depth === 0) {
          const nx = this.peek(i + 1);
          return nx.type === 'op' && (nx.value === '=' || nx.value === ':=');
        }
      }
    }
  }

  private looksLikeVarDecl(): boolean {
    const t = this.peek();
    if (t.type !== 'ident') return false;
    // typed declaration:  int x = ...   /  array<float> x = ...
    let off = 1;
    if (TYPE_WORDS.has(t.value) || GENERIC_TYPES.has(t.value)) {
      if (GENERIC_TYPES.has(t.value) && this.isOp('<', 1)) {
        let d = 0;
        for (off = 1; ; off++) {
          const x = this.peek(off);
          if (x.type === 'eof' || x.type === 'newline') return false;
          if (x.type === 'op' && x.value === '<') d++;
          if (x.type === 'op' && x.value === '>') { d--; if (d === 0) { off++; break; } }
        }
      }
      if (this.peek(off).type === 'ident' && this.isAssignOp(this.peek(off + 1))) return true;
    }
    return this.isAssignOp(this.peek(1));
  }

  private isAssignOp(t: Token): boolean {
    return t.type === 'op' && ['=', ':=', '+=', '-=', '*=', '/=', '%='].includes(t.value);
  }

  private parseTupleDecl(): Stmt {
    const startTok = this.peek();
    this.expectOp('[');
    const names: string[] = [];
    const nameLocs: Loc[] = [];
    while (!this.isOp(']')) {
      const n = this.next();
      if (n.type !== 'ident') throw new ParseError(`Expected identifier in tuple declaration, found ${this.describe(n)}`, this.loc(n));
      names.push(n.value);
      nameLocs.push(this.loc(n));
      if (this.isOp(',')) this.next();
      else break;
    }
    this.expectOp(']');
    const opTok = this.next();
    const init = this.parseDeclInit();
    if (!this.lastInitWasBlock) this.endStatement();
    const d: VarDecl = {
      kind: 'VarDecl', id: this.id(), loc: this.loc(startTok), names, nameLocs, isTuple: true,
      op: opTok.value === ':=' ? ':=' : '=', declKind: 'plain', init,
    };
    return d;
  }

  private parseVarDecl(): Stmt {
    const startTok = this.peek();
    let declKind: 'plain' | 'var' | 'varip' = 'plain';
    if (this.isKw('var')) { this.next(); declKind = 'var'; }
    else if (this.isKw('varip')) { this.next(); declKind = 'varip'; }

    let typeName: string | undefined;
    const first = this.peek();
    if (first.type === 'ident' && (TYPE_WORDS.has(first.value) || GENERIC_TYPES.has(first.value))) {
      // consume optional type annotation if followed by an identifier (possibly after <...>)
      let off = 1;
      let typeText = first.value;
      if (GENERIC_TYPES.has(first.value) && this.isOp('<', 1)) {
        let d = 0;
        for (off = 1; ; off++) {
          const x = this.peek(off);
          if (x.type === 'eof' || x.type === 'newline') break;
          typeText += x.value;
          if (x.type === 'op' && x.value === '<') d++;
          if (x.type === 'op' && x.value === '>') { d--; if (d === 0) { off++; break; } }
        }
      }
      if (this.peek(off).type === 'ident' && this.isAssignOp(this.peek(off + 1))) {
        for (let k = 0; k < off; k++) this.next();
        typeName = typeText;
      }
    }
    // `var float x = ...` where type is 2nd word
    if (!typeName && this.peek().type === 'ident' && TYPE_WORDS.has(this.peek().value) && this.peek(1).type === 'ident') {
      typeName = this.next().value;
    }

    const nameTok = this.next();
    if (nameTok.type !== 'ident') {
      throw new ParseError(`Expected variable name but found ${this.describe(nameTok)}`, this.loc(nameTok));
    }
    const opTok = this.next();
    if (!this.isAssignOpTok(opTok)) {
      throw new ParseError(`Expected '=' or ':=' after '${nameTok.value}' but found ${this.describe(opTok)}`, this.loc(opTok));
    }
    let init = this.parseDeclInit();
    let op: '=' | ':=' = opTok.value === '=' ? '=' : ':=';
    let compound = false;
    if (['+=', '-=', '*=', '/=', '%='].includes(opTok.value)) {
      compound = true;
      op = ':=';
      const bin: Expr = {
        kind: 'Binary', id: this.id(), loc: this.loc(opTok), op: opTok.value[0],
        left: { kind: 'Ident', id: this.id(), loc: this.loc(nameTok), name: nameTok.value },
        right: init,
      };
      init = bin;
    }
    const wasBlock = this.lastInitWasBlock;
    if (!wasBlock) this.endStatement();
    return {
      kind: 'VarDecl', id: this.id(), loc: this.loc(startTok), names: [nameTok.value], nameLocs: [this.loc(nameTok)],
      isTuple: false, op, compound, declKind, typeName, init,
    };
  }

  private isAssignOpTok(t: Token): boolean {
    return t.type === 'op' && ['=', ':=', '+=', '-=', '*=', '/=', '%='].includes(t.value);
  }

  private lastInitWasBlock = false;

  /** Right-hand side of a declaration: expression, or an if/switch/for/while used as an expression. */
  private parseDeclInit(): Expr {
    this.lastInitWasBlock = false;
    const t = this.peek();
    if (t.type === 'kw' && ['if', 'switch', 'for', 'while'].includes(t.value)) {
      const stmt = this.parseStatement(); // consumes its own block + terminators
      this.lastInitWasBlock = true;
      const be: BlockExpr = { kind: 'BlockExpr', id: this.id(), loc: this.loc(t), stmt };
      return be;
    }
    return this.parseExpr();
  }

  private parseIf(): Stmt {
    const t = this.next(); // 'if'
    const test = this.parseExpr();
    const consequent = this.parseBlock();
    let alternate: Stmt[] | null = null;
    this.skipNewlinesIfFollowedBy('else');
    if (this.isKw('else')) {
      this.next();
      if (this.isKw('if')) {
        alternate = [this.parseIf()];
      } else {
        alternate = this.parseBlock();
      }
    }
    return { kind: 'If', id: this.id(), loc: this.loc(t), test, consequent, alternate };
  }

  private skipNewlinesIfFollowedBy(kw: string): void {
    let i = 0;
    while (this.peek(i).type === 'newline') i++;
    if (this.peek(i).type === 'kw' && this.peek(i).value === kw) this.pos += i;
  }

  private parseFor(): Stmt {
    const t = this.next(); // 'for'
    // for [a, b] in arr  /  for x in arr  /  for i = a to b [by s]
    if (this.isOp('[')) {
      this.next();
      const vars: string[] = [];
      while (!this.isOp(']')) {
        const v = this.next();
        if (v.type !== 'ident') throw new ParseError('Expected identifier in for-in destructuring', this.loc(v));
        vars.push(v.value);
        if (this.isOp(',')) this.next();
      }
      this.expectOp(']');
      if (!this.isKw('in')) throw new ParseError("Expected 'in'", this.loc());
      this.next();
      const iterable = this.parseExpr();
      const body = this.parseBlock();
      return { kind: 'ForIn', id: this.id(), loc: this.loc(t), variables: vars, iterable, body };
    }
    const v = this.next();
    if (v.type !== 'ident') throw new ParseError(`Expected loop variable but found ${this.describe(v)}`, this.loc(v));
    if (this.isKw('in')) {
      this.next();
      const iterable = this.parseExpr();
      const body = this.parseBlock();
      return { kind: 'ForIn', id: this.id(), loc: this.loc(t), variables: [v.value], iterable, body };
    }
    this.expectOp('=');
    const from = this.parseExpr();
    if (!this.isKw('to')) throw new ParseError("Expected 'to' in for loop", this.loc());
    this.next();
    const to = this.parseExpr();
    let by: Expr | undefined;
    if (this.isKw('by')) { this.next(); by = this.parseExpr(); }
    const body = this.parseBlock();
    return { kind: 'For', id: this.id(), loc: this.loc(t), variable: v.value, from, to, by, body };
  }

  private parseWhile(): Stmt {
    const t = this.next();
    const test = this.parseExpr();
    const body = this.parseBlock();
    return { kind: 'While', id: this.id(), loc: this.loc(t), test, body };
  }

  private parseSwitch(): Stmt {
    const t = this.next();
    let subject: Expr | undefined;
    if (this.peek().type !== 'newline') subject = this.parseExpr();
    if (this.peek().type !== 'newline') throw new ParseError('Expected newline after switch', this.loc());
    this.next();
    if (this.peek().type !== 'indent') throw new ParseError('Expected indented switch cases', this.loc());
    this.next();
    const cases: SwitchCase[] = [];
    this.skipNewlines();
    while (this.peek().type !== 'dedent' && this.peek().type !== 'eof') {
      const caseTok = this.peek();
      let test: Expr | undefined;
      if (this.isOp('=>')) {
        // default case
      } else {
        test = this.parseExpr();
      }
      this.expectOp('=>');
      const body = this.parseBlock();
      cases.push({ test, body, loc: this.loc(caseTok) });
      this.skipNewlines();
    }
    if (this.peek().type === 'dedent') this.next();
    return { kind: 'Switch', id: this.id(), loc: this.loc(t), subject, cases };
  }

  private parseFuncDef(isMethod: boolean): Stmt {
    const nameTok = this.next();
    this.expectOp('(');
    const params: FuncParam[] = [];
    while (!this.isOp(')')) {
      // optional type annotation:  int x   /  series float y = 3
      let pt = this.next();
      if (pt.type === 'ident' && (TYPE_WORDS.has(pt.value) || GENERIC_TYPES.has(pt.value)) && this.peek().type === 'ident') {
        pt = this.next();
      }
      if (pt.type !== 'ident') throw new ParseError(`Expected parameter name but found ${this.describe(pt)}`, this.loc(pt));
      let def: Expr | undefined;
      if (this.isOp('=')) { this.next(); def = this.parseExpr(); }
      params.push({ name: pt.value, default: def, loc: this.loc(pt) });
      if (this.isOp(',')) this.next();
      else break;
    }
    this.expectOp(')');
    this.expectOp('=>');
    const body = this.parseBlock();
    return { kind: 'FuncDef', id: this.id(), loc: this.loc(nameTok), name: nameTok.value, params, body, isMethod };
  }

  // -------------------------------------------------------------------------
  // Expressions (lowest → highest precedence)
  //   ternary  <  or  <  and  <  not  <  comparison  <  additive  <  multiplicative  <  unary  <  postfix
  // -------------------------------------------------------------------------
  parseExpr(): Expr {
    return this.parseTernary();
  }

  private parseTernary(): Expr {
    const test = this.parseOr();
    if (this.isOp('?')) {
      const q = this.next();
      const cons = this.parseTernary();
      this.expectOp(':');
      const alt = this.parseTernary();
      return { kind: 'Ternary', id: this.id(), loc: this.loc(q), test, cons, alt };
    }
    return test;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isKw('or')) {
      const t = this.next();
      const right = this.parseAnd();
      left = { kind: 'Binary', id: this.id(), loc: this.loc(t), op: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isKw('and')) {
      const t = this.next();
      const right = this.parseNot();
      left = { kind: 'Binary', id: this.id(), loc: this.loc(t), op: 'and', left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isKw('not')) {
      const t = this.next();
      const arg = this.parseNot();
      return { kind: 'Unary', id: this.id(), loc: this.loc(t), op: 'not', arg };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (this.peek().type === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(this.peek().value)) {
      const t = this.next();
      const right = this.parseAdditive();
      left = { kind: 'Binary', id: this.id(), loc: this.loc(t), op: t.value, left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const t = this.next();
      const right = this.parseMultiplicative();
      left = { kind: 'Binary', id: this.id(), loc: this.loc(t), op: t.value, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.peek().type === 'op' && ['*', '/', '%'].includes(this.peek().value)) {
      const t = this.next();
      const right = this.parseUnary();
      left = { kind: 'Binary', id: this.id(), loc: this.loc(t), op: t.value, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      this.next();
      const arg = this.parseUnary();
      return { kind: 'Unary', id: this.id(), loc: this.loc(t), op: t.value as '-' | '+', arg };
    }
    if (t.type === 'kw' && t.value === 'not') {
      this.next();
      const arg = this.parseUnary();
      return { kind: 'Unary', id: this.id(), loc: this.loc(t), op: 'not', arg };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      if (this.isOp('(') && (e.kind === 'Ident' || e.kind === 'Member')) {
        e = this.parseCall(e);
      } else if (this.isOp('.')) {
        this.next();
        const p = this.next();
        if (p.type !== 'ident' && p.type !== 'kw') {
          throw new ParseError(`Expected property name after '.' but found ${this.describe(p)}`, this.loc(p));
        }
        e = { kind: 'Member', id: this.id(), loc: this.loc(p), object: e, prop: p.value };
      } else if (this.isOp('[') && this.peek().line === this.lastLine(e)) {
        const b = this.next();
        const index = this.parseExpr();
        this.expectOp(']');
        e = { kind: 'Index', id: this.id(), loc: this.loc(b), object: e, index };
      } else if (this.isOp('<') && (e.kind === 'Ident' || e.kind === 'Member') && this.tryGenericCall()) {
        // generic call such as array.new<float>(0): type args are skipped, loop continues to parse '('
      } else {
        break;
      }
    }
    return e;
  }

  private lastLine(e: Expr): number {
    return e.loc.line;
  }

  /** Detects and consumes `<type, ...>` immediately followed by `(`. */
  private tryGenericCall(): boolean {
    let i = 1;
    let d = 1;
    for (;; i++) {
      const t = this.peek(i);
      if (t.type === 'eof' || t.type === 'newline') return false;
      if (t.type === 'op' && t.value === '<') d++;
      else if (t.type === 'op' && t.value === '>') {
        d--;
        if (d === 0) break;
      } else if (!(t.type === 'ident' || (t.type === 'op' && (t.value === ',' || t.value === '.')))) {
        return false;
      }
    }
    if (!this.isOp('(', i + 1)) return false;
    this.pos += i + 1;
    return true;
  }

  private parseCall(callee: Expr): Expr {
    const open = this.expectOp('(');
    const args: Arg[] = [];
    while (!this.isOp(')')) {
      if (this.peek().type === 'eof') throw new ParseError("Unclosed '(' in call", this.loc(open));
      let name: string | undefined;
      if (this.peek().type === 'ident' && this.isOp('=', 1)) {
        name = this.next().value;
        this.next();
      }
      const value = this.parseExpr();
      args.push({ name, value });
      if (this.isOp(',')) this.next();
      else break;
    }
    this.expectOp(')');
    return { kind: 'Call', id: this.id(), loc: callee.loc, callee, args };
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    switch (t.type) {
      case 'num': {
        this.next();
        return { kind: 'Num', id: this.id(), loc: this.loc(t), value: Number(t.value), raw: t.value };
      }
      case 'str': {
        this.next();
        return { kind: 'Str', id: this.id(), loc: this.loc(t), value: t.value, isColor: t.isColor };
      }
      case 'kw': {
        if (t.value === 'true' || t.value === 'false') {
          this.next();
          return { kind: 'Bool', id: this.id(), loc: this.loc(t), value: t.value === 'true' };
        }
        throw new ParseError(`Unexpected keyword '${t.value}'`, this.loc(t));
      }
      case 'ident': {
        this.next();
        if (t.value === 'na' && !this.isOp('(')) {
          return { kind: 'Na', id: this.id(), loc: this.loc(t) };
        }
        return { kind: 'Ident', id: this.id(), loc: this.loc(t), name: t.value };
      }
      case 'op': {
        if (t.value === '(') {
          this.next();
          const e = this.parseExpr();
          this.expectOp(')');
          return e;
        }
        if (t.value === '[') {
          this.next();
          const elements: Expr[] = [];
          while (!this.isOp(']')) {
            if (this.peek().type === 'eof') throw new ParseError("Unclosed '['", this.loc(t));
            elements.push(this.parseExpr());
            if (this.isOp(',')) this.next();
            else break;
          }
          this.expectOp(']');
          return { kind: 'Tuple', id: this.id(), loc: this.loc(t), elements };
        }
        break;
      }
      default:
        break;
    }
    throw new ParseError(`Unexpected ${this.describe(t)}`, this.loc(t));
  }
}
