import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  transcriptionProgress: number;
}

interface RecordingActions {
  onStart?: () => void;
  onStop?: () => void;
  onPauseResume?: () => void;
}

interface RecordingContextType {
  state: RecordingState;
  actions: RecordingActions;
  updateState: (updates: Partial<RecordingState>) => void;
  resetState: () => void;
  registerActions: (actions: RecordingActions) => void;
  unregisterActions: () => void;
}

const initialState: RecordingState = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  isTranscribing: false,
  transcriptionProgress: 0,
};

const RecordingContext = createContext<RecordingContextType | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordingState>(initialState);
  const actionsRef = useRef<RecordingActions>({});

  const updateState = useCallback((updates: Partial<RecordingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const registerActions = useCallback((actions: RecordingActions) => {
    actionsRef.current = actions;
  }, []);

  const unregisterActions = useCallback(() => {
    actionsRef.current = {};
  }, []);

  return (
    <RecordingContext.Provider value={{ state, actions: actionsRef.current, updateState, resetState, registerActions, unregisterActions }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecordingContext() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecordingContext must be used within a RecordingProvider');
  }
  return context;
}

// Helper hook for components that just need to read state (won't throw if outside provider)
export function useRecordingState(): RecordingState {
  const context = useContext(RecordingContext);
  return context?.state ?? initialState;
}

// Helper hook for components that need actions (NavBar)
export function useRecordingActions(): RecordingActions {
  const context = useContext(RecordingContext);
  return context?.actions ?? {};
}
