/**
 * Logical contradiction detection (Stage 6) and Entry/Exit reachability.
 *
 * Every signal sink (entry / exit / plotshape / alertcondition ...) is turned into a
 * boolean formula: enclosing `if` guards ∧ the call's own condition. The constraint engine
 * then decides, from the code's own logic:
 *   - can this signal ever fire?                   (UNSATISFIABLE_SIGNAL)
 *   - can BUY and SELL both be true on one bar?    (BUY_SELL_OVERLAP)
 *   - is the sink located in dead code?            (ENTRY_UNREACHABLE)
 *   - is there any way to leave a position?        (NO_EXIT_PATH)
 */

import { Diagnostic, Loc } from '../pine/ast';
import { CfgReport } from './cfg';
import { FormulaBuilder, Sat, andFormula, guardsFormula, satisfiable } from './constraints';
import { DataFlowReport, Sink } from './dataFlow';
import { ScriptKind, SymbolTable } from './symbolTable';

export type LogicIssueCode =
  | 'BUY_SELL_OVERLAP'
  | 'BUY_SELL_UNPROVEN'
  | 'UNSATISFIABLE_SIGNAL'
  | 'ENTRY_UNREACHABLE'
  | 'EXIT_NEVER_FIRES'
  | 'NO_EXIT_PATH';

export interface LogicIssue {
  code: LogicIssueCode;
  severity: 'error' | 'warning';
  message: string;
  loc?: Loc;
  sinkIds: number[];
  witness?: string[];
}

export interface SinkSat {
  sinkId: number;
  callee: string;
  direction: string;
  role: string;
  result: Sat;
  cfgDead: boolean;
  reachable: boolean;
  witness?: string[];
}

export interface OverlapCheck {
  buySinkId: number;
  sellSinkId: number;
  result: Sat;
  witness?: string[];
}

export interface LogicReport {
  sinkSat: SinkSat[];
  overlapChecks: OverlapCheck[];
  issues: LogicIssue[];
  contradictionCount: number;
  entryReachability: { total: number; reachable: number; unreachableSinkIds: number[] };
  exitMechanisms: string[];
  diagnostics: Diagnostic[];
}

export function analyzeLogic(
  table: SymbolTable,
  cfg: CfgReport,
  flow: DataFlowReport,
  scriptKind: ScriptKind,
): LogicReport {
  const fb = new FormulaBuilder(table);
  const issues: LogicIssue[] = [];
  const sinkSat: SinkSat[] = [];
  const formulaOf = new Map<number, ReturnType<typeof guardsFormula>>();

  for (const s of flow.sinks) {
    const f = guardsFormula(fb, s.guards, s.conditionExprs);
    formulaOf.set(s.id, f);
    const sat = satisfiable(f);
    const cfgDead = cfg.deadStmtIds.has(s.stmtId);
    sinkSat.push({
      sinkId: s.id, callee: s.callee, direction: s.direction, role: s.role,
      result: sat.result, cfgDead, reachable: !cfgDead && sat.result !== 'UNSAT', witness: sat.witness,
    });

    if (sat.result === 'UNSAT') {
      if (s.role === 'EXIT') {
        issues.push({
          code: 'EXIT_NEVER_FIRES', severity: 'warning', loc: s.loc, sinkIds: [s.id],
          message: `${s.callee}() at line ${s.loc.line} can never execute — its guard conditions are contradictory`,
        });
      } else {
        issues.push({
          code: 'UNSATISFIABLE_SIGNAL', severity: 'error', loc: s.loc, sinkIds: [s.id],
          message: `${s.callee}() at line ${s.loc.line} (${s.direction}) can never fire — its conditions are mutually contradictory`,
        });
      }
    }
  }

  const byId = new Map<number, SinkSat>(sinkSat.map(x => [x.sinkId, x]));
  const live = (s: Sink) => byId.get(s.id)!.reachable;

  // BUY ∧ SELL overlap
  const overlapChecks: OverlapCheck[] = [];
  const buys = flow.sinks.filter(s => s.direction === 'BUY' && (s.role === 'ENTRY' || s.role === 'SIGNAL') && live(s));
  const sells = flow.sinks.filter(s => s.direction === 'SELL' && (s.role === 'ENTRY' || s.role === 'SIGNAL') && live(s));
  for (const b of buys) {
    for (const s of sells) {
      if (b.funcName !== s.funcName) continue; // different call contexts cannot be compared statically
      const both = satisfiable(andFormula(formulaOf.get(b.id)!, formulaOf.get(s.id)!));
      overlapChecks.push({ buySinkId: b.id, sellSinkId: s.id, result: both.result, witness: both.witness });
      if (both.result === 'SAT') {
        issues.push({
          code: 'BUY_SELL_OVERLAP', severity: 'error', loc: b.loc, sinkIds: [b.id, s.id], witness: both.witness,
          message:
            `BUY (line ${b.loc.line}) and SELL (line ${s.loc.line}) can be true on the same bar with no priority logic ` +
            `— satisfied e.g. when: ${(both.witness ?? []).join(' ∧ ') || '(always)'}`,
        });
      } else if (both.result === 'UNKNOWN') {
        issues.push({
          code: 'BUY_SELL_UNPROVEN', severity: 'warning', loc: b.loc, sinkIds: [b.id, s.id],
          message: `Could not prove BUY (line ${b.loc.line}) and SELL (line ${s.loc.line}) are mutually exclusive (formula too complex)`,
        });
      }
    }
  }

  // Entry reachability
  const entries = flow.sinks.filter(s => s.role === 'ENTRY');
  const reachableEntries = entries.filter(live);
  const unreachableSinkIds = entries.filter(e => !live(e)).map(e => e.id);
  if (scriptKind === 'strategy' && entries.length > 0 && reachableEntries.length === 0) {
    issues.push({
      code: 'ENTRY_UNREACHABLE', severity: 'error', sinkIds: unreachableSinkIds,
      message: 'Every entry order is unreachable (dead code or impossible conditions) — the strategy can never open a position',
    });
  }

  // Exit mechanisms
  const exitMechanisms: string[] = [];
  for (const s of flow.sinks.filter(x => x.role === 'EXIT' && live(x))) {
    exitMechanisms.push(`${s.callee}() at line ${s.loc.line}${s.hasBracketExit ? ' (stop/target bracket)' : ''}`);
  }
  const buyEntryLive = reachableEntries.some(e => e.direction === 'BUY');
  const sellEntryLive = reachableEntries.some(e => e.direction === 'SELL');
  if (buyEntryLive && sellEntryLive) exitMechanisms.push('reversal via opposite-direction entry');
  if (scriptKind === 'strategy' && reachableEntries.length > 0 && exitMechanisms.length === 0) {
    issues.push({
      code: 'NO_EXIT_PATH', severity: 'warning', sinkIds: [],
      message: 'Entries are reachable but there is no reachable exit (strategy.exit/close or an opposite entry) — positions would never close',
    });
  }

  const diagnostics: Diagnostic[] = issues.map(i => ({
    severity: i.severity, code: i.code, message: i.message, loc: i.loc, stage: 'LOGIC_CONTRADICTION',
  }));

  return {
    sinkSat,
    overlapChecks,
    issues,
    contradictionCount: issues.filter(i => i.severity === 'error' && (i.code === 'BUY_SELL_OVERLAP' || i.code === 'UNSATISFIABLE_SIGNAL')).length,
    entryReachability: { total: entries.length, reachable: reachableEntries.length, unreachableSinkIds },
    exitMechanisms,
    diagnostics,
  };
}
