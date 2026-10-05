/**
 * Single File Source Code Bundle Viewer & Exporter
 * Fulfils the explicit user prompt requirement:
 * "يعد الانتهاء من العمل عطني جميع الملفات المصدرية في ملف واحد"
 * (After completion, give me all source files in one single file).
 */

import React, { useState } from 'react';
import { Copy, Check, Download, FileText, Code } from 'lucide-react';

interface SourceCodeBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullBundleText: string;
}

export const SourceCodeBundleModal: React.FC<SourceCodeBundleModalProps> = ({
  isOpen,
  onClose,
  fullBundleText,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullBundleText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([fullBundleText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'universal-strategy-engine-all-source-files.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div
        id="source-bundle-modal"
        className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                جميع الملفات المصدرية في ملف واحد (All Source Files in One File)
              </h3>
              <p className="text-xs text-slate-500">
                Consolidated source code package for Universal Strategy Engine (USE)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ بنجاح!' : 'نسخ كود الحزمة بالكامل'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل الملف المصدري</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer ml-1"
              title="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Content / Monospace Source Area */}
        <div className="p-4 bg-slate-950 overflow-y-auto flex-1 font-mono text-[11px] text-slate-300 leading-relaxed select-all">
          <pre dir="ltr" className="text-left" style={{ unicodeBidi: 'plaintext' }}>{fullBundleText}</pre>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            يحتوي هذا الملف على جميع المكونات، خوارزميات الذكاء الاصطناعي، نماذج البيانات، ومحلل الاستراتيجيات بالكامل.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
