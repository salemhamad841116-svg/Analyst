import React, { useState, useEffect, useRef } from 'react';
import { actionEngine } from '../../services/ActionEngine';
import { Action } from '../../types/actions';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { z } from 'zod';
import { getRuntimeProbeRecords } from '../../services/runtimeOriginProbe';

const ActionPlanSchema = z.object({
  id: z.string(),
  intent: z.string(),
  target: z.string(),
  actions: z.array(z.any()).min(1),
  summary: z.string()
});

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  stage?: string;
  actionPlan?: any;
}

export const CommandCenter: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(() => localStorage.getItem('cc_expanded') !== 'false');
  const [isVisible, setIsVisible] = useState(() => localStorage.getItem('cc_visible') !== 'false');
  const [messages, setMessages] = useState<ChatMessage[]>(() => JSON.parse(localStorage.getItem('cc_messages') || '[]'));
  const [position, setPosition] = useState(() => JSON.parse(localStorage.getItem('cc_pos') || '{"x": 0, "y": 0}'));
  const [size, setSize] = useState(() => JSON.parse(localStorage.getItem('cc_size') || '{"width": 384, "height": 500}'));
  const [input, setInput] = useState('');
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [status, setStatus] = useState(() => localStorage.getItem('cc_status') || 'READY');
  const [debug, setDebug] = useState<any>(null);
  const nodeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('cc_expanded', String(isExpanded));
    localStorage.setItem('cc_visible', String(isVisible));
    localStorage.setItem('cc_messages', JSON.stringify(messages));
    localStorage.setItem('cc_pos', JSON.stringify(position));
    localStorage.setItem('cc_size', JSON.stringify(size));
    localStorage.setItem('cc_status', status);
    
    // Temp debug probe
    const records = getRuntimeProbeRecords();
    console.table(records);
  }, [isExpanded, isVisible, messages, position, size, status]);

  useEffect(() => {
    const handleResize = () => {
      const maxX = Math.max(window.innerWidth - (size.width || 384), 0);
      const maxY = Math.max(window.innerHeight - (size.height || (isExpanded ? 500 : 50)), 0);
      setPosition((prev: {x: number, y: number}) => ({
        x: Math.min(Math.max(prev.x, 0), maxX),
        y: Math.min(Math.max(prev.y, 0), maxY)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size.width, size.height, isExpanded]);

  const handleDrag = (_e: any, data: { x: number, y: number }) => {
    const maxX = Math.max(window.innerWidth - (size.width || 384), 0);
    const maxY = Math.max(window.innerHeight - (size.height || (isExpanded ? 500 : 50)), 0);
    setPosition({
      x: Math.min(Math.max(data.x, 0), maxX),
      y: Math.min(Math.max(data.y, 0), maxY)
    });
  };

  const handleResize = (_e: any, { size }: { size: { width: number, height: number } }) => {
    setSize(size);
  };

  if (!isVisible) {
    return (
      <button 
        className="fixed bottom-4 right-4 bg-slate-900 text-white p-3 rounded-full shadow-lg z-50"
        onClick={() => setIsVisible(true)}
      >
        AI
      </button>
    );
  }

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const getStatusColor = (s: string) => {
    if (['READY', 'RENDERED', 'APPLIED'].includes(s)) return 'bg-green-500';
    if (['PARSING', 'PREVIEW READY'].includes(s)) return 'bg-yellow-500';
    if (s === 'ERROR') return 'bg-red-500';
    return 'bg-slate-400';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userPrompt = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }]);
    setStatus('PARSING');
    
    try {
      const response = await fetch('/api/platform/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt, context: {} }),
      });
      const data = await response.json();
      
      setDebug({ rawResponse: data });

      if (!data.success || !data.actionPlan) {
        throw new Error(data.error?.message || 'Invalid API response format');
      }

      const actionPlan = ActionPlanSchema.parse(data.actionPlan);
      
      setStatus('PREVIEW READY');
      setMessages((prev) => [...prev, { role: 'ai', content: 'PARSED / VALIDATED / PREVIEW READY', actionPlan }]);
      
      setPendingAction({
        id: actionPlan.id,
        type: actionPlan.intent as any,
        payload: { components: actionPlan.actions },
        timestamp: Date.now(),
        status: 'PENDING',
        userId: 'user123'
      });
    } catch (error) {
      setStatus('ERROR');
      setMessages((prev) => [...prev, { role: 'ai', content: `PARSER_ERROR: ${error}` }]);
      setDebug((prev: any) => ({ ...prev, error }));
    }
  };

  const handleApply = async () => {
    if (pendingAction) {
      setStatus('RENDERED');
      try {
        await actionEngine.applyAction(pendingAction);
      } catch (error) {
        console.error('[COMMAND_APPLY_ERROR]', error);
        setStatus('ERROR');
        setMessages((prev) => [...prev, { role: 'ai', content: `ACTION_APPLY_ERROR: ${error}` }]);
      } finally {
        setPendingAction(null);
      }
    }
  };

  const Content = () => (
    <div className={`bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex flex-col h-full`}>
      <div className="flex justify-between items-center mb-2 cursor-move" id="cc-handle">
        <div className="flex items-center gap-2 cursor-pointer" onClick={toggleExpand}>
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
          <h3 className="text-sm font-semibold truncate">
            AI Command Center <span className="opacity-70">• {status}</span>
          </h3>
        </div>
        <div className="flex gap-1">
          <button onClick={toggleExpand} className="text-slate-500 hover:text-slate-900">{isExpanded ? '—' : '⌃'}</button>
          <button onClick={() => setIsVisible(false)} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>
      </div>
      
      {isExpanded && (
        <>
          <div className="flex-1 overflow-y-auto mb-2 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`text-xs p-2 rounded ${m.role === 'user' ? 'bg-slate-100 text-right' : 'bg-blue-50'}`}>
                {m.content}
                {m.actionPlan && <pre className="mt-1 bg-white p-1 rounded border text-[10px]">{JSON.stringify(m.actionPlan, null, 2)}</pre>}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe changes..."
              className="w-full text-sm p-2 border border-slate-300 rounded mb-2"
            />
          </form>
          {pendingAction && (
            <div className="flex gap-2">
              <button className="bg-slate-900 text-white px-3 py-1 rounded text-xs" onClick={handleApply}>Apply</button>
              <button className="bg-red-500 text-white px-3 py-1 rounded text-xs" onClick={() => setPendingAction(null)}>Cancel</button>
            </div>
          )}
        </>
      )}
      {debug && isExpanded && (
        <div className="mt-2 text-[10px] bg-slate-900 text-green-400 p-2 rounded overflow-x-auto">
          <pre>{JSON.stringify(debug, null, 2)}</pre>
        </div>
      )}
    </div>
  );

  return (
    <Draggable handle="#cc-handle" nodeRef={nodeRef} position={position} onDrag={handleDrag}>
      <div ref={nodeRef} className="fixed z-50">
        <ResizableBox width={size.width} height={isExpanded ? size.height : 50} minConstraints={[200, 50]} maxConstraints={[800, 800]} onResize={handleResize}>
          <Content />
        </ResizableBox>
      </div>
    </Draggable>
  );
};
