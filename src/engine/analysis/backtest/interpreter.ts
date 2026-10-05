import { Program, Stmt, Expr, Loc, Diagnostic, dottedName } from '../pine/ast';
import { Candle } from '../../../types';

export interface BacktestOrder {
  id: string;
  direction: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  limitPrice?: number;
  stopPrice?: number;
  qty?: number;
  comment?: string;
  loc: Loc;
}

export interface BacktestPosition {
  direction: 'LONG' | 'SHORT' | 'FLAT';
  entryPrice: number;
  qty: number;
}

export interface BacktestTrade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  qty: number;
  grossPnL: number;
}

export class PineInterpreter {
  private program: Program;
  private candles: Candle[];
  
  public currentBar: number = 0;
  
  // State
  private nodeResults = new Map<number, any[]>();
  private vars = new Map<string, any>();
  private varInitialized = new Set<string>();
  
  // Orders and Trades
  public pendingOrders: BacktestOrder[] = [];
  public position: BacktestPosition = { direction: 'FLAT', entryPrice: 0, qty: 0 };
  public trades: BacktestTrade[] = [];
  
  public diagnostics: Diagnostic[] = [];

  constructor(program: Program, candles: Candle[]) {
    this.program = program;
    this.candles = candles;
  }

  public run() {
    for (this.currentBar = 0; this.currentBar < this.candles.length; this.currentBar++) {
      this.executeBar();
    }
  }

  private executeBar() {
    // Process pending orders against current candle open (simplified for now)
    this.processOrders();

    // Reset non-var variables
    const oldVars = new Map(this.vars);
    this.vars.clear();
    // restore 'var' and 'varip' variables
    for (const v of this.varInitialized) {
      this.vars.set(v, oldVars.get(v));
    }

    // Builtins
    const candle = this.candles[this.currentBar];
    this.vars.set('open', candle.open);
    this.vars.set('high', candle.high);
    this.vars.set('low', candle.low);
    this.vars.set('close', candle.close);
    this.vars.set('volume', candle.volume);
    this.vars.set('time', candle.timestamp);
    this.vars.set('na', null);

    // Execute statements
    for (const stmt of this.program.body) {
      this.execStmt(stmt);
    }
  }

  private processOrders() {
    if (this.pendingOrders.length === 0) return;
    const candle = this.candles[this.currentBar];
    const fillPrice = candle.open; // Simple open execution

    for (const order of this.pendingOrders) {
      if (order.direction === 'BUY') {
        if (this.position.direction === 'SHORT') {
          // Close short
          const pnl = (this.position.entryPrice - fillPrice) * this.position.qty;
          this.trades.push({
            entryTime: 0, // Need to track entry time properly later
            entryPrice: this.position.entryPrice,
            exitTime: candle.timestamp,
            exitPrice: fillPrice,
            direction: 'SHORT',
            qty: this.position.qty,
            grossPnL: pnl
          });
          this.position = { direction: 'FLAT', entryPrice: 0, qty: 0 };
        }
        if (this.position.direction === 'FLAT') {
          this.position = { direction: 'LONG', entryPrice: fillPrice, qty: order.qty || 1 };
        }
      } else if (order.direction === 'SELL') {
        if (this.position.direction === 'LONG') {
          // Close long
          const pnl = (fillPrice - this.position.entryPrice) * this.position.qty;
          this.trades.push({
            entryTime: 0,
            entryPrice: this.position.entryPrice,
            exitTime: candle.timestamp,
            exitPrice: fillPrice,
            direction: 'LONG',
            qty: this.position.qty,
            grossPnL: pnl
          });
          this.position = { direction: 'FLAT', entryPrice: 0, qty: 0 };
        }
        if (this.position.direction === 'FLAT') {
          this.position = { direction: 'SHORT', entryPrice: fillPrice, qty: order.qty || 1 };
        }
      }
    }
    this.pendingOrders = [];
  }

  private execStmt(stmt: Stmt) {
    try {
      switch (stmt.kind) {
        case 'VarDecl': {
          const val = this.evalExpr(stmt.init);
          for (const name of stmt.names) {
            if (stmt.op === '=') {
              if (stmt.declKind === 'var' || stmt.declKind === 'varip') {
                if (!this.varInitialized.has(name)) {
                  this.vars.set(name, val);
                  this.varInitialized.add(name);
                }
              } else {
                this.vars.set(name, val);
              }
            } else if (stmt.op === ':=') {
              this.vars.set(name, val);
            }
          }
          break;
        }
        case 'ExprStmt':
          this.evalExpr(stmt.expr);
          break;
        case 'If': {
          const cond = this.evalExpr(stmt.test);
          if (cond) {
            for (const s of stmt.consequent) this.execStmt(s);
          } else if (stmt.alternate) {
            for (const s of stmt.alternate) this.execStmt(s);
          }
          break;
        }
        default:
          this.addDiag('warning', 'UNSUPPORTED_STMT', `Statement ${stmt.kind} not implemented`, stmt.loc);
      }
    } catch (e: any) {
       this.addDiag('error', 'RUNTIME_ERROR', e.message, stmt.loc);
    }
  }

