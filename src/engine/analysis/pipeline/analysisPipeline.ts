/**
 * Mandatory analysis pipeline — Phase 1 implements stages 1–7 (static analysis).
 * Stages 8–13 are explicit PENDING placeholders and stage 14 (final verification) can never
 * report FINAL_VERIFIED until every mandatory stage has run and passed for this analysisId.
 *
 *   1 Syntax Validation          8  Historical Data Validation   (Phase 3)
 *   2 AST / Symbol Resolution    9  Backtest                     (Phase 3)
 *   3 Semantic Validation       10  Cost Adjustment              (Phase 3)
 *   4 Data Flow Analysis        11  OOS / Walk-Forward / Blind   (Phase 3)
 *   5 Control Flow Analysis     12  Risk & Performance           (Phase 4)
 *   6 Logical Contradiction     13  Robustness / Sensitivity     (Phases 5–6)
 *   7 Strategy Classification   14  Final Verification
 */

import { sha256Hex } from '../../../services/pineCompilerEngine';
import { Diagnostic } from '../pine/ast';
import { SourceLanguage, getAdapter } from '../adapters/LanguageAdapter';
import { CfgReport, buildCfg } from '../static/cfg';
import { ClassificationResult, classifyStrategy } from '../static/classifier';
import { PineInterpreter, BacktestTrade } from '../backtest/interpreter';
import { evaluateOverfitting } from '../risk/overfitting';
import { runMonteCarloSimulation } from '../risk/montecarlo';
import { calculatePerformanceMetrics } from '../risk/performance';
import { runWalkForwardOptimization } from '../risk/walkforward';
import { detectRegimes, analyzeRegimePerformance } from '../risk/regimeDetector';
import { analyzeMultiStrategy } from '../risk/multiStrategy';
import { computeRobustnessScore } from '../risk/robustnessScore';
import { generateExplanation } from '../risk/explanation';

import { applyCostsToTrade, DEFAULT_PROFILES } from '../backtest/costs';

import { DependencyGraph, buildDependencyGraph } from '../static/dependencyGraph';
import { DataFlowReport, analyzeDataFlow } from '../static/dataFlow';
import { LogicReport, analyzeLogic } from '../static/logic';
import { ScriptKind, SymbolTable, buildSymbolTable, validateSemantics } from '../static/symbolTable';
import {
  FinalVerification, PhaseRecord, StageStatus, detectCrossRunContamination, evaluateFinalVerification, makeRecord,
} from './phaseRecord';

export const STAGES = [
  { id: 'SYNTAX', n: 1, name: 'Syntax Validation', nameAr: 'التحقق من الصياغة' },
  { id: 'AST_SYMBOLS', n: 2, name: 'AST / Symbol Resolution', nameAr: 'شجرة AST وجدول الرموز' },
  { id: 'SEMANTIC', n: 3, name: 'Semantic Validation', nameAr: 'التحقق الدلالي' },
  { id: 'DATA_FLOW', n: 4, name: 'Data Flow Analysis', nameAr: 'تحليل تدفق البيانات' },
  { id: 'CONTROL_FLOW', n: 5, name: 'Control Flow Analysis', nameAr: 'تحليل تدفق التحكم (CFG)' },
  { id: 'LOGIC_CONTRADICTION', n: 6, name: 'Logical Contradiction Check', nameAr: 'فحص التناقض المنطقي' },
  { id: 'CLASSIFICATION', n: 7, name: 'Strategy Classification', nameAr: 'تصنيف الاستراتيجية' },
  { id: 'HISTORICAL_DATA', n: 8, name: 'Historical Data Validation', nameAr: 'التحقق من البيانات التاريخية' },
  { id: 'BACKTEST', n: 9, name: 'Backtest', nameAr: 'الاختبار الخلفي' },
  { id: 'COST_ADJUSTMENT', n: 10, name: 'Cost Adjustment', nameAr: 'تعديل التكاليف' },
  { id: 'OOS_WALK_FORWARD', n: 11, name: 'OOS / Walk-Forward / Blind', nameAr: 'خارج العينة / Walk-Forward / Blind' },
  { id: 'RISK_PERFORMANCE', n: 12, name: 'Risk & Performance Analysis', nameAr: 'تحليل المخاطر والأداء' },
  { id: 'ROBUSTNESS', n: 13, name: 'Robustness / Sensitivity', nameAr: 'المتانة والحساسية' },
  { id: 'FINAL_VERIFICATION', n: 14, name: 'Final Verification', nameAr: 'التحقق النهائي' },
] as const;

