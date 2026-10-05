const fs = require('fs');
const path = './src/components/NextCandleForecastCard.tsx';
let code = fs.readFileSync(path, 'utf8');

const search = `        <div className="flex flex-col gap-1 z-10">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>{language === 'ar' ? 'قرار الشمعة القادمة' : 'Next Candle Decision'}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={\`text-4xl sm:text-5xl font-black tracking-tight \${
              isUp ? 'text-emerald-400' : isDown ? 'text-rose-500' : 'text-slate-300'
            }\`}>
              {isUp ? (language === 'ar' ? 'شراء' : 'BUY') : 
               isDown ? (language === 'ar' ? 'بيع' : 'SELL') : 
               (language === 'ar' ? 'لا يوجد إشارة' : 'NO SIGNAL')}
            </div>`;

const replace = `        <div className="flex flex-col gap-1 z-10">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>{language === 'ar' ? 'قرار الشمعة القادمة (مستوى عالي الثقة)' : 'High-Confidence Next Candle Decision'}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
            <div className={\`text-4xl sm:text-5xl font-black tracking-tight \${
              isUp ? 'text-emerald-400' : isDown ? 'text-rose-500' : isNeutral ? 'text-slate-300' : 'text-slate-500'
            }\`}>
              {forecast.forecastSignal === 'NO SIGNAL' 
                ? (language === 'ar' ? 'توقف / لا يوجد إشارة' : 'NO SIGNAL') 
                : isUp ? (language === 'ar' ? 'شراء' : 'BUY') 
                : isDown ? (language === 'ar' ? 'بيع' : 'SELL') 
                : (language === 'ar' ? 'محايد' : 'NEUTRAL')}
            </div>
            
            {forecast.forecastSignal !== 'NO SIGNAL' && forecast.calibratedConfidence && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50 mt-2 sm:mt-0">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <span className="text-xl font-bold text-white">{forecast.calibratedConfidence}%</span>
              </div>
            )}
            
            {forecast.forecastSignal === 'NO SIGNAL' && forecast.abstentionReason && (
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-900/40 rounded-lg border border-rose-500/30 text-rose-300 text-xs font-bold mt-2 sm:mt-0">
                <AlertTriangle className="w-4 h-4" />
                <span>{forecast.abstentionReason.replace(/_/g, ' ')}</span>
              </div>
            )}`;
            
code = code.replace(search, replace);

const gridSearch = `      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 z-10 relative">`;
const gridReplace = `      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-8 z-10 relative">
        
        {/* Model Agreement */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'اتفاق النماذج' : 'Model Agreement'}</div>
          <div className={\`text-lg font-black \${forecast.modelAgreementScore?.startsWith('4') ? 'text-emerald-400' : 'text-amber-400'}\`}>
            {forecast.modelAgreementScore || 'N/A'}
          </div>
        </div>
        
        {/* Market Regime */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'حالة السوق' : 'Regime'}</div>
          <div className="text-sm font-black text-indigo-300">
            {forecast.detectedRegime?.replace(/_/g, ' ') || 'UNKNOWN'}
          </div>
        </div>
        
        {/* Uncertainty */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'مستوى الشك' : 'Uncertainty'}</div>
          <div className={\`text-sm font-black \${forecast.uncertaintyLevel === 'LOW' ? 'text-emerald-400' : forecast.uncertaintyLevel === 'MEDIUM' ? 'text-amber-400' : 'text-rose-500'}\`}>
            {forecast.uncertaintyLevel || 'N/A'}
          </div>
        </div>
        
        {/* Validation Status */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'حالة التحقق' : 'Validation'}</div>
          <div className={\`text-sm font-black \${forecast.validationStatus === 'PASS' ? 'text-emerald-400' : 'text-rose-500'}\`}>
            {forecast.validationStatus || 'N/A'}
          </div>
        </div>
        
        {/* Calibrated Edge Margin */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'هامش الأفضلية' : 'Edge Margin'}</div>
          <div className="text-sm font-black text-blue-300">
            {forecast.edgeMargin !== undefined ? \`+\${forecast.edgeMargin}%\` : 'N/A'}
          </div>
        </div>
      </div>
      
      {/* Secondary Metrics Validation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4 z-10 relative">`;
code = code.replace(gridSearch, gridReplace);

// Also we need to make sure we show OOS, Blind, Live Shadow
const metricSearch = `        {/* OOS Metrics if available */}`;
const metricReplace = `        {/* High-Confidence Validation Metrics */}
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">OOS Acc</div>
          <div className="text-sm font-black text-emerald-400">{forecast.oosAccuracy ? \`\${forecast.oosAccuracy}%\` : '--'}</div>
        </div>
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Blind Acc</div>
          <div className="text-sm font-black text-emerald-400">{forecast.blindAccuracy ? \`\${forecast.blindAccuracy}%\` : '--'}</div>
        </div>
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Live Shadow Acc</div>
          <div className="text-sm font-black text-emerald-400">{forecast.liveShadowAccuracy ? \`\${forecast.liveShadowAccuracy}%\` : '--'}</div>
        </div>
        
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Repaint</div>
          <div className="text-sm font-black text-white">{forecast.liveValidation?.isRepaintDetected ? 'YES' : 'NO'}</div>
        </div>
        <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:bg-slate-800/70">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Frozen</div>
          <div className="text-sm font-black text-white">{forecast.liveValidation?.isFrozen ? 'YES' : 'NO'}</div>
        </div>
`;
code = code.replace(metricSearch, metricReplace);

fs.writeFileSync(path, code);
console.log('Patched NextCandleForecastCard.');