  private evalExpr(expr: Expr): any {
    let res: any = null;
    switch (expr.kind) {
      case 'Num': res = expr.value; break;
      case 'Str': res = expr.value; break;
      case 'Bool': res = expr.value; break;
      case 'Na': res = null; break;
      case 'Ident': 
        res = this.vars.get(expr.name); 
        if (res === undefined) res = null;
        break;
      case 'Binary': {
        const l = this.evalExpr(expr.left);
        const r = this.evalExpr(expr.right);
        res = this.evalBinary(expr.op, l, r);
        break;
      }
      case 'Unary': {
        const arg = this.evalExpr(expr.arg);
        if (expr.op === 'not') res = !arg;
        else if (expr.op === '-') res = -arg;
        else res = +arg;
        break;
      }
      case 'Call': {
        res = this.evalCall(expr);
        break;
      }
      case 'Index': {
        this.evalExpr(expr.object); // evaluate just to populate history, though usually Ident
        const idx = this.evalExpr(expr.index);
        let series = this.nodeResults.get(expr.object.id);
        if (!series && expr.object.kind === 'Ident') {
          // Fallback if looking up built-in series directly
          series = this.nodeResults.get(expr.object.id) || [];
        }
        if (series && idx >= 0 && this.currentBar - idx >= 0) {
          res = series[this.currentBar - idx];
        } else {
          res = null;
        }
        break;
      }
      default:
        this.addDiag('warning', 'UNSUPPORTED_EXPR', `Expression ${expr.kind} not implemented`, expr.loc);
    }

    let arr = this.nodeResults.get(expr.id);
    if (!arr) {
      arr = new Array(this.candles.length).fill(null);
      this.nodeResults.set(expr.id, arr);
    }
    arr[this.currentBar] = res;
    return res;
  }

  private evalBinary(op: string, l: any, r: any): any {
    if (l === null || r === null) {
      if (op === '==') return l === r;
      if (op === '!=') return l !== r;
      return null;
    }
    switch (op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return l / r;
      case '>': return l > r;
      case '<': return l < r;
      case '>=': return l >= r;
      case '<=': return l <= r;
      case '==': return l === r;
      case '!=': return l !== r;
      case 'and': return l && r;
      case 'or': return l || r;
    }
    return null;
  }

  private evalCall(expr: import('../pine/ast').Call): any {
    const callee = dottedName(expr.callee);
    if (!callee) return null;

    // Evaluate all arguments first
    const args = expr.args.map(a => this.evalExpr(a.value));

    if (callee === 'ta.sma') {
      const sourceExpr = expr.args[0].value;
      const length = args[1];
      const series = this.nodeResults.get(sourceExpr.id);
      if (!series || typeof length !== 'number') return null;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < length; i++) {
        const val = series[this.currentBar - i];
        if (val !== null && val !== undefined) {
          sum += val;
          count++;
        }
      }
      return count === length ? sum / length : null;
    }

    if (callee === 'ta.crossover') {
      const s1 = this.nodeResults.get(expr.args[0].value.id);
      const s2 = this.nodeResults.get(expr.args[1].value.id);
      if (!s1 || !s2 || this.currentBar < 1) return false;
      const curr1 = s1[this.currentBar], prev1 = s1[this.currentBar - 1];
      const curr2 = s2[this.currentBar], prev2 = s2[this.currentBar - 1];
      if (curr1 === null || prev1 === null || curr2 === null || prev2 === null) return false;
      return prev1 <= prev2 && curr1 > curr2;
    }

    if (callee === 'ta.crossunder') {
      const s1 = this.nodeResults.get(expr.args[0].value.id);
      const s2 = this.nodeResults.get(expr.args[1].value.id);
      if (!s1 || !s2 || this.currentBar < 1) return false;
      const curr1 = s1[this.currentBar], prev1 = s1[this.currentBar - 1];
      const curr2 = s2[this.currentBar], prev2 = s2[this.currentBar - 1];
      if (curr1 === null || prev1 === null || curr2 === null || prev2 === null) return false;
      return prev1 >= prev2 && curr1 < curr2;
    }

    if (callee === 'strategy.entry' || callee === 'strategy.order') {
      const id = typeof args[0] === 'string' ? args[0] : 'order';
      const directionStr = expr.args[1] ? String(args[1]) : 'strategy.long';
      const direction = directionStr.includes('short') ? 'SELL' : 'BUY';
      const qty = typeof args[2] === 'number' ? args[2] : undefined;
      this.pendingOrders.push({ id, direction, type: 'MARKET', qty, loc: expr.loc });
      return;
    }

    if (callee === 'strategy.close') {
      const id = String(args[0]);
      // Closes current position
      if (this.position.direction === 'LONG') {
         this.pendingOrders.push({ id, direction: 'SELL', type: 'MARKET', loc: expr.loc });
      } else if (this.position.direction === 'SHORT') {
         this.pendingOrders.push({ id, direction: 'BUY', type: 'MARKET', loc: expr.loc });
      }
      return;
    }

    if (callee === 'strategy.close_all') {
      if (this.position.direction === 'LONG') {
         this.pendingOrders.push({ id: 'close_all', direction: 'SELL', type: 'MARKET', loc: expr.loc });
      } else if (this.position.direction === 'SHORT') {
         this.pendingOrders.push({ id: 'close_all', direction: 'BUY', type: 'MARKET', loc: expr.loc });
      }
      return;
    }
    
    if (callee.startsWith('input')) {
      return args.length > 0 ? args[0] : null;
    }
    
    if (callee.startsWith('plot') || callee.startsWith('alert')) {
      return null;
    }

    this.addDiag('warning', 'UNSUPPORTED_CALL', `Call to ${callee} is not supported in Phase 3 backtest`, expr.loc);
    return null;
  }

  private addDiag(severity: Diagnostic['severity'], code: string, message: string, loc: Loc) {
    this.diagnostics.push({ severity, code, message, loc, stage: 'BACKTEST' });
  }
}