export const PHASE1_STAGE_IDS = STAGES.slice(0, 7).map(s => s.id);
export const ALL_MANDATORY_STAGE_IDS = STAGES.slice(0, 13).map(s => s.id);

export const DATASET_HASH_NOT_APPLICABLE = 'NOT_APPLICABLE_STATIC_PHASE';

export interface SymbolSummary {
  name: string;
  kind: string;
  line: number;
  col: number;
  scope: string;
  refCount: number;
  reassignCount: number;
  inputType?: string;
  inputDefault?: string;
}

export interface StaticAnalysisReport {
  analysisId: string;
  strategyHash: string;
  datasetHash: string;
  language: SourceLanguage;
  scriptKind: ScriptKind;
  pineVersion: number | null;

  syntaxErrors: Diagnostic[];
  unresolvedIdentifiers: string[];
  unresolvedDetails: { name: string; line: number; col: number; code: string }[];
  unusedVariables: string[];
  semanticErrors: Diagnostic[];
  warnings: Diagnostic[];
  diagnostics: Diagnostic[];

  symbolTable: SymbolSummary[];
  dependencyGraph: {
    nodes: DependencyGraph['nodes'];
    edges: { from: string; to: string; kind: string; viaHistory: boolean; reassign: boolean }[];
    cycles: DependencyGraph['cycles'];
    topoOrder: string[];
  };
  dataFlow: DataFlowReport;
  cfg: {
    stats: CfgReport['stats'];
    units: { name: string; nodes: number; edges: number; infeasibleEdges: number; reachableNodes: number }[];
    deadRegions: CfgReport['deadRegions'];
    unreachableConditions: CfgReport['unreachableConditions'];
  };
  logic: LogicReport;
  classification: ClassificationResult;

  stages: PhaseRecord[];
  staticStatus: 'STATIC_ANALYSIS_PASS' | 'BLOCKED';
  blockingCode?: string;
  blockingReason?: string;
  finalVerification: FinalVerification;
  crossRunContamination: number;
  runtimeMs: number;
  generatedAt: string;
}

export interface PipelineOptions {
  analysisId?: string;
  language?: SourceLanguage;
  datasetHash?: string;
  candles?: import('../../../types').Candle[];
  costProfile?: import('../backtest/costs').CostProfile;
}

const sevOf = (ds: Diagnostic[], s: Diagnostic['severity']) => ds.filter(d => d.severity === s);

