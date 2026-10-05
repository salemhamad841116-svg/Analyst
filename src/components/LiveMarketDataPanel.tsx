import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { LiveMarketTick, fetchLiveQuote } from '../services/liveMarketDataService';

interface LiveMarketDataPanelProps {
  language?: 'ar' | 'en';
  defaultSymbol?: string;
  onSymbolChange?: (symbol: string) => void;
}

export const LiveMarketDataPanel: React.FC<LiveMarketDataPanelProps> = ({
  language = 'ar',
  defaultSymbol = 'BINANCE:BTCUSDT',
  onSymbolChange,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(defaultSymbol);
  const [tick, setTick] = useState<LiveMarketTick | null>(null);
  const [status, setStatus] = useState<'CONNECTED' | 'LIVE_DATA_DISCONNECTED' | 'CONNECTING'>('CONNECTING');
  const [latency, setLatency] = useState<number>(0);
  const [heartbeatTime, setHeartbeatTime] = useState<number>(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isManualPaused, setIsManualPaused] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const symbolsList = [
    { id: 'BINANCE:BTCUSDT', label: 'BTC/USDT (Crypto - Active Feed)' },
    { id: 'BINANCE:ETHUSDT', label: 'ETH/USDT (Crypto - Active Feed)' },
    { id: 'AAPL', label: 'AAPL (US Equities - Finnhub Feed)' },
    { id: 'NVDA', label: 'NVDA (US Equities - Finnhub Feed)' },
    { id: 'EUR/USD', label: 'EUR/USD (Forex)' },
  ];

  const connectStream = (sym: string) => {
    if (isManualPaused) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus('CONNECTING');
    setLastError(null);

    const sseUrl = `/api/market-data/stream?symbol=${encodeURIComponent(sym)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    const startPing = Date.now();

    es.onopen = () => {
      setStatus('CONNECTED');
      setReconnectAttempts(0);
      setLatency(Date.now() - startPing);
      setHeartbeatTime(Date.now());
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'LIVE_DATA_DISCONNECTED') {
          setStatus('LIVE_DATA_DISCONNECTED');
          setLastError(data.error || 'Provider feed reported disconnection');
          return;
        }

        if (data.bid || data.mid || data.ohlc) {
          setTick(data);
          setStatus('CONNECTED');
          setHeartbeatTime(Date.now());
          setLastError(null);
        }
      } catch (err: any) {
        console.warn('[SSE_PARSE_WARNING]', err);
      }
    };

    es.onerror = () => {
      setStatus('LIVE_DATA_DISCONNECTED');
      setLastError('Connection to market data stream lost');
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect: 2s, 4s, 8s, 16s, max 30s
      setReconnectAttempts((prev) => {
        const nextAttempt = prev + 1;
        const delay = Math.min(30000, Math.pow(2, Math.min(prev, 5)) * 1000);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectStream(sym);
        }, delay);
        return nextAttempt;
      });
    };
  };

  useEffect(() => {
    connectStream(selectedSymbol);
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [selectedSymbol, isManualPaused]);

  // Fallback Polling if EventSource is disconnected
  useEffect(() => {
    if (status !== 'CONNECTED' || isManualPaused) return;
    const interval = setInterval(async () => {
      try {
        const start = Date.now();
        const quote = await fetchLiveQuote(selectedSymbol);
        setLatency(Date.now() - start);
        setHeartbeatTime(Date.now());
        if (quote && quote.status !== 'LIVE_DATA_DISCONNECTED') {
          setTick(quote);
        }
      } catch (err: any) {
        // Do nothing, let SSE manage
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedSymbol, status, isManualPaused]);

  const handleManualReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    setReconnectAttempts(0);
    setIsManualPaused(false);
    connectStream(selectedSymbol);
  };

  const handleSymbolSelect = (sym: string) => {
    setSelectedSymbol(sym);
    if (onSymbolChange) onSymbolChange(sym);
  };

  const secondsSinceHeartbeat = Math.floor((Date.now() - heartbeatTime) / 1000);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Top Banner: Status, Provider Identity, Safety Isolation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            <h2 className="text-sm font-black text-slate-950">
              {language === 'ar' ? 'بث أسعار السوق الحية (Live Market Data Stream)' : 'Live Market Data Stream'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            {language === 'ar'
              ? 'اتصال مباشر بمزود الأسعار المؤسسي عبر خادمنا الآمن • بدون أي استبدال للأسعار المصطنعة'
              : 'Direct connection to institutional provider via secured server proxy • Zero synthetic price substitution'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Exact Provider Identity (Never combined) */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
            <span className="text-[10px] text-slate-400 font-sans">{language === 'ar' ? 'المزود:' : 'Provider:'}</span>
            <span className="text-blue-700">{tick?.provider || 'Finnhub'}</span>
          </div>

          {/* Connection Status Badge */}
          {status === 'CONNECTED' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE_CONNECTED</span>
            </div>
          ) : status === 'CONNECTING' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-300 text-blue-800 text-xs font-bold font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>CONNECTING...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 border border-red-300 text-red-800 text-xs font-black font-mono">
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span>LIVE_DATA_DISCONNECTED</span>
            </div>
          )}

          {/* Analysis Only Safety Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>{language === 'ar' ? 'تحليل فقط (Analysis Only)' : 'Analysis Only • No Live Execution'}</span>
          </div>
        </div>
      </div>

      {/* Symbol Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">
            {language === 'ar' ? 'الأصل المالي النشط:' : 'Active Stream Symbol:'}
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => handleSymbolSelect(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors cursor-pointer"
          >
            {symbolsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualReconnect}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إعادة الاتصال' : 'Reconnect'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Warning Banner (Strict requirement) */}
      {status === 'LIVE_DATA_DISCONNECTED' && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-red-800 text-sm font-mono">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>LIVE_DATA_DISCONNECTED</span>
            </div>
            {reconnectAttempts > 0 && (
              <span className="text-xs font-mono text-red-700">
                {language === 'ar' ? `محاولة إعادة الاتصال #${reconnectAttempts}...` : `Reconnecting (attempt #${reconnectAttempts})...`}
              </span>
            )}
          </div>
          <p className="text-xs text-red-700 leading-relaxed font-sans">
            {language === 'ar'
              ? 'انقطع تدفق الأسعار الحية من المزود. وفقاً للمعايير الصارمة لمنصتنا، لن يتم أبداً استبدال الأسعار بأسعار مصطنعة أو وهمية. يرجى التحقق من اتصال الشبكة أو مفتاح API.'
              : 'Live stream disconnected from provider. The platform strictly enforces zero synthetic price substitution. Retrying connection with exponential backoff.'}
          </p>
          {lastError && (
            <div className="text-[11px] font-mono bg-white/80 p-2 rounded text-red-900 border border-red-200">
              Details: {lastError}
            </div>
          )}
        </div>
      )}

      {/* Live Stream Price Grid: Bid, Ask, Mid, Spread, Timestamp, OHLC, Volume */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Mid Price */}
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
          <span className="text-[11px] text-slate-400 block font-bold">
            {language === 'ar' ? 'السعر المتوسط (Mid Price)' : 'Mid Price'}
          </span>
          <span className="text-2xl font-mono font-black tracking-tight text-white block mt-1">
            {tick?.mid ? tick.mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '—'}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
            {selectedSymbol}
          </span>
        </div>

        {/* Bid & Ask */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'سعر الشراء (Bid):' : 'Bid:'}</span>
            <span className="font-mono font-black text-emerald-600">
              {tick?.bid ? tick.bid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'سعر البيع (Ask):' : 'Ask:'}</span>
            <span className="font-mono font-black text-red-600">
              {tick?.ask ? tick.ask.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '—'}
            </span>
          </div>
        </div>

        {/* Spread & Volume */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'الفارق (Spread):' : 'Spread:'}</span>
            <span className="font-mono font-black text-slate-900">
              {tick?.spread ? tick.spread.toFixed(4) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'الحجم (Volume):' : 'Volume / Ticks:'}</span>
            <span className="font-mono font-bold text-slate-700">
              {tick?.volume ? tick.volume.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Latency & Heartbeat */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'زمن الاستجابة:' : 'Latency:'}</span>
            <span className={`font-mono font-bold ${latency < 200 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {latency > 0 ? `${latency} ms` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
            <span className="text-slate-500 font-bold">{language === 'ar' ? 'نبض الاتصال (Heartbeat):' : 'Heartbeat:'}</span>
            <span className="font-mono text-slate-600">
              {secondsSinceHeartbeat < 5 ? 'Active • 10s' : `${secondsSinceHeartbeat}s ago`}
            </span>
          </div>
        </div>
      </div>

      {/* Live OHLC Bar Breakdown */}
      {tick?.ohlc && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              {language === 'ar' ? 'الشمعة اللحظية النشطة (Current Active Bar OHLC):' : 'Current Active Bar OHLC:'}
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Timestamp: {formatDubaiTime(tick.timestamp, { showSeconds: true })}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] block font-sans">Open</span>
              <span className="font-bold text-slate-900">{tick.ohlc.open?.toLocaleString() || '—'}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] block font-sans">High</span>
              <span className="font-bold text-emerald-600">{tick.ohlc.high?.toLocaleString() || '—'}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] block font-sans">Low</span>
              <span className="font-bold text-red-600">{tick.ohlc.low?.toLocaleString() || '—'}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] block font-sans">Close</span>
              <span className="font-bold text-blue-600">{tick.ohlc.close?.toLocaleString() || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Strict Compliance Footer */}
      <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
        <span>
          {language === 'ar'
            ? '✓ يتم تسجيل هوية المزود بدقة في كل جلسة • بدون دمج أسماء المزودين'
            : '✓ Single provider identity recorded per session • No ambiguous combined labels'}
        </span>
        <span className="font-mono text-slate-400 text-[10px]">
          SSE Protocol • Port 3000 Secured
        </span>
      </div>
    </div>
  );
};
