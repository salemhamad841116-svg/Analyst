/**
 * Pine Script builtin catalogue used for symbol resolution and semantic validation.
 * Unknown members of "strict" namespaces produce UNKNOWN_BUILTIN_MEMBER warnings;
 * everything else resolves silently as a builtin.
 */

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

/** Built-in series / variables available without a namespace */
export const SERIES_BUILTINS = set(`
  open high low close volume time time_close time_tradingday bar_index last_bar_index
  hl2 hlc3 ohlc4 hlcc4 dayofmonth dayofweek hour minute month second year weekofyear timenow
  na
`);

/** Market-data series that count as "source" nodes in data-flow analysis */
export const MARKET_SERIES = set(`open high low close volume hl2 hlc3 ohlc4 hlcc4 time time_close bar_index`);

/** Plain functions callable without a namespace */
export const GLOBAL_FUNCTIONS = set(`
  indicator strategy library
  plot plotshape plotchar plotcandle plotbar plotarrow bgcolor barcolor fill hline
  alert alertcondition
  na nz fixnan int float bool string color time timeframe_change
  input
  max min abs round ceil floor sqrt log exp pow sign avg sum
  request
`);

/** Pine v4 / v5 un-namespaced indicator functions (still accepted by older scripts) */
export const LEGACY_FUNCTIONS = set(`
  sma ema wma vwma rma rsi atr tr cci mom roc stoch macd bb sar supertrend cmo tsi
  crossover crossunder cross highest lowest highestbars lowestbars change valuewhen barssince
  security heikinashi stdev cum linreg percentrank median pivothigh pivotlow vwap hma swma alma kc
  tickerid
`);

const TA = set(`
  accdist alma atr barssince bb bbw cci change cmo cog correlation cross crossover crossunder cum dev
  dmi ema falling highest highestbars hma iii kc kcw linreg lowest lowestbars macd max median mfi min
  mode mom nvi obv percentile_linear_interpolation percentile_nearest_rank percentrank pivot_point_levels
  pivothigh pivotlow pvi pvt range rising rma roc rsi sar sma stdev stoch supertrend swma tr tsi valuewhen
  variance vwap vwma wad wma wpr
`);
const MATH = set(`
  abs acos asin atan avg ceil cos exp floor log log10 max min pow random round round_to_mintick sign sin
  sqrt sum tan todegrees toradians e pi phi rphi
`);
const STRATEGY = set(`
  entry order exit close close_all cancel cancel_all long short risk position_size position_avg_price
  position_entry_name equity netprofit grossprofit grossloss initial_capital opentrades closedtrades
  wintrades losstrades eventrades max_drawdown max_runup openprofit avg_trade avg_winning_trade
  avg_losing_trade fixed cash percent_of_equity commission oca account_currency convert_to_account
  convert_to_symbol default_entry_qty margin_liquidation_price max_contracts_held_all max_contracts_held_long
  max_contracts_held_short max_drawdown_percent max_runup_percent netprofit_percent openprofit_percent
  grossprofit_percent grossloss_percent opentrades_capital risk_allow_entry_in
`);
const INPUT = set(`
  int float bool string color price source symbol timeframe session time text_area enum
`);
const REQUEST = set(`
  security security_lower_tf dividends splits earnings quandl financial economic seed currency_rate
`);
const STR = set(`
  contains endswith format format_time length lower match pos repeat replace replace_all split startswith
  substring tonumber tostring trim upper
`);

/** namespace -> allowed members (null = any member accepted) */
export const NAMESPACES: Record<string, Set<string> | null> = {
  ta: TA,
  math: MATH,
  strategy: STRATEGY,
  input: INPUT,
  request: REQUEST,
  str: STR,
  array: null, matrix: null, map: null,
  color: null, syminfo: null, barstate: null, timeframe: null, session: null, chart: null,
  ticker: null, line: null, label: null, box: null, table: null, polyline: null, linefill: null,
  log: null, runtime: null, location: null, shape: null, size: null, position: null, plot: null,
  hline: null, display: null, extend: null, xloc: null, yloc: null, barmerge: null, format: null,
  currency: null, dayofweek: null, scale: null, font: null, text: null, order: null,
  adjustment: null, backadjustment: null, settlement_as_close: null, splits: null,
  dividends: null, earnings: null, alert: null, math_: null,
};

