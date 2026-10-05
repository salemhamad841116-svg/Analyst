const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const search = `             {executionResults?.evidencePack?.numericalParity ? (
                 <pre dir="ltr" className="text-xs bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
                   {JSON.stringify(executionResults.evidencePack.numericalParity, null, 2)}
                 </pre>
             ) : (
                 <p className="text-xs text-slate-500">{language === 'ar' ? 'شغّل التحليل لرؤية نتائج التكافؤ.' : 'Run analysis to see parity results.'}</p>
             )}`;

const replace = `             {executionResults?.isDualMode && executionResults?.dualExecutionTraces && (
               <div className="mt-6 mb-6">
                 <h2 className="text-sm font-black text-slate-950 mb-3">{language === 'ar' ? 'جدول تقييم التحليل المزدوج' : 'Dual Strategy Evaluation Table'}</h2>
                 <div className="overflow-x-auto border border-slate-200 rounded-lg">
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                       <tr>
                         <th className="px-3 py-2">Index</th>
                         <th className="px-3 py-2">Time</th>
                         <th className="px-3 py-2">Code A Signal</th>
                         <th className="px-3 py-2">Code B Signal</th>
                         <th className="px-3 py-2 bg-blue-50 text-blue-900 font-bold">Final Signal</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {executionResults.dualExecutionTraces.slice(0, 100).map((t: any, i: number) => (
                         <tr key={i} className="hover:bg-slate-50">
                           <td className="px-3 py-2 font-mono text-slate-500">{t.barIndex}</td>
                           <td className="px-3 py-2 font-mono whitespace-nowrap">{t.timeFormatted}</td>
                           <td className={\`px-3 py-2 font-bold \${t.signalA === 'BUY' ? 'text-emerald-600' : t.signalA === 'SELL' ? 'text-red-600' : 'text-slate-400'}\`}>{t.signalA}</td>
                           <td className={\`px-3 py-2 font-bold \${t.signalB === 'BUY' ? 'text-emerald-600' : t.signalB === 'SELL' ? 'text-red-600' : 'text-slate-400'}\`}>{t.signalB}</td>
                           <td className={\`px-3 py-2 font-black bg-blue-50/50 \${t.finalSignal === 'BUY' ? 'text-emerald-700' : t.finalSignal === 'SELL' ? 'text-red-700' : 'text-slate-500'}\`}>{t.finalSignal}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                   {executionResults.dualExecutionTraces.length > 100 && (
                     <div className="p-2 text-center text-xs font-bold text-slate-500 bg-slate-50">Showing first 100 bars</div>
                   )}
                 </div>
               </div>
             )}
             
             {executionResults?.evidencePack?.numericalParity ? (
                 <pre dir="ltr" className="text-xs bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
                   {JSON.stringify(executionResults.evidencePack.numericalParity, null, 2)}
                 </pre>
             ) : (
                 <p className="text-xs text-slate-500">{language === 'ar' ? 'شغّل التحليل لرؤية نتائج التكافؤ.' : 'Run analysis to see parity results.'}</p>
             )}`;

code = code.replace(search, replace);
fs.writeFileSync(path, code);
console.log('Patched execution tab.');
