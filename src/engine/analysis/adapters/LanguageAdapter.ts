/**
 * Language adapters. The analysis engine only ever sees the language-neutral AST;
 * each source language plugs in through a LanguageAdapter. Pine Script is the only
 * production adapter today — the others are explicit, honest stubs.
 */

import { Diagnostic, Program } from '../pine/ast';
import { parsePine } from '../pine/parser';

export type SourceLanguage = 'pine' | 'python' | 'mql4' | 'mql5' | 'javascript';

export interface ParseResult {
  language: SourceLanguage;
  supported: boolean;
  program?: Program;
  syntaxErrors: Diagnostic[];
  version: number | null;
  tokenCount: number;
  notImplementedReason?: string;
}

export interface LanguageAdapter {
  language: SourceLanguage;
  displayName: string;
  status: 'PRODUCTION' | 'NOT_IMPLEMENTED';
  parse(code: string): ParseResult;
}

export const PineAdapter: LanguageAdapter = {
  language: 'pine',
  displayName: 'Pine Script (v4–v6)',
  status: 'PRODUCTION',
  parse(code: string): ParseResult {
    const out = parsePine(code);
    return {
      language: 'pine',
      supported: true,
      program: out.program,
      syntaxErrors: out.syntaxErrors,
      version: out.program.version,
      tokenCount: out.tokenCount,
    };
  },
};

function stub(language: SourceLanguage, displayName: string): LanguageAdapter {
  return {
    language,
    displayName,
    status: 'NOT_IMPLEMENTED',
    parse(): ParseResult {
      return {
        language,
        supported: false,
        syntaxErrors: [],
        version: null,
        tokenCount: 0,
        notImplementedReason: `${displayName} adapter is not implemented yet (Pine Script is the production language in this phase)`,
      };
    },
  };
}

export const PythonAdapter = stub('python', 'Python');
export const MQL4Adapter = stub('mql4', 'MQL4');
export const MQL5Adapter = stub('mql5', 'MQL5');
export const JavaScriptAdapter = stub('javascript', 'JavaScript');

const REGISTRY: Record<SourceLanguage, LanguageAdapter> = {
  pine: PineAdapter,
  python: PythonAdapter,
  mql4: MQL4Adapter,
  mql5: MQL5Adapter,
  javascript: JavaScriptAdapter,
};

export function getAdapter(language: SourceLanguage): LanguageAdapter {
  return REGISTRY[language];
}

export function listAdapters(): { language: SourceLanguage; displayName: string; status: string }[] {
  return Object.values(REGISTRY).map(a => ({ language: a.language, displayName: a.displayName, status: a.status }));
}
