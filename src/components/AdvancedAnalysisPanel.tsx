import React, { useEffect, useState, useMemo } from 'react';
import { Play, CheckCircle2, XCircle, AlertTriangle, FileSearch, ShieldCheck, Database, Brain, Activity, Clock, ShieldAlert } from 'lucide-react';
import { runStaticAnalysisPipeline, StaticAnalysisReport } from '../engine/analysis/pipeline/analysisPipeline';

interface AdvancedAnalysisPanelProps {
  code: string;
  language: string;
  candles?: import('../types').Candle[];
}

export const AdvancedAnalysisPanel: React.FC<AdvancedAnalysisPanelProps> = ({ code, language, candles }) => {
  const [report, setReport] = useState<StaticAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    // Auto-run analysis when code changes (debounced)
    const run = () => {
      setIsAnalyzing(true);
      
      // Small timeout to allow UI to update to analyzing state
      setTimeout(() => {
        try {
          const analysisId = 'STATIC-' + Date.now();
          const result = runStaticAnalysisPipeline(code, {
            analysisId,
            language: 'pine',
            datasetHash: candles ? `CANDLES-${candles.length}` : 'NOT_APPLICABLE_STATIC_PHASE',
            candles
          });
          setReport(result);
        } catch (e) {
          console.error("Analysis pipeline error:", e);
        } finally {
          setIsAnalyzing(false);
        }
      }, 50);
    };

    timeout = setTimeout(run, 800);
    return () => clearTimeout(timeout);
  }, [code, language, candles]);

  if (!report) {
    return (
      <div className="bg-[#1C2128] rounded-xl border border-white/10 p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-blue-400">
            <Activity size={32} />
          </div>
          <span className="text-gray-400 font-medium tracking-wider text-sm">
            INITIALIZING UNIVERSAL ENGINE...
          </span>
        </div>
      </div>
    );
  }

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'PASS': return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'FAIL': return <XCircle size={18} className="text-red-500" />;
      case 'PENDING': return <Clock size={18} className="text-gray-500" />;
      case 'NOT_APPLICABLE': return <CheckCircle2 size={18} className="text-gray-400" />;
      default: return <AlertTriangle size={18} className="text-amber-500" />;
    }
  };
  
  const finalStatus = report.finalVerification.status === 'FINAL_VERIFIED' ? 'PASS' : 
                      report.finalVerification.status === 'NOT_VERIFIED' ? 'PENDING' : 'FAIL';

  return (
    <div className="bg-[#14181d] rounded-xl border border-white/5 overflow-hidden flex flex-col mb-6">
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-wide text-sm">INSTITUTIONAL HYBRID ENGINE</h3>
            <div className="text-xs text-blue-300 mt-1 font-mono">
              VERIFICATION & ACCEPTANCE {isAnalyzing ? '(RUNNING...)' : ''}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 font-mono mb-1">STRATEGY HASH</div>
          <div className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1 rounded">
            {report.strategyHash.substring(0, 16)}...
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#1C2128] p-4 rounded-lg border border-white/5">
             <div className="text-xs text-gray-500 font-semibold mb-3">STATIC PIPELINE STATUS</div>
             <div className="flex items-center gap-3">
               {report.staticStatus === 'STATIC_ANALYSIS_PASS' ? (
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                   STATIC PASS
                 </div>
               ) : (
                 <div className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-full border border-red-500/20">
                   {report.blockingCode || 'BLOCKED'}
                 </div>
               )}
               {report.stages.find(s => s.stageId === 'LOGICAL_CONTRADICTION')?.status === 'PASS' ? (
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                   FORMAL_CHECK_PASS
                 </div>
               ) : report.stages.find(s => s.stageId === 'LOGICAL_CONTRADICTION')?.status === 'FAIL' ? (
                 <div className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-full border border-red-500/20">
                   FORMAL_CHECK_BLOCKED
                 </div>
               ) : null}
             </div>
          </div>
          
          <div className="bg-[#1C2128] p-4 rounded-lg border border-white/5">
             <div className="text-xs text-gray-500 font-semibold mb-3">FINAL VERIFICATION (PHASE 1-13)</div>
             <div className="flex items-center gap-3">
               {finalStatus === 'PASS' ? (
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                   FINAL VERIFIED
                 </div>
               ) : finalStatus === 'PENDING' ? (
                 <div className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20">
                   PENDING DYNAMIC PHASES
                 </div>
               ) : (
                 <div className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-full border border-red-500/20">
                   BLOCKED
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-semibold mb-3 px-2">PIPELINE STAGES</div>
          {report.stages.map((stage, idx) => (
            <div 
              key={stage.stageId} 
              className={`rounded-lg border transition-colors ${expandedStage === stage.stageId ? 'bg-[#1C2128] border-white/10' : 'bg-transparent border-transparent hover:bg-white/5'}`}
            >
              <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpandedStage(expandedStage === stage.stageId ? null : stage.stageId)}
              >
                <div className="flex items-center gap-3">
                  {getStageIcon(stage.status)}
                  <span className={`text-sm font-medium ${stage.status === 'FAIL' ? 'text-red-400' : 'text-gray-300'}`}>
                    {idx + 1}. {stage.stageName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {stage.blockingCode && (
                     <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                       {stage.blockingCode}
                     </span>
                  )}
                  <span className={`text-xs font-mono w-24 text-right ${
                    stage.status === 'PASS' || stage.status === 'NOT_APPLICABLE' ? 'text-emerald-500' :
                    stage.status === 'FAIL' ? 'text-red-500' :
                    'text-gray-500'
                  }`}>
                    {stage.status}
                  </span>
                </div>
              </div>
              
              {expandedStage === stage.stageId && (
                <div className="px-10 pb-4 pt-1">
                  <div className="text-sm text-gray-400 mb-2">{stage.reason}</div>
                  
                  {stage.stageId === 'LOGICAL_CONTRADICTION' && stage.status === 'PASS' && (
                    <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded text-sm text-blue-300 flex items-start gap-2">
                      <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>FORMAL_CHECK_PASS:</strong> Quantitative engine has proven via DPLL SAT solver that trading rules do not contain logical contradictions or unreachable entry states.
                      </div>
                    </div>
                  )}
                  {stage.stageId === 'LOGICAL_CONTRADICTION' && stage.status === 'FAIL' && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300 flex items-start gap-2">
                      <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>FORMAL_CHECK_BLOCKED:</strong> Quantitative engine detected logical contradictions. Strategy violates mutually exclusive conditions or contains unreachable states.
                      </div>
                    </div>
                  )}

                  {stage.metrics && Object.keys(stage.metrics).length > 0 && (
                    <div className="mt-3 bg-black/20 rounded p-3 overflow-x-auto">
                      <pre className="text-xs text-gray-500 font-mono m-0">
                        {JSON.stringify(stage.metrics, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
