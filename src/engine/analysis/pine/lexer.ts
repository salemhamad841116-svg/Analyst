/**
 * Pine Script lexer — indentation-aware tokenizer.
 * Emits NEWLINE / INDENT / DEDENT tokens; newlines inside (), [] are ignored,
 * and lines ending/starting with a binary operator are treated as continuations.
 */

import { Diagnostic } from './ast';

export type TokType = 'num' | 'str' | 'ident' | 'kw' | 'op' | 'newline' | 'indent' | 'dedent' | 'eof';

export interface Token {
  type: TokType;
  value: string;
  line: number;
  col: number;
  /** only for 'str' tokens: true for #RRGGBB colour literals */
  isColor?: boolean;
}

export const KEYWORDS = new Set([
  'if', 'else', 'for', 'to', 'by', 'in', 'while', 'switch',
  'and', 'or', 'not', 'var', 'varip', 'true', 'false', 'break', 'continue',
]);

const THREE_CHAR_OPS: string[] = [];
const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', ':=', '=>', '+=', '-=', '*=', '/=', '%='];
const ONE_CHAR_OPS = '+-*/%<>=?:()[],.;{}';

const CONTINUER_OPS = new Set([
  ',', '+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '?', ':', '=', ':=',
  '+=', '-=', '*=', '/=', '%=',
]);
const CONTINUER_KW = new Set(['and', 'or', 'not']);
const LEADING_CONTINUERS_OPS = new Set(['?', ':', '+', '*', '/', '%', '==', '!=', '<=', '>=']);
const LEADING_CONTINUER_KW = new Set(['and', 'or']);

export interface LexResult {
  tokens: Token[];
  errors: Diagnostic[];
}

export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const errors: Diagnostic[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  const indentStack: number[] = [0];
  let depth = 0; // bracket depth
  let lastSigType: TokType | null = null;
  let lastSigValue = '';

  const push = (t: Token) => {
    tokens.push(t);
    if (t.type !== 'newline' && t.type !== 'indent' && t.type !== 'dedent') {
      lastSigType = t.type;
      lastSigValue = t.value;
    }
  };

  const lastEndsWithContinuer = (): boolean => {
    if (lastSigType === 'op') return CONTINUER_OPS.has(lastSigValue);
    if (lastSigType === 'kw') return CONTINUER_KW.has(lastSigValue);
    return false;
  };

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    const lineNo = ln + 1;

    // Measure indentation (tab = 4 columns)
    let i = 0;
    let indent = 0;
    while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t')) {
      indent += raw[i] === '\t' ? 4 : 1;
      i++;
    }

    // Blank / comment-only lines never affect structure
    if (i >= raw.length || (raw[i] === '/' && raw[i + 1] === '/')) continue;

    // Determine whether this physical line starts a new logical line
    let startsLogicalLine = depth === 0;
    if (startsLogicalLine && tokens.length > 0) {
      const firstWord = /^[A-Za-z_]+/.exec(raw.slice(i))?.[0] ?? '';
      const firstTwo = raw.slice(i, i + 2);
      const firstOne = raw[i];
      const leadingContinuer =
        LEADING_CONTINUER_KW.has(firstWord) ||
        (LEADING_CONTINUERS_OPS.has(firstTwo)) ||
        (LEADING_CONTINUERS_OPS.has(firstOne) && firstTwo !== '//' && firstTwo !== '=>');
      if (lastEndsWithContinuer() || leadingContinuer) startsLogicalLine = false;
    }

    if (startsLogicalLine) {
      if (tokens.length > 0) push({ type: 'newline', value: '\n', line: lineNo - 1, col: 0 });
      const top = indentStack[indentStack.length - 1];
      if (indent > top) {
        indentStack.push(indent);
        push({ type: 'indent', value: '', line: lineNo, col: 1 });
      } else if (indent < top) {
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
          push({ type: 'dedent', value: '', line: lineNo, col: 1 });
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          errors.push({
            severity: 'error', code: 'INCONSISTENT_INDENT', stage: 'SYNTAX',
            message: 'Inconsistent indentation (dedent does not match any outer block)',
            loc: { line: lineNo, col: 1 },
          });
          indentStack[indentStack.length - 1] = indent;
        }
      }
    }

    // Tokenize the rest of the line
    while (i < raw.length) {
      const ch = raw[i];
      const col = i + 1;

      if (ch === ' ' || ch === '\t') { i++; continue; }
      if (ch === '/' && raw[i + 1] === '/') break; // comment to EOL

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(raw[i + 1] || ''))) {
        const m = /^(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(raw.slice(i));
        if (m) {
          push({ type: 'num', value: m[0].replace(/_/g, ''), line: lineNo, col });
          i += m[0].length;
          continue;
        }
      }

      // Identifiers / keywords
      if (/[A-Za-z_]/.test(ch)) {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(raw.slice(i))!;
        push({ type: KEYWORDS.has(m[0]) ? 'kw' : 'ident', value: m[0], line: lineNo, col });
        i += m[0].length;
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        let val = '';
        let closed = false;
        while (j < raw.length) {
          if (raw[j] === '\\' && j + 1 < raw.length) { val += raw[j + 1]; j += 2; continue; }
          if (raw[j] === ch) { closed = true; j++; break; }
          val += raw[j];
          j++;
        }
        if (!closed) {
          errors.push({
            severity: 'error', code: 'UNTERMINATED_STRING', stage: 'SYNTAX',
            message: 'Unterminated string literal', loc: { line: lineNo, col },
          });
        }
        push({ type: 'str', value: val, line: lineNo, col });
        i = j;
        continue;
      }

      // Colour literals  #RRGGBB / #RRGGBBAA
      if (ch === '#') {
        const m = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?/.exec(raw.slice(i));
        if (m) {
          push({ type: 'str', value: m[0], line: lineNo, col, isColor: true });
          i += m[0].length;
          continue;
        }
      }

      // Operators
      const two = raw.slice(i, i + 2);
      if (TWO_CHAR_OPS.includes(two)) {
        push({ type: 'op', value: two, line: lineNo, col });
        i += 2;
        continue;
      }
      if (ONE_CHAR_OPS.includes(ch)) {
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        push({ type: 'op', value: ch, line: lineNo, col });
        i++;
        continue;
      }

      errors.push({
        severity: 'error', code: 'UNEXPECTED_CHARACTER', stage: 'SYNTAX',
        message: `Unexpected character '${ch}'`, loc: { line: lineNo, col },
      });
      i++;
    }
  }

  if (depth !== 0) {
    errors.push({
      severity: 'error', code: 'UNBALANCED_BRACKETS', stage: 'SYNTAX',
      message: 'Unbalanced parentheses/brackets at end of file',
      loc: { line: lines.length, col: 1 },
    });
  }

  const endLine = lines.length;
  if (tokens.length > 0) push({ type: 'newline', value: '\n', line: endLine, col: 0 });
  while (indentStack.length > 1) {
    indentStack.pop();
    push({ type: 'dedent', value: '', line: endLine, col: 1 });
  }
  push({ type: 'eof', value: '', line: endLine, col: 1 });

  void THREE_CHAR_OPS;
  return { tokens, errors };
}

export function extractVersion(source: string): number | null {
  const m = /\/\/\s*@version\s*=\s*(\d+)/.exec(source);
  return m ? parseInt(m[1], 10) : null;
}
