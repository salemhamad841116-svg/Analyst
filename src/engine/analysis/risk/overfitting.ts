import { Program, Expr, walkExpr, dottedName, Stmt } from '../pine/ast';
import { BacktestTrade } from '../backtest/interpreter';

export interface OverfittingReport {
  parameterCount: number;
  tradeCount: number;
  degreesOfFreedomRisk: number; // 0 to 1
  timeStabilityScore: number;   // 0 to 1
  overfitRiskScore: number;     // 0 to 100
  quartilePnLs: number[];
  warningMessage?: string;
}

function countInputs(program: Program): number {
  let count = 0;
  
  const checkExpr = (expr: Expr) => {
    if (expr.kind === 'Call') {
      const name = dottedName(expr.callee);
      if (name && name.startsWith('input')) {
        count++;
      }
    }
  };

  const walkStmt = (stmt: Stmt) => {
    switch (stmt.kind) {
      case 'VarDecl':
        walkExpr(stmt.init, checkExpr);
        break;
      case 'ExprStmt':
        walkExpr(stmt.expr, checkExpr);
        break;
      case 'If':
        walkExpr(stmt.test, checkExpr);
        stmt.consequent.forEach(walkStmt);
        if (stmt.alternate) stmt.alternate.forEach(walkStmt);
        break;
    }
  };

  program.body.forEach(walkStmt);
  return count;
}

export function evaluateOverfitting(program: Program, trades: BacktestTrade[]): OverfittingReport {
  const paramCount = countInputs(program);
  const tradeCount = trades.length;

  // 1. Degrees of Freedom Risk
  // A strategy with 5 parameters but only 10 trades is highly overfitted.
  // Rule of thumb: Need at least 30 trades per parameter.
  const requiredTrades = Math.max(1, paramCount) * 30;
  let dofRisk = 0;
  if (tradeCount < requiredTrades) {
    dofRisk = 1 - (tradeCount / requiredTrades);
  }
  if (paramCount === 0 && tradeCount < 30) {
     dofRisk = 1 - (tradeCount / 30); // Base penalty for extremely low trades
  }
  
  // 2. Time Stability (Walk-Forward Simulation via quartiles)
  let timeStabilityScore = 1;
  const quartilePnLs = [0, 0, 0, 0];
  
  if (tradeCount >= 4) {
    const firstTime = trades[0].exitTime;
    const lastTime = trades[tradeCount - 1].exitTime;
    const timeSpan = lastTime - firstTime;
    
    if (timeSpan > 0) {
      for (const trade of trades) {
        const pnl = (trade as any).netPnL || trade.grossPnL;
        const normalizedTime = trade.exitTime - firstTime;
        const quartile = Math.min(3, Math.floor((normalizedTime / timeSpan) * 4));
        quartilePnLs[quartile] += pnl;
      }
      
      // Calculate variance of quartile returns
      const mean = quartilePnLs.reduce((a, b) => a + b, 0) / 4;
      if (mean !== 0) {
        const variance = quartilePnLs.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 4;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / Math.abs(mean); // Coefficient of variation
        
        // High CV means profit is highly concentrated in specific time periods
        timeStabilityScore = Math.max(0, 1 - (cv / 2)); 
      } else {
        timeStabilityScore = 0;
      }
    }
  } else {
    timeStabilityScore = 0; // Not enough trades to prove stability
  }

  // 3. Final Score
  // Combine DOF risk (60% weight) and Time Instability (40% weight)
  const overfitRiskScore = (dofRisk * 60) + ((1 - timeStabilityScore) * 40);

  let warningMessage;
  if (overfitRiskScore > 60) {
    warningMessage = `CRITICAL OVERFITTING: Extreme curve-fitting detected. Strategy relies on ${paramCount} params for only ${tradeCount} trades, or profit is time-clustered.`;
  } else if (overfitRiskScore > 40) {
    warningMessage = `HIGH RISK: Strategy exhibits unstable temporal performance or lacks sufficient trade sample size.`;
  }

  return {
    parameterCount: paramCount,
    tradeCount,
    degreesOfFreedomRisk: dofRisk,
    timeStabilityScore,
    overfitRiskScore,
    quartilePnLs,
    warningMessage
  };
}