/** Series names that live inside namespaces and are series, not calls (e.g. ta.tr, strategy.long) */
export const NAMESPACE_CONSTANTS = set(`
  strategy.long strategy.short strategy.cash strategy.fixed strategy.percent_of_equity
  ta.tr ta.accdist ta.iii ta.nvi ta.obv ta.pvi ta.pvt ta.wad ta.vwap
`);

/** [min, max] positional/named argument counts for common ta.* / math.* functions */
export const ARITY: Record<string, [number, number]> = {
  'ta.sma': [2, 2], 'ta.ema': [2, 2], 'ta.rma': [2, 2], 'ta.wma': [2, 2], 'ta.hma': [2, 2], 'ta.vwma': [2, 2],
  'ta.rsi': [2, 2], 'ta.atr': [1, 1], 'ta.cci': [2, 2], 'ta.mom': [2, 2], 'ta.roc': [2, 2], 'ta.cmo': [2, 2],
  'ta.crossover': [2, 2], 'ta.crossunder': [2, 2], 'ta.cross': [2, 2],
  'ta.highest': [1, 2], 'ta.lowest': [1, 2], 'ta.highestbars': [1, 2], 'ta.lowestbars': [1, 2],
  'ta.stdev': [2, 3], 'ta.change': [1, 2], 'ta.macd': [4, 4], 'ta.bb': [3, 3], 'ta.bbw': [3, 3],
  'ta.stoch': [4, 4], 'ta.supertrend': [2, 2], 'ta.barssince': [1, 1], 'ta.valuewhen': [3, 3],
  'ta.pivothigh': [2, 3], 'ta.pivotlow': [2, 3], 'ta.linreg': [3, 3], 'ta.cum': [1, 1],
  'ta.percentrank': [2, 2], 'ta.median': [2, 2], 'ta.mfi': [2, 2], 'ta.wpr': [1, 1], 'ta.sar': [3, 3],
  'ta.dmi': [2, 2], 'ta.tsi': [3, 3], 'ta.swma': [1, 1], 'ta.kc': [3, 4], 'ta.falling': [2, 2], 'ta.rising': [2, 2],
  'math.abs': [1, 1], 'math.sqrt': [1, 1], 'math.max': [2, 99], 'math.min': [2, 99], 'math.pow': [2, 2],
  'math.log': [1, 1], 'math.exp': [1, 1], 'math.round': [1, 2], 'math.floor': [1, 1], 'math.ceil': [1, 1],
  'math.sum': [2, 2], 'math.avg': [1, 99],
};

/** Functions that cannot be called from a local (indented) scope in Pine */
export const GLOBAL_SCOPE_ONLY = set(`
  plot plotshape plotchar plotcandle plotbar plotarrow bgcolor barcolor fill hline alertcondition indicator strategy library
`);

export const STRATEGY_ORDER_CALLS = set(`
  strategy.entry strategy.order strategy.exit strategy.close strategy.close_all strategy.cancel strategy.cancel_all
`);

export function isNamespaceRoot(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(NAMESPACES, name);
}

export function isKnownBuiltinRoot(name: string): boolean {
  return (
    SERIES_BUILTINS.has(name) ||
    GLOBAL_FUNCTIONS.has(name) ||
    LEGACY_FUNCTIONS.has(name) ||
    isNamespaceRoot(name)
  );
}

/** Returns true when `ns.member` is valid (or the namespace is not strictly catalogued). */
export function isKnownNamespaceMember(ns: string, member: string): boolean {
  const members = NAMESPACES[ns];
  if (members === undefined) return false;
  if (members === null) return true;
  return members.has(member);
}
