import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AnalysisRuntimeContext } from '../types/runtimeContext';

interface RuntimeContextValue {
  context: AnalysisRuntimeContext | null;
  setContext: (c: AnalysisRuntimeContext) => void;
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined);

export const AnalysisRuntimeProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const [context, setContext] = useState<AnalysisRuntimeContext | null>(null);
  return (
    <RuntimeContext.Provider value={{ context, setContext }}>
      {children}
    </RuntimeContext.Provider>
  );
};

export const useAnalysisRuntimeContext = () => {
  const v = useContext(RuntimeContext);
  if (!v) throw new Error('AnalysisRuntimeContext provider missing');
  return v.context;
};

export const useSetAnalysisRuntimeContext = () => {
  const v = useContext(RuntimeContext);
  if (!v) throw new Error('AnalysisRuntimeContext provider missing');
  return v.setContext;
};
