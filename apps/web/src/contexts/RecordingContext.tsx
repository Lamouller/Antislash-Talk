import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isTranscribing: boolean;
  transcriptionProgress: number;
}

interface RecordingContextType {
  state: RecordingState;
  updateState: (updates: Partial<RecordingState>) => void;
  resetState: () => void;
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

  const updateState = useCallback((updates: Partial<RecordingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <RecordingContext.Provider value={{ state, updateState, resetState }}>
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