export function runStaticAnalysisPipeline(code: string, opts: PipelineOptions = {}): StaticAnalysisReport {
  const t0 = Date.now();
  const language = opts.language ?? 'pine';
  const strategyHash = sha256Hex(code);
  const analysisId = opts.analysisId ?? `SA-${strategyHash.slice(0, 12)}-${t0.toString(36)}`;
  const datasetHash = opts.datasetHash ?? DATASET_HASH_NOT_APPLICABLE;

  const records: PhaseRecord[] = [];
  const stageDef = (id: string) => STAGES.find(s => s.id === id)!;

  const record = (
    id: string, status: StageStatus, reason: string, metrics: Record<string, unknown>,
    started: number, blockingCode?: string,
  ) => {
    const def = stageDef(id);
    const finished = Date.now();
    records.push(makeRecord({
      stageId: id, stageNumber: def.n, stageName: def.name,
      analysisId, strategyHash, datasetHash, status, blockingCode, reason, metrics,
      startedAt: new Date(started).toISOString(), finishedAt: new Date(finished).toISOString(),
      runtimeMs: finished - started,
    }));
  };

  const pendingRest = (fromIndex: number, reason: string) => {
    for (const s of STAGES.slice(fromIndex, 13)) {
      const t = Date.now();
      record(s.id, 'PENDING', reason, { skipped: true }, t);
    }
  };

  const emptyFlow: DataFlowReport = {
    sinks: [], paths: [], signalMode: 'NONE', entrySinkCount: 0, exitSinkCount: 0, buyCount: 0, sellCount: 0, diagnostics: [],
  };
  const emptyLogic: LogicReport = {
    sinkSat: [], overlapChecks: [], issues: [], contradictionCount: 0,
    entryReachability: { total: 0, reachable: 0, unreachableSinkIds: [] }, exitMechanisms: [], diagnostics: [],
  };
  const emptyClass: ClassificationResult = { primary: 'Unclassified', hybridOf: [], scores: [], evidence: [], rationale: 'Not run' };

  const finish = (partial: Partial<StaticAnalysisReport>, blocking?: { code: string; reason: string }): StaticAnalysisReport => {
    // Stage 14
    const t = Date.now();
    const prior = records.filter(r => r.stageNumber <= 13);
    const fv = evaluateFinalVerification(prior, { analysisId, strategyHash }, ALL_MANDATORY_STAGE_IDS);
    record(
      'FINAL_VERIFICATION',
      fv.status === 'BLOCKED' ? 'FAIL' : 'PENDING',
      fv.reason,
      { failedStages: fv.failedStages, pendingStages: fv.pendingStages, contaminated: fv.contaminatedRecords },
      t,
      fv.status === 'BLOCKED' ? fv.blockingCode : undefined,
    );
    const fvFinal = evaluateFinalVerification(records, { analysisId, strategyHash }, ALL_MANDATORY_STAGE_IDS);

    const failed = records.find(r => r.status === 'FAIL' && r.stageNumber <= 13);
    const blockingCode = blocking?.code ?? failed?.blockingCode;
    const blockingReason = blocking?.reason ?? failed?.reason;
    const diagnostics = partial.diagnostics ?? [];

    return {
      analysisId, strategyHash, datasetHash, language,
      scriptKind: 'unknown', pineVersion: null,
      syntaxErrors: [], unresolvedIdentifiers: [], unresolvedDetails: [], unusedVariables: [],
      semanticErrors: [], warnings: sevOf(diagnostics, 'warning'), diagnostics,
      symbolTable: [],
      dependencyGraph: { nodes: [], edges: [], cycles: [], topoOrder: [] },
      dataFlow: emptyFlow,
      cfg: { stats: { units: 0, nodes: 0, edges: 0, branches: 0, loops: 0, deadBlocks: 0 }, units: [], deadRegions: [], unreachableConditions: [] },
      logic: emptyLogic,
      classification: emptyClass,
      ...partial,
      stages: records.slice().sort((a, b) => a.stageNumber - b.stageNumber),
      staticStatus: records.some(r => r.status === 'FAIL' && r.stageNumber <= 7) ? 'BLOCKED' : 'STATIC_ANALYSIS_PASS',
      blockingCode, blockingReason,
      finalVerification: fvFinal,
      crossRunContamination: detectCrossRunContamination(records, { analysisId, strategyHash }),
      runtimeMs: Date.now() - t0,
      generatedAt: new Date().toISOString(),
    };
  };

  // ------------------------------------------------------------------ Stage 1
  let tS = Date.now();
  const adapter = getAdapter(language);
  const parsed = adapter.parse(code);

  if (!parsed.supported || !parsed.program) {
    record('SYNTAX', 'FAIL', parsed.notImplementedReason ?? 'Unsupported language', { language }, tS, 'BLOCKED_UNSUPPORTED_LANGUAGE');
    pendingRest(1, 'Not executed: Stage 1 failed');
    return finish({}, { code: 'BLOCKED_UNSUPPORTED_LANGUAGE', reason: parsed.notImplementedReason ?? 'Unsupported language' });
  }

  const syntaxErrors = parsed.syntaxErrors;
  if (syntaxErrors.length > 0) {
    const first = syntaxErrors[0];
    record('SYNTAX', 'FAIL',
      `${syntaxErrors.length} syntax error(s); first at ${first.loc?.line}:${first.loc?.col}: ${first.message}`,
      { syntaxErrors: syntaxErrors.length, tokenCount: parsed.tokenCount }, tS, 'BLOCKED_SYNTAX_ERRORS');
    pendingRest(1, 'Not executed: Stage 1 failed');
    return finish({ syntaxErrors, diagnostics: syntaxErrors, pineVersion: parsed.version });
  }
  record('SYNTAX', 'PASS', 'No syntax errors', { syntaxErrors: 0, tokenCount: parsed.tokenCount }, tS);

  const program = parsed.program;

  // ------------------------------------------------------------------ Stage 2
  tS = Date.now();
  const table: SymbolTable = buildSymbolTable(program);
  const graph = buildDependencyGraph(program, table);
  const stage2Diags = table.diagnostics.filter(d => d.stage === 'AST_SYMBOLS');
  const unresolvedNames = [...new Set(table.unresolved.map(u => u.name))];
  const unusedVariables = table.diagnostics.filter(d => d.code === 'UNUSED_VARIABLE').map(d => /'(.+?)'/.exec(d.message)?.[1] ?? '');
  const hasCycles = graph.cycles.length > 0;
  const stage2Fail = unresolvedNames.length > 0 || hasCycles;
  const unresolvedDiags: Diagnostic[] = table.unresolved.map(u => ({
    severity: 'error', code: u.code,
    message: u.code === 'FORWARD_REFERENCE'
      ? `Function '${u.name}' is used before it is declared`
      : u.code === 'UNDECLARED_REASSIGNMENT'
        ? `'${u.name}' is reassigned with ':=' but was never declared`
        : `Undefined identifier '${u.name}'`,
    loc: u.loc, stage: 'AST_SYMBOLS',
  }));
  const cycleDiags: Diagnostic[] = graph.cycles.map(c => ({
    severity: 'error', code: 'CIRCULAR_DEPENDENCY', stage: 'AST_SYMBOLS',
    message: `Circular ${c.kind} dependency: ${c.members.join(' → ')}`,
  }));
  record(
    'AST_SYMBOLS',
    stage2Fail ? 'FAIL' : 'PASS',
    stage2Fail
      ? unresolvedNames.length > 0
        ? `Unresolved identifiers (${unresolvedNames.length}): ${unresolvedNames.slice(0, 8).join(', ')}`
        : `Circular dependencies detected: ${graph.cycles.map(c => c.members.join('→')).join('; ')}`
      : 'All identifiers resolved; dependency graph is acyclic',
    {
      unresolvedIdentifiers: unresolvedNames.length,
      symbols: table.symbols.length,
      scopes: table.scopes.length,
      dependencyEdges: graph.edges.length,
      cycles: graph.cycles.length,
      unusedVariables: unusedVariables.length,
      callSites: table.calls.length,
    },
    tS,
    stage2Fail ? (unresolvedNames.length > 0 ? 'BLOCKED_UNRESOLVED_IDENTIFIERS' : 'BLOCKED_CIRCULAR_DEPENDENCY') : undefined,
  );

  // ------------------------------------------------------------------ Stage 3
  tS = Date.now();
  const sem = validateSemantics(program, table);
  const semanticDiags = [...table.diagnostics.filter(d => d.stage === 'SEMANTIC'), ...sem.diagnostics];
  const semanticErrors = sevOf(semanticDiags, 'error');
  record(
    'SEMANTIC',
    semanticErrors.length ? 'FAIL' : 'PASS',
    semanticErrors.length
      ? `${semanticErrors.length} semantic error(s); first: ${semanticErrors[0].message}${semanticErrors[0].loc ? ` (line ${semanticErrors[0].loc.line})` : ''}`
      : `Semantically valid ${sem.scriptKind} (${sevOf(semanticDiags, 'warning').length} warning(s))`,
    { scriptKind: sem.scriptKind, errors: semanticErrors.length, warnings: sevOf(semanticDiags, 'warning').length, version: sem.version },
    tS,
    semanticErrors.length ? 'BLOCKED_SEMANTIC_ERRORS' : undefined,
  );

  // ------------------------------------------------------------------ Stage 4
  tS = Date.now();
  const flow = analyzeDataFlow(table, graph, sem.scriptKind);
  const flowErrors = sevOf(flow.diagnostics, 'error');
  const noSignals = sem.scriptKind !== 'strategy' && flow.sinks.length === 0;
  record(
    'DATA_FLOW',
    flowErrors.length ? 'FAIL' : noSignals ? 'NOT_APPLICABLE' : 'PASS',
    flowErrors.length
      ? flowErrors[0].message
      : noSignals
        ? `${sem.scriptKind} has no explicit BUY/SELL/EXIT sinks — data flow to signals not applicable`
        : `${flow.sinks.length} signal sink(s) traced to market data (${flow.buyCount} BUY, ${flow.sellCount} SELL, ${flow.exitSinkCount} EXIT)`,
    {
      sinks: flow.sinks.length, buy: flow.buyCount, sell: flow.sellCount, exits: flow.exitSinkCount,
      signalMode: flow.signalMode, pathsReachingMarketData: flow.paths.filter(p => p.reachesMarketData).length,
    },
    tS,
    flowErrors.length ? 'BLOCKED_NO_SIGNAL_SINKS' : undefined,
  );

  // ------------------------------------------------------------------ Stage 5
  tS = Date.now();
  const cfg = buildCfg(program, table);
  const cfgWarnings: Diagnostic[] = [
    ...cfg.deadRegions.map(d => ({
      severity: 'warning' as const, code: 'DEAD_CODE', stage: 'CONTROL_FLOW', loc: d.loc,
      message: `Dead code in ${d.unit}: ${d.reason}`,
    })),
    ...cfg.unreachableConditions.map(u => ({
      severity: 'warning' as const, code: 'UNREACHABLE_CONDITION', stage: 'CONTROL_FLOW', loc: u.loc,
      message: `${u.detail}: ${u.text}`,
    })),
  ];
  record(
    'CONTROL_FLOW', 'PASS',
    `CFG built for ${cfg.stats.units} unit(s): ${cfg.stats.nodes} nodes, ${cfg.stats.edges} edges, ` +
      `${cfg.deadRegions.length} dead region(s), ${cfg.unreachableConditions.length} unreachable condition(s)`,
    { ...cfg.stats, unreachableConditions: cfg.unreachableConditions.length },
    tS,
  );

  // ------------------------------------------------------------------ Stage 6
  tS = Date.now();
  const logic = analyzeLogic(table, cfg, flow, sem.scriptKind);
  const logicErrors = logic.issues.filter(i => i.severity === 'error');
  const contradictory = logicErrors.find(i => i.code === 'BUY_SELL_OVERLAP' || i.code === 'UNSATISFIABLE_SIGNAL');
  const unreachableEntry = logicErrors.find(i => i.code === 'ENTRY_UNREACHABLE');
  const logicNA = flow.sinks.length === 0;
  record(
    'LOGIC_CONTRADICTION',
    logicErrors.length ? 'FAIL' : logicNA ? 'NOT_APPLICABLE' : 'PASS',
    logicErrors.length
      ? logicErrors[0].message
      : logicNA
        ? 'No signal sinks to check'
        : `No contradictions: ${logic.overlapChecks.length} BUY×SELL pair(s) proven mutually exclusive; ${logic.entryReachability.reachable}/${logic.entryReachability.total} entries reachable`,
    {
      contradictions: logic.contradictionCount,
      overlapChecks: logic.overlapChecks.length,
      overlapsFound: logic.overlapChecks.filter(o => o.result === 'SAT').length,
      entriesReachable: logic.entryReachability.reachable,
      entriesTotal: logic.entryReachability.total,
      exitMechanisms: logic.exitMechanisms,
    },
    tS,
    contradictory ? 'BLOCKED_LOGICAL_CONTRADICTION' : unreachableEntry ? 'BLOCKED_ENTRY_UNREACHABLE' : undefined,
  );

  // ------------------------------------------------------------------ Stage 7
  tS = Date.now();
  const classification = classifyStrategy(program, table);
  record(
    'CLASSIFICATION', 'PASS',
    `${classification.primary}${classification.hybridOf.length ? ` (${classification.hybridOf.join(' + ')})` : ''} — ${classification.rationale}`,
    { primary: classification.primary, hybridOf: classification.hybridOf, evidenceItems: classification.evidence.length, top: classification.scores.slice(0, 3) },
    tS,
  );

  
  // ------------------------------------------------------------------ Stage 8: Historical Data Validation
  tS = Date.now();
  if (!opts.candles || opts.candles.length === 0) {
    record('HISTORICAL_DATA', 'FAIL', 'No historical data provided for backtest', { bars: 0 }, tS, 'BLOCKED_INCOMPLETE_HISTORICAL_DATA');
    pendingRest(8, 'Not executed: Missing historical data');
  } else {
    record('HISTORICAL_DATA', 'PASS', `Loaded ${opts.candles.length} historical bars`, { bars: opts.candles.length }, tS);
    
    // ------------------------------------------------------------------ Stage 9: Backtest
    tS = Date.now();
    let backtestDiags = [];
    let trades: BacktestTrade[] = [];
    let btError = false;
    try {
      const interpreter = new PineInterpreter(program, opts.candles);
      interpreter.run();
      backtestDiags = interpreter.diagnostics;
      trades = interpreter.trades;
      
      const errors = sevOf(backtestDiags, 'error');
      if (errors.length > 0) {
        btError = true;
        record('BACKTEST', 'FAIL', `Backtest failed: ${errors[0].message}`, { errors: errors.length }, tS, 'BLOCKED_BACKTEST_FAILURE');
      } else {
        const grossPnL = trades.reduce((sum: number, t: BacktestTrade) => sum + t.grossPnL, 0);
        record('BACKTEST', 'PASS', `Backtest completed successfully. Executed ${trades.length} trades. Gross PnL: ${grossPnL.toFixed(4)}`, 
          { trades: trades.length, grossPnL }, tS);
      }
    } catch (e: any) {
      btError = true;
      record('BACKTEST', 'FAIL', `Runtime Exception: ${e.message}`, {}, tS, 'BLOCKED_BACKTEST_FAILURE');
    }

    if (btError) {
       pendingRest(9, 'Not executed: Backtest failed');
    } else {
      // ------------------------------------------------------------------ Stage 10: Cost Adjustment
      tS = Date.now();
      const profile = opts.costProfile || DEFAULT_PROFILES['DEFAULT'];
      const netTrades = trades.map((t: BacktestTrade) => applyCostsToTrade(t, profile));
      const netPnL = netTrades.reduce((sum: number, t: any) => sum + (t as any).netPnL, 0);
      const grossPnL = trades.reduce((sum: number, t: BacktestTrade) => sum + t.grossPnL, 0);
      
      record('COST_ADJUSTMENT', 'PASS', `Applied costs. Gross: ${grossPnL.toFixed(4)}, Net: ${netPnL.toFixed(4)}`, 
        { profile, grossPnL, netPnL, costImpact: grossPnL - netPnL }, tS);

      // ------------------------------------------------------------------ Stage 11: OOS / Walk-Forward Optimization
      tS = Date.now();
      let wfResult: any = undefined;
      try {
        wfResult = runWalkForwardOptimization(program, opts.candles!, {
          trainRatio: 0.7,
          numFolds: 3,
          objectiveMetric: 'sharpeRatio',
          costProfile: profile
        });

        const wfMetrics = {
          folds: wfResult.folds.length,
          avgTrainMetric: wfResult.averageTrainMetric,
          avgOosMetric: wfResult.averageOosMetric,
          avgDegradation: wfResult.averageDegradation,
          worstOosFold: wfResult.worstOosFold,
          bestParams: wfResult.bestParamsOverall,
          dataLeakageDetected: wfResult.dataLeakageDetected,
          objectiveMetric: wfResult.objectiveMetric
        };

        if (wfResult.status === 'FAIL') {
          record('OOS_WALK_FORWARD', 'FAIL', wfResult.reason, wfMetrics as any, tS,
            wfResult.dataLeakageDetected ? 'BLOCKED_DATA_LEAKAGE' : 'BLOCKED_WALK_FORWARD_DEGRADATION');
        } else {
          record('OOS_WALK_FORWARD', 'PASS', wfResult.reason, wfMetrics as any, tS);
        }
      } catch (e: any) {
        record('OOS_WALK_FORWARD', 'FAIL', `Walk-Forward Exception: ${e.message}`, {}, tS, 'BLOCKED_WALK_FORWARD_FAILURE');
      }

      // ------------------------------------------------------------------ Stage 12: Risk & Performance
      tS = Date.now();
      try {
        const metrics = calculatePerformanceMetrics(netTrades as any);
        if (metrics.totalTrades === 0) {
           record('RISK_PERFORMANCE', 'FAIL', 'No trades generated; cannot compute risk metrics', metrics as unknown as Record<string, unknown>, tS, 'BLOCKED_NO_TRADES');
           pendingRest(12, 'Not executed: No trades for risk assessment');
        } else {
           record('RISK_PERFORMANCE', 'PASS', `WinRate: ${metrics.winRate.toFixed(1)}%, PF: ${metrics.profitFactor.toFixed(2)}, MaxDD: ${metrics.maxDrawdownPct.toFixed(2)}%`, metrics as unknown as Record<string, unknown>, tS);
           // ------------------------------------------------------------------ Stage 13: Robustness / Sensitivity (MC & Overfitting + Regime + Multi + Score + Explanation)
           tS = Date.now();
           try {
              const overfitResult = evaluateOverfitting(program, netTrades as any);
              const seed = 12345;
              const mcResults = runMonteCarloSimulation(netTrades as any, { seed, numSimulations: 500 });
              
              // Phase 8: Regime Detection
              const regimeSegments = detectRegimes(opts.candles!);
              const regimeReport = analyzeRegimePerformance(opts.candles!, netTrades as any, regimeSegments);
              
              // Phase 9: Multi-Strategy Analysis
              const multiReport = analyzeMultiStrategy(netTrades as any, opts.candles!.length);
              
              // Phase 10: Robustness Score 0-100
              const robustnessScore = computeRobustnessScore({
                tradeCount: trades.length,
                performance: metrics,
                monteCarlo: mcResults,
                overfitting: overfitResult,
                walkForward: wfResult,
                regime: regimeReport,
                multiStrategy: multiReport
              });
              
              // Phase 13: LLM Explanation
              const explanation = generateExplanation({
                strategyName: undefined,
                classification: undefined,
                tradeCount: trades.length,
                performance: metrics,
                robustness: robustnessScore,
                regime: regimeReport,
                multiStrategy: multiReport,
                overfitting: overfitResult
              });

              const combinedMetrics = {
                ...mcResults,
                ...overfitResult,
                regime: {
                  dominant: regimeReport.dominantRegime,
                  worst: regimeReport.worstRegime,
                  stability: regimeReport.regimeStabilityScore,
                  performance: regimeReport.performance
                },
                multiStrategy: multiReport,
                robustnessScore: {
                  total: robustnessScore.totalScore,
                  grade: robustnessScore.grade,
                  breakdown: {
                    backtest: robustnessScore.backtestScore,
                    risk: robustnessScore.riskScore,
                    monteCarlo: robustnessScore.monteCarloScore,
                    overfitting: robustnessScore.overfittingScore,
                    walkForward: robustnessScore.walkForwardScore,
                    regime: robustnessScore.regimeScore,
                    signalQuality: robustnessScore.signalQualityScore
                  }
                },
                explanation: {
                  verdict: explanation.verdict,
                  verdictAr: explanation.verdictAr,
                  sectionsEn: explanation.sectionsEn,
                  sectionsAr: explanation.sectionsAr,
                  recommendations: explanation.recommendations,
                  recommendationsAr: explanation.recommendationsAr
                }
              };

              if (overfitResult.overfitRiskScore > 60) {
                 record('ROBUSTNESS', 'FAIL', overfitResult.warningMessage || 'Critical Overfitting Risk', combinedMetrics as any, tS, 'BLOCKED_OVERFITTING_RISK');
              } else if (mcResults.pRuin > 10) {
                 record('ROBUSTNESS', 'FAIL', `Strategy failed robustness: P(Ruin) is ${mcResults.pRuin.toFixed(1)}% (>10% limit)`, combinedMetrics as any, tS, 'BLOCKED_HIGH_RUIN_PROBABILITY');
              } else if (mcResults.worstDrawdown95 > 50) {
                 record('ROBUSTNESS', 'FAIL', `Strategy failed robustness: 95% Worst DD is ${mcResults.worstDrawdown95.toFixed(1)}% (>50% limit)`, combinedMetrics as any, tS, 'BLOCKED_HIGH_TAIL_RISK');
              } else {
                 record('ROBUSTNESS', 'PASS', `Robustness: ${robustnessScore.totalScore}/100 (Grade ${robustnessScore.grade}). ${robustnessScore.summary}`, combinedMetrics as any, tS);
              }
           } catch (e: any) {
              record('ROBUSTNESS', 'FAIL', `Robustness Exception: ${e.message}`, {}, tS, 'BLOCKED_ROBUSTNESS_FAILURE');
           }

        }
      } catch (e: any) {
        record('RISK_PERFORMANCE', 'FAIL', `Runtime Exception: ${e.message}`, {}, tS, 'BLOCKED_RISK_CALC_FAILURE');
        pendingRest(12, 'Not executed: Risk calculation failed');
      }

    }
  }


  // ------------------------------------------------------------------ Assemble
  const symbolName = (id: number) => table.symbols[id].name;
  const diagnostics: Diagnostic[] = [
    ...stage2Diags, ...unresolvedDiags, ...cycleDiags, ...semanticDiags,
    ...flow.diagnostics, ...cfgWarnings, ...logic.diagnostics,
  ];

  return finish({
    scriptKind: sem.scriptKind,
    pineVersion: parsed.version,
    syntaxErrors: [],
    unresolvedIdentifiers: unresolvedNames,
    unresolvedDetails: table.unresolved.map(u => ({ name: u.name, line: u.loc.line, col: u.loc.col, code: u.code })),
    unusedVariables,
    semanticErrors,
    warnings: sevOf(diagnostics, 'warning'),
    diagnostics,
    symbolTable: table.symbols.map(s => ({
      name: s.name, kind: s.kind, line: s.declLoc.line, col: s.declLoc.col,
      scope: table.scopes[s.scopeId].kind + (table.scopes[s.scopeId].owner ? `:${table.scopes[s.scopeId].owner}` : ''),
      refCount: s.refCount, reassignCount: s.reassignCount, inputType: s.inputType, inputDefault: s.inputDefault,
    })),
    dependencyGraph: {
      nodes: graph.nodes,
      edges: graph.edges.map(e => ({
        from: symbolName(e.from), to: symbolName(e.to), kind: e.kind, viaHistory: e.viaHistory, reassign: e.reassign,
      })),
      cycles: graph.cycles,
      topoOrder: graph.topoOrder,
    },
    dataFlow: flow,
    cfg: {
      stats: cfg.stats,
      units: cfg.units.map(u => ({
        name: u.name, nodes: u.nodes.length, edges: u.edges.length,
        infeasibleEdges: u.edges.filter(e => e.infeasible).length, reachableNodes: u.reachable.length,
      })),
      deadRegions: cfg.deadRegions,
      unreachableConditions: cfg.unreachableConditions,
    },
    logic,
    classification,
  });
}
