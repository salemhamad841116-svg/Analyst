const fs = require('fs');
const path = './src/components/PineScriptStudioView.tsx';
let code = fs.readFileSync(path, 'utf8');

const textareaSearch = `<div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-950 flex items-center gap-2">
              <Code className="w-4 h-4 text-blue-600" />
              {language === 'ar' ? 'محرر Pine Script الذكي' : 'Smart Pine Script Editor'}
            </h2>
            <div className="flex gap-2">`;
            
const textareaReplace = `<div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-950 flex items-center gap-2">
              <Code className="w-4 h-4 text-blue-600" />
              {language === 'ar' ? 'محرر Pine Script الذكي' : 'Smart Pine Script Editor'}
            </h2>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 mr-4 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setIsDualMode(false)}
                  className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${!isDualMode ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}\`}
                >
                  {language === 'ar' ? 'كود واحد' : 'Single Code'}
                </button>
                <button
                  onClick={() => setIsDualMode(true)}
                  className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${isDualMode ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}\`}
                >
                  {language === 'ar' ? 'تحليل مزدوج' : 'Dual Strategy'}
                </button>
              </div>`;
code = code.replace(textareaSearch, textareaReplace);

const textareaBodySearch = `          <textarea
            dir="ltr"
            aria-label="Pine Script Source Editor"
            value={pineCode}
            onChange={(e) => setPineCode(e.target.value)}
            rows={10}
            className="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 leading-relaxed resize-y text-left"
            style={{ unicodeBidi: 'plaintext' }}
            placeholder="//@version=5&#10;strategy('My Custom Strategy', overlay=true)..."
          />`;

const textareaBodyReplace = `          <div className={\`grid gap-4 \${isDualMode ? 'grid-cols-2' : 'grid-cols-1'}\`}>
            <div className="space-y-2">
              {isDualMode && <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'ar' ? 'الكود أ' : 'Code A'}</div>}
              <textarea
                dir="ltr"
                aria-label="Pine Script Source Editor A"
                value={pineCode}
                onChange={(e) => setPineCode(e.target.value)}
                rows={10}
                className="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 leading-relaxed resize-y text-left"
                style={{ unicodeBidi: 'plaintext' }}
                placeholder="//@version=5&#10;strategy('My Custom Strategy', overlay=true)..."
              />
            </div>
            {isDualMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>{language === 'ar' ? 'الكود ب' : 'Code B'}</span>
                  <select 
                    value={combineMode}
                    onChange={(e) => setCombineMode(e.target.value as any)}
                    className="bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200 px-2 py-0.5 outline-none"
                  >
                    <option value="COMPARE">{language === 'ar' ? 'مقارنة (COMPARE)' : 'Compare Mode'}</option>
                    <option value="CONFLUENCE">{language === 'ar' ? 'توافق (CONFLUENCE)' : 'Confluence Mode'}</option>
                    <option value="COMBINE">{language === 'ar' ? 'دمج (COMBINE)' : 'Combine Mode'}</option>
                  </select>
                </div>
                <textarea
                  dir="ltr"
                  aria-label="Pine Script Source Editor B"
                  value={pineCodeB}
                  onChange={(e) => setPineCodeB(e.target.value)}
                  rows={10}
                  className="w-full font-mono text-xs p-4 bg-slate-950 text-amber-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 leading-relaxed resize-y text-left"
                  style={{ unicodeBidi: 'plaintext' }}
                  placeholder="//@version=5&#10;strategy('My Second Strategy', overlay=true)..."
                />
              </div>
            )}
          </div>`;

code = code.replace(textareaBodySearch, textareaBodyReplace);

fs.writeFileSync(path, code);
console.log('UI Patched.');
