import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, BrainCircuit, Activity, RefreshCw } from 'lucide-react';
import { ChatMessage, sendChatMessage } from '../services/aiChatService';
import { analyzeHistoricalPattern } from '../services/historicalPatternAnalyzer';

interface AIChatAssistantProps {
  evidencePack?: any;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ evidencePack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'مرحباً بك في محلل الاستراتيجيات الذكي (AI Strategy Analyst). يمكنك سؤالي عن أي نمط تاريخي في الاستراتيجية الحالية، مثلاً: "كم مرة لمس السعر R3 ثم وصل إلى S1؟"',
    timestamp: Date.now()
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      let result = await sendChatMessage(newMessages, { 
        hasEvidencePack: !!evidencePack,
        pineCode: evidencePack?.codeDraft || 'No active script'
      });

      if (result.actionRequired && result.toolCall?.name === 'analyze_historical_pattern') {
        // AI decided to run a historical pattern analysis!
        const args = result.toolCall.args;
        
        let toolOutput = "Tool failed: No evidence pack or bar traces available. Compile the script first.";
        if (evidencePack?.qaReport?.barTraces) {
           const stats = analyzeHistoricalPattern(evidencePack.qaReport.barTraces, args);
           toolOutput = JSON.stringify(stats, null, 2);
        }

        // Add tool execution back to conversation context
        const toolMsg: ChatMessage = {
          id: Date.now().toString() + '_tool',
          role: 'user', // We feed it back as user context
          content: `[System Output from deterministic engine]:\n${toolOutput}`,
          timestamp: Date.now(),
          toolResult: toolOutput
        };

        const messagesWithTool = [...newMessages, toolMsg];
        setMessages(messagesWithTool);
        
        // Second pass: let the AI explain the result
        result = await sendChatMessage(messagesWithTool, {});
      }

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: result.text || 'Done.',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[700px] w-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden font-sans" dir="rtl">
      <div className="flex items-center gap-3 p-4 bg-slate-800 border-b border-slate-700">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
          <BrainCircuit size={22} />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">AI Strategy Analyst</h2>
          <p className="text-slate-400 text-xs">محلل الاستراتيجيات الذكي (Deterministic Engine Connected)</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          if (msg.toolResult) return null; // Hide raw tool output from user view
          return (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                {msg.role === 'user' ? <Bot size={16} className="text-white" /> : <BrainCircuit size={16} className="text-emerald-400" />}
              </div>
              <div className={`max-w-[80%] rounded-xl p-3 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <RefreshCw size={14} className="text-slate-400 animate-spin" />
            </div>
            <div className="bg-slate-800 rounded-xl rounded-tl-none p-3 px-4 border border-slate-700">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="اسأل المحلل الذكي عن أنماط الاستراتيجية (مثلاً: ما هي نسبة نجاح R3 إلى S1؟)..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-white transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <Activity size={12} />
          <span>النتائج يتم حسابها رياضياً ولا يتم اختلاقها من قبل نموذج اللغة.</span>
        </div>
      </div>
    </div>
  );
};
