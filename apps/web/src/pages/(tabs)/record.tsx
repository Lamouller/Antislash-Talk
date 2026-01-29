
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, Square, Pause as PauseIcon, RefreshCw, Play, Radio, Waves, Sparkles, Clock, FileAudio, Settings, Plus } from 'lucide-react';

// #region agent log - localStorage based for mobile debugging
const debugLog = (loc: string, msg: string, data: any, hyp: string) => { try { const logs = JSON.parse(localStorage.getItem('__debug_logs__') || '[]'); logs.push({location:loc,message:msg,data,timestamp:Date.now(),hypothesisId:hyp}); if(logs.length > 100) logs.shift(); localStorage.setItem('__debug_logs__', JSON.stringify(logs)); console.log(`[DEBUG:${hyp}] ${loc}: ${msg}`, data); } catch(e){} };
// #endregion
import { useWebAudioRecorder } from '../../hooks/useWebAudioRecorder';
import { useLocalTranscription, LocalTranscriptionResult } from '../../hooks/useLocalTranscription';
import { useOllama } from '../../hooks/useOllama';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useDisplayMode } from '../../hooks/useDisplayMode';
import { getAdaptivePrompts, getWhisperOptimizedPrompts, requiresSpecialPrompts } from '../../lib/adaptive-prompts';
import { processStreamingSegment, SpeakerMapping, SpeakerSegment } from '../../lib/speaker-name-detector';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { useTranslation, Trans } from 'react-i18next';

// IndexedDB helper for emergency recording backup
const EMERGENCY_DB_NAME = 'antislash-talk-emergency';
const EMERGENCY_STORE_NAME = 'recordings';

async function openEmergencyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EMERGENCY_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(EMERGENCY_STORE_NAME)) {
        db.createObjectStore(EMERGENCY_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveEmergencyRecording(data: {
  id: string;
  audioChunks: ArrayBuffer[];
  duration: number;
  title: string;
  timestamp: number;
  liveSegments: SpeakerSegment[];
}): Promise<void> {
  try {
    const db = await openEmergencyDB();
    const transaction = db.transaction(EMERGENCY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EMERGENCY_STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
    console.log('[Emergency Save] ✅ Recording saved to IndexedDB');
  } catch (err) {
    console.error('[Emergency Save] ❌ Failed to save:', err);
  }
}

async function getEmergencyRecording(): Promise<any | null> {
  try {
    const db = await openEmergencyDB();
    const transaction = db.transaction(EMERGENCY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(EMERGENCY_STORE_NAME);
    const recordings = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    // Return most recent recording
    return recordings.sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  } catch (err) {
    console.error('[Emergency Save] ❌ Failed to get:', err);
    return null;
  }
}

async function clearEmergencyRecording(): Promise<void> {
  try {
    const db = await openEmergencyDB();
    const transaction = db.transaction(EMERGENCY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EMERGENCY_STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
    console.log('[Emergency Save] 🗑️ Emergency recordings cleared');
  } catch (err) {
    console.error('[Emergency Save] ❌ Failed to clear:', err);
  }
}

// PromptTemplate interface
interface PromptTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: 'summary' | 'title' | 'system' | 'transcript' | 'custom';
  content: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// Local formatTime function to avoid import issues
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) {
    return '00:00';
  }
  const date = new Date(0);
  date.setSeconds(seconds);
  const timeString = date.toISOString().substr(14, 5);
  return timeString;
};

type PageState = 'ready' | 'recording' | 'saving' | 'uploading' | 'processing' | 'error' | 'local-transcribing';

// #region agent log - Debug Logs Panel Component
function DebugLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const refreshLogs = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('__debug_logs__') || '[]');
      setLogs(stored);
    } catch { setLogs([]); }
  };
  
  const clearLogs = () => {
    localStorage.setItem('__debug_logs__', '[]');
    setLogs([]);
  };

  const copyLogs = async () => {
    const logsText = logs.length === 0 
      ? 'No logs' 
      : logs.map((l: any) => `[${l.hypothesisId}] ${new Date(l.timestamp).toLocaleTimeString()} ${l.location}\n  ${l.message}: ${JSON.stringify(l.data)}`).join('\n\n');
    
    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for iOS
      const textArea = document.createElement('textarea');
      textArea.value = logsText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      refreshLogs();
      const interval = setInterval(refreshLogs, 2000); // Auto-refresh every 2s
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  
  return (
    <details className="mt-6 bg-gray-900 rounded-xl p-4 text-xs" open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-yellow-400 font-mono">🔍 Debug Logs ({logs.length}) - tap to expand</summary>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <div className="flex gap-2 mb-2">
          <button onClick={refreshLogs} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Refresh</button>
          <button onClick={copyLogs} className={`px-2 py-1 ${copied ? 'bg-green-600' : 'bg-purple-600'} text-white rounded text-xs`}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button onClick={clearLogs} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Clear</button>
        </div>
        <pre className="text-green-400 whitespace-pre-wrap font-mono text-[10px]">
          {logs.length === 0 ? 'No logs yet. Start recording, receive a call, then check here.' : 
            logs.map((l: any) => `[${l.hypothesisId}] ${new Date(l.timestamp).toLocaleTimeString()} ${l.location}\n  ${l.message}: ${JSON.stringify(l.data)}`).join('\n\n')}
        </pre>
      </div>
    </details>
  );
}
// #endregion

export default function RecordingScreen() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('ready');
  const [isPaused, setIsPaused] = useState(false);
  const [title, setTitle] = useState('');
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const [existingMeetingId, setExistingMeetingId] = useState<string | null>(null);
  const [preparationNotes, setPreparationNotes] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const { t } = useTranslation();

  // User preferences state
  const [userPreferences, setUserPreferences] = useState({
    transcription_provider: 'local',
    transcription_model: 'whisper-tiny',
    llm_provider: 'openai',
    llm_model: 'gpt-4o-mini'
  });

  // Custom prompts state
  const [userPrompts, setUserPrompts] = useState({
    title: '',
    summary: '',
    transcript: ''
  });

  // Prompt templates state
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  // Recording behavior state - restored auto-processing logic
  const [autoTranscribeAfterRecording, setAutoTranscribeAfterRecording] = useState(true);
  const [waitingForAutoProcess, setWaitingForAutoProcess] = useState(false);

  // 🚀 STREAMING TRANSCRIPTION STATE
  const [enableStreamingTranscription, setEnableStreamingTranscription] = useState(false);
  const [autoGenerateSummaryAfterStreaming, setAutoGenerateSummaryAfterStreaming] = useState(false);
  const [liveTranscriptionSegments, setLiveTranscriptionSegments] = useState<SpeakerSegment[]>([]);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [_speakerMapping, setSpeakerMapping] = useState<SpeakerMapping>({}); // 🎭 Mapping SPEAKER_00 -> "Marie" (stored for future use)
  const speakerMappingRef = useRef<SpeakerMapping>({}); // 🎭 Ref pour accès synchrone au mapping
  const transcriptionContainerRef = useRef<HTMLDivElement>(null); // 📜 Ref pour auto-scroll

  const {
    isRecording,
    isPaused: recorderIsPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecorder
  } = useWebAudioRecorder();

  const {
    transcribe,
    transcribeStreaming, // 🆕 STREAMING TRANSCRIPTION
    transcribeChunkLive, // 🚀 LIVE CHUNK TRANSCRIPTION
    isTranscribing,
    progress: transcriptionProgress,
    enhanceWithLocalLLM
  } = useLocalTranscription();

  // 🧪 TEST: Importer directement useOllama pour tester les custom prompts
  const ollama = useOllama();
  const generateTitle = ollama.generateTitle;
  const generateSummary = ollama.generateSummary;

  // 🔒 Wake Lock for preventing screen sleep on mobile (with iOS fallback)
  const { isSupported: wakeLockSupported, isActive: wakeLockActive, usingFallback: wakeLockUsingFallback, requestLock: requestWakeLock, releaseLock: releaseWakeLock } = useWakeLock();
  
  // 📱 Detect display mode (browser vs standalone PWA)
  const { isIOSStandalone } = useDisplayMode();

  // 🆘 Emergency save: store audio chunks for recovery if app is suspended
  const audioChunksForEmergencyRef = useRef<ArrayBuffer[]>([]);
  const emergencySaveIdRef = useRef<string>(`recording-${Date.now()}`);

  // 🆘 Emergency save function - called when app might be suspended
  const performEmergencySave = useCallback(async () => {
    if (!isRecording || audioChunksForEmergencyRef.current.length === 0) return;

    console.log('[record] 🆘 Performing emergency save...');
    
    await saveEmergencyRecording({
      id: emergencySaveIdRef.current,
      audioChunks: audioChunksForEmergencyRef.current,
      duration: duration,
      title: title || 'Untitled Recording',
      timestamp: Date.now(),
      liveSegments: liveTranscriptionSegments
    });

    toast('Recording saved for recovery', { icon: '💾' });
  }, [isRecording, duration, title, liveTranscriptionSegments]);

  // 🆘 Check for emergency recording on mount (recovery)
  useEffect(() => {
    const checkForEmergencyRecording = async () => {
      const emergencyData = await getEmergencyRecording();
      if (emergencyData && emergencyData.audioChunks?.length > 0) {
        const timeSinceSave = Date.now() - emergencyData.timestamp;
        const minutesAgo = Math.round(timeSinceSave / 60000);
        
        // Only offer recovery if saved within last 30 minutes
        if (timeSinceSave < 30 * 60 * 1000) {
          toast(
            (t) => (
              <div className="flex flex-col gap-2">
                <span>🆘 Found interrupted recording ({minutesAgo}min ago)</span>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
                    onClick={() => {
                      // TODO: Implement recovery logic
                      toast.dismiss(t.id);
                      toast.success('Recovery feature coming soon');
                    }}
                  >
                    Recover
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-300 rounded text-sm"
                    onClick={() => {
                      clearEmergencyRecording();
                      toast.dismiss(t.id);
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ),
            { duration: 10000 }
          );
        } else {
          // Too old, clear it
          await clearEmergencyRecording();
        }
      }
    };

    checkForEmergencyRecording();
  }, []);

  // 🆘 Set up emergency save listeners for iOS standalone mode
  useEffect(() => {
    if (!isIOSStandalone) return;

    console.log('[record] 📱 iOS Standalone mode - setting up emergency save listeners');

    const handleVisibilityChange = () => {
      // #region agent log - Hypothesis D: Monitor visibility change and recording state
      debugLog('record.tsx:visibilityChange', 'Page visibility changed', { visibilityState: document.visibilityState, isRecording, isPaused, pageState }, 'D');
      // #endregion
      if (document.visibilityState === 'hidden' && isRecording) {
        console.log('[record] 👁️ Page hidden while recording - emergency save');
        performEmergencySave();
      }
      // #region agent log - Hypothesis D: Check if we return visible while recording
      if (document.visibilityState === 'visible' && isRecording) {
        debugLog('record.tsx:visibilityChange:visible', 'Returned visible while recording', { isRecording, isPaused }, 'D');
      }
      // #endregion
    };

    const handlePageHide = () => {
      if (isRecording) {
        console.log('[record] 📴 Page hide event while recording - emergency save');
        performEmergencySave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        console.log('[record] ⚠️ Before unload while recording - emergency save');
        performEmergencySave();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isIOSStandalone, isRecording, performEmergencySave]);

  // #region agent log - Hypothesis A,B,D: Add global visibility listener (not just iOS standalone)
  useEffect(() => {
    const globalVisibilityHandler = () => {
      debugLog('record.tsx:globalVisibility', 'Global visibility change', { visibilityState: document.visibilityState, isRecording, isPaused, pageState }, 'D');
    };
    document.addEventListener('visibilitychange', globalVisibilityHandler);
    return () => document.removeEventListener('visibilitychange', globalVisibilityHandler);
  }, [isRecording, isPaused, pageState]);
  // #endregion

  // 🎵 Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[record] 🧹 Component unmounting - cleaning up...');
      // Wake lock cleanup is handled by the useWakeLock hook
      console.log('[record] ✅ Cleanup complete');
    };
  }, []);

  useEffect(() => {
    // #region agent log - Hypothesis A: Track state sync from hook to component
    debugLog('record.tsx:useEffect:syncIsPaused', 'Syncing isPaused from hook', { oldIsPaused: isPaused, newRecorderIsPaused: recorderIsPaused, timestamp: Date.now() }, 'A');
    // #endregion
    setIsPaused(recorderIsPaused);
  }, [recorderIsPaused]);

  // 🎯 Load existing meeting if meetingId is provided in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const meetingId = searchParams.get('meetingId');
    
    if (meetingId) {
      console.log('🔗 Meeting ID provided in URL:', meetingId);
      setExistingMeetingId(meetingId);
      
      // Load meeting details
      const loadMeeting = async () => {
        try {
          const { data: meeting, error } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', meetingId)
            .single();
          
          if (error) throw error;
          
          if (meeting) {
            console.log('✅ Loaded existing meeting:', meeting);
            setTitle(meeting.title || '');
            setPreparationNotes(meeting.preparation_notes || '');
            
            // If meeting has preparation notes, show toast
            if (meeting.preparation_notes) {
              toast.success(`📝 Recording for: ${meeting.title}`, { duration: 3000 });
            }
          }
        } catch (error) {
          console.error('❌ Failed to load meeting:', error);
          toast.error('Failed to load meeting details');
        }
      };
      
      loadMeeting();
    }
  }, []);

  // 📜 Auto-scroll vers le bas quand de nouveaux segments arrivent
  useEffect(() => {
    if (transcriptionContainerRef.current && liveTranscriptionSegments.length > 0) {
      transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
    }
  }, [liveTranscriptionSegments]);

  // Auto-processing when audioBlob becomes available
  useEffect(() => {
    if (waitingForAutoProcess && audioBlob && !isRecording) {
      console.log('✅ AudioBlob ready, starting auto-processing');
      setWaitingForAutoProcess(false);

      if (userPreferences.transcription_provider === 'local') {
        console.log('🏠 Starting local transcription automatically');
        handleTranscription(userPreferences.transcription_provider, userPreferences.transcription_model);
      } else {
        console.log('☁️ Starting cloud transcription upload automatically');
        handleSave(); // This triggers the Netlify webhook
      }
    }
  }, [waitingForAutoProcess, audioBlob, isRecording, userPreferences]);

  // Fetch user preferences on component mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('preferred_transcription_provider, preferred_transcription_model, preferred_llm, preferred_llm_model, prompt_title, prompt_summary, prompt_transcript, auto_transcribe_after_recording, preferred_language, enable_streaming_transcription, auto_generate_summary_after_streaming')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Could not fetch user preferences:', error.message);
          return;
        }

        if (profile) {
          setUserPreferences({
            transcription_provider: profile.preferred_transcription_provider || 'local',
            transcription_model: profile.preferred_transcription_model || 'whisper-tiny',
            llm_provider: profile.preferred_llm || 'openai',
            llm_model: profile.preferred_llm_model || 'gpt-4o-mini'
          });

          // Use adaptive prompts based on transcription provider and language
          const adaptivePrompts = requiresSpecialPrompts(profile.preferred_transcription_provider, profile.preferred_transcription_model)
            ? getWhisperOptimizedPrompts(profile.preferred_language || 'fr')
            : getAdaptivePrompts(
              profile.preferred_transcription_provider || 'openai',
              profile.preferred_language || 'fr',
              {
                title: profile.prompt_title,
                summary: profile.prompt_summary,
                transcript: profile.prompt_transcript
              }
            );

          setUserPrompts(adaptivePrompts);

          console.log('🎯 Loaded user preferences:', {
            transcription_provider: profile.preferred_transcription_provider,
            transcription_model: profile.preferred_transcription_model,
            llm_provider: profile.preferred_llm,
            llm_model: profile.preferred_llm_model
          });

          console.log('📝 Loaded custom prompts:', {
            title: profile.prompt_title ? 'Custom' : 'Default',
            summary: profile.prompt_summary ? 'Custom' : 'Default',
            transcript: profile.prompt_transcript ? 'Custom' : 'Default'
          });

          // Set recording behavior preference from DB
          setAutoTranscribeAfterRecording(profile.auto_transcribe_after_recording ?? true);
          console.log('🎬 Auto-transcribe after recording:', profile.auto_transcribe_after_recording ?? true);

          // Set streaming transcription preference from DB
          setEnableStreamingTranscription(profile.enable_streaming_transcription ?? false);
          setAutoGenerateSummaryAfterStreaming(profile.auto_generate_summary_after_streaming ?? false);
          console.log('🚀 Streaming transcription enabled:', profile.enable_streaming_transcription ?? false);
          console.log('🤖 Auto-generate summary enabled:', profile.auto_generate_summary_after_streaming ?? false);
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      }
    };

    fetchUserPreferences();
  }, []);

  // Fetch prompt templates on component mount
  useEffect(() => {
    const fetchPromptTemplates = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Only fetch summary and custom prompts (those applicable to summary generation)
        const { data, error } = await supabase
          .from('prompt_templates')
          .select('*')
          .eq('user_id', user.id)
          .in('category', ['summary', 'custom'])
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Could not fetch prompt templates:', error.message);
          return;
        }

        const templates = data || [];
        setPromptTemplates(templates);
        console.log('📝 Loaded summary prompt templates:', templates.length);

        // Auto-select the starred (favorite) prompt if one exists
        const favoritePrompt = templates.find(t => t.is_favorite);
        if (favoritePrompt) {
          console.log('⭐ Auto-selecting favorite prompt:', favoritePrompt.name);
          setSelectedPromptId(favoritePrompt.id);
          // Apply the favorite prompt immediately
          setUserPrompts(prev => ({ ...prev, summary: favoritePrompt.content }));
        }
      } catch (error) {
        console.error('Error fetching prompt templates:', error);
      }
    };

    fetchPromptTemplates();
  }, []);

  // Function to apply a prompt template
  const applyPromptTemplate = (templateId: string) => {
    // Handle deselection (empty value)
    if (!templateId) {
      setSelectedPromptId(null);
      console.log('🔄 Prompt deselected, reverting to default');
      return;
    }

    const template = promptTemplates.find(t => t.id === templateId);
    if (!template) {
      console.warn('❌ Template not found:', templateId);
      return;
    }

    // #region agent log - Hypothesis F: Track prompt selection
    debugLog('record.tsx:applyPromptTemplate', 'PROMPT SELECTED', { templateId, templateName: template.name, contentLength: template.content?.length, contentPreview: template.content?.substring(0, 100) }, 'F');
    // #endregion

    console.log('✨ Applying prompt template:', template.name, 'Category:', template.category, 'Content length:', template.content?.length);

    // All prompts in this selector are for summary (filtered in fetch)
    setUserPrompts(prev => {
      const updated = { ...prev, summary: template.content };
      // #region agent log - Hypothesis F: Confirm state update
      debugLog('record.tsx:applyPromptTemplate:setState', 'userPrompts.summary UPDATED', { oldSummaryLength: prev.summary?.length, newSummaryLength: template.content?.length }, 'F');
      // #endregion
      console.log('📝 Updated userPrompts.summary to:', template.content?.substring(0, 50) + '...');
      return updated;
    });

    setSelectedPromptId(templateId);
    toast.success(`Prompt "${template.name}" appliqué ✨`);
  };


  const handleStartRecording = async () => {
    try {
      console.log('%c[record] 🎙️ STARTING RECORDING', 'color: #10b981; font-weight: bold; font-size: 14px');
      console.log('');
      console.log('🔍 DIAGNOSTIC - LIVE STREAMING ACTIVATION CHECK');
      console.log('='.repeat(60));
      console.log(`  ✅ Streaming toggle enabled: ${enableStreamingTranscription ? '✅ YES' : '❌ NO'}`);
      console.log(`  ✅ Model name: "${userPreferences.transcription_model || 'NOT SET'}"`);
      console.log(`  ✅ Model includes "diarization": ${userPreferences.transcription_model?.includes('diarization') ? '✅ YES' : '❌ NO'}`);
      console.log(`  ✅ Both conditions met: ${(enableStreamingTranscription && userPreferences.transcription_model?.includes('diarization')) ? '✅ YES - LIVE MODE WILL ACTIVATE!' : '❌ NO - BATCH MODE ONLY'}`);
      console.log('='.repeat(60));
      console.log('');

      // 🔒 Request Wake Lock (with automatic iOS fallback)
      // This is non-blocking and handles both native Wake Lock and iOS NoSleep pattern
      if (wakeLockSupported) {
        requestWakeLock().then(success => {
          if (success) {
            console.log(`[record] ✅ Wake Lock activated ${wakeLockUsingFallback ? '(iOS fallback)' : '(native)'}`);
            if (isIOSStandalone) {
              console.log('[record] 📱 iOS Standalone mode - extra wake lock measures active');
            }
          } else {
            console.warn('[record] ⚠️ Wake Lock request failed');
          }
        });
      }

      // 🆘 Reset emergency save state
      audioChunksForEmergencyRef.current = [];
      emergencySaveIdRef.current = `recording-${Date.now()}`;

      // Réinitialiser les segments live et le mapping de speakers
      setLiveTranscriptionSegments([]);
      setSpeakerMapping({});
      speakerMappingRef.current = {};
      setIsStreamingActive(false);

      // 🚀 Si streaming activé ET modèle avec diarization → LIVE TRANSCRIPTION
      if (enableStreamingTranscription && userPreferences.transcription_model?.includes('diarization')) {
        console.log('%c[record] 🚀 LIVE STREAMING MODE ACTIVATED!', 'color: #7c3aed; font-weight: bold; font-size: 16px; background: #ede9fe; padding: 8px 16px; border-radius: 8px');
        setIsStreamingActive(true);

        // Callback pour traiter chaque chunk audio live
        const handleChunkReady = async (chunk: Blob, chunkIndex: number) => {
          console.log(`%c[record] 📦 CHUNK #${chunkIndex} READY FOR LIVE TRANSCRIPTION`, 'color: #f59e0b; font-weight: bold');

          // Transcrire le chunk en temps réel (non-bloquant)
          transcribeChunkLive(
            chunk,
            chunkIndex,
            // Callback pour chaque segment reçu du chunk
            (segment) => {
              console.log(`%c[record] 🎤 NEW LIVE SEGMENT RECEIVED!`, 'color: #16a34a; font-weight: bold; font-size: 14px; background: #f0fdf4; padding: 4px 8px');
              console.log(`[record]   └─ Text: "${segment.text}"`);
              console.log(`[record]   └─ Speaker: ${segment.speaker || 'Unknown'}`);
              console.log(`[record]   └─ Current segments count: ${liveTranscriptionSegments.length}`);

              // 🎭 DÉTECTION INTELLIGENTE DES NOMS + APPLICATION RÉTROACTIVE
              const newSegment: SpeakerSegment = {
                text: segment.text,
                speaker: segment.speaker,
                start: segment.start,
                end: segment.end
              };

              console.log(`[record] 🔄 Processing segment with speaker name detection...`);
              const { updatedSegments, updatedMapping } = processStreamingSegment(
                newSegment,
                liveTranscriptionSegments, // Pass all previous segments
                speakerMappingRef.current
              );

              console.log(`[record]   └─ Updated segments count: ${updatedSegments.length}`);

              // Mettre à jour le mapping si un nom a été détecté
              if (updatedMapping !== speakerMappingRef.current) {
                console.log('%c[record] 🎭 NAME DETECTED! Updating all segments...', 'color: #f59e0b; font-weight: bold', updatedMapping);
                speakerMappingRef.current = updatedMapping;
                setSpeakerMapping(updatedMapping);
              }

              // Utiliser les segments mis à jour (incluent le nouveau + noms rétroactifs appliqués)
              console.log(`%c[record] 📊 UPDATING UI WITH ${updatedSegments.length} SEGMENTS`, 'color: #3b82f6; font-weight: bold');
              setLiveTranscriptionSegments(updatedSegments);
              console.log(`%c[record] ✅ UI UPDATED!`, 'color: #16a34a; font-weight: bold');
            }
          ).catch(err => {
            console.error(`[record] ❌ Failed to transcribe chunk #${chunkIndex}:`, err);
          });
        };

        await startRecording(handleChunkReady); // Passer le callback
      } else {
        console.log('[record] 📦 BATCH MODE - Recording without live transcription');
        await startRecording(); // Pas de callback
      }

      setPageState('recording');
      toast.success(t('record.recordingInProgress') + ' 🎙️');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Please check your microphone permissions.');
      setPageState('error');
    }
  };

  const handleStopRecording = async () => {
    console.log('%c[record] ⏹️ STOPPING RECORDING', 'color: #dc2626; font-weight: bold');
    stopRecording();

    // 🔓 Release Wake Lock (handles both native and iOS fallback)
    if (wakeLockActive) {
      await releaseWakeLock();
      console.log('[record] 🔓 Wake Lock released');
    }

    // 🆘 Clear emergency recording data (successful stop = no need for recovery)
    audioChunksForEmergencyRef.current = [];
    await clearEmergencyRecording();

    // Désactiver le mode streaming live (la transcription continue pour les derniers chunks)
    setIsStreamingActive(false);
    console.log(`[record] Live segments received: ${liveTranscriptionSegments.length}`);

    setPageState('ready');
    toast.success('Recording stopped');

    // Auto-processing si activé dans les préférences
    if (autoTranscribeAfterRecording) {
      console.log('🤖 Auto-processing enabled, waiting for audioBlob...');
      toast.success('Auto-processing will start once recording is ready... 🤖');
      setWaitingForAutoProcess(true);
    } else {
      console.log('🎙️ Auto-processing disabled, showing manual options');
    }
  };

  const handlePauseResume = () => {
    // #region agent log - Hypothesis A,E: Track UI click and state before action
    debugLog('record.tsx:handlePauseResume', 'BUTTON CLICKED', { isPaused, recorderIsPaused, isRecording, timestamp: Date.now() }, 'A');
    // #endregion
    if (isPaused) {
      // #region agent log - Hypothesis A,E: About to call resumeRecording
      debugLog('record.tsx:handlePauseResume:resume', 'Calling resumeRecording()', { isPaused, recorderIsPaused }, 'A');
      // #endregion
      resumeRecording();
      toast.success('Recording resumed');
    } else {
      // #region agent log - Hypothesis A,E: About to call pauseRecording
      debugLog('record.tsx:handlePauseResume:pause', 'Calling pauseRecording()', { isPaused, recorderIsPaused }, 'A');
      // #endregion
      pauseRecording();
      toast.success('Recording paused');
    }
  };

  const handleTranscription = async (_provider: string, model: string) => {
    if (!audioBlob) {
      toast.error(t('record.noAudioRecorded'));
      return;
    }

    try {
      setPageState('local-transcribing');

      console.log('🎯 Starting transcription with custom prompts:', userPrompts);
      // #region agent log - Hypothesis F,G: Check userPrompts at transcription start
      debugLog('record.tsx:handleTranscription', 'TRANSCRIPTION STARTED', { selectedPromptId, userPromptsSummaryLength: userPrompts.summary?.length, userPromptsSummaryPreview: userPrompts.summary?.substring(0, 100), userPromptsTitleLength: userPrompts.title?.length }, 'F');
      // #endregion

      // 🚀 STREAMING MODE: Si activé et compatible
      if (enableStreamingTranscription && model.includes('diarization')) {
        console.log(`%c[record] 🚀 STREAMING MODE ACTIVATED!`, 'color: #7c3aed; font-weight: bold; font-size: 14px');
        setIsStreamingActive(true);
        setLiveTranscriptionSegments([]); // Réinitialiser les segments
        setSpeakerMapping({}); // Réinitialiser le mapping des noms
        speakerMappingRef.current = {}; // Réinitialiser le ref du mapping

        try {
          const result = await transcribeStreaming(
            audioBlob,
            model,
            // 🎭 Callback pour chaque segment reçu en temps réel avec détection de noms ! 🔥
            (segment) => {
              console.log(`%c[record] 🎤 NEW LIVE SEGMENT #${liveTranscriptionSegments.length + 1}`, 'color: #16a34a; font-weight: bold', segment);

              // 🎭 DÉTECTION INTELLIGENTE DES NOMS + APPLICATION RÉTROACTIVE
              const newSegment: SpeakerSegment = {
                text: segment.text,
                speaker: segment.speaker,
                start: segment.start,
                end: segment.end
              };

              // Utiliser le ref pour accès synchrone au mapping
              setLiveTranscriptionSegments((prevSegments) => {
                // Traitement intelligent: détecte les noms et met à jour TOUS les segments
                const { updatedSegments, updatedMapping, nameDetected, detectedName } = processStreamingSegment(
                  newSegment,
                  prevSegments,
                  speakerMappingRef.current
                );

                console.log(`%c[record] 📊 Total segments: ${updatedSegments.length}`, 'color: #3b82f6; font-weight: bold');

                // Mettre à jour le mapping dans le ref ET dans le state
                speakerMappingRef.current = updatedMapping;
                setSpeakerMapping(updatedMapping);

                // Si un nom a été détecté, afficher une notification
                if (nameDetected && detectedName) {
                  toast.success(`🎉 Locuteur identifié : ${detectedName}`, { duration: 3000 });
                }

                // Retourner les segments mis à jour (avec noms appliqués rétroactivement)
                return updatedSegments;
              });
            }
          );

          setIsStreamingActive(false);

          if (result && result.text) {
            console.log('✅ Streaming transcription completed!');

            // 🚀 EN MODE STREAMING : Skip Ollama (trop long) et save directement
            // Le summary peut être généré plus tard en background ou à la demande
            console.log('💡 Streaming mode: Skipping Ollama enhancement (too slow for real-time UX)');
            console.log('   → Meeting will be saved with basic metadata');
            console.log('   → User can generate summary later from the meeting detail page');

            // Générer un titre basique
            const basicTitle = result.text.split('.')[0]?.trim().substring(0, 60) || `Live Meeting ${new Date().toLocaleDateString()}`;

            const enhancedResult = {
              ...result,
              enhancedTitle: basicTitle,
              enhancedSummary: `📊 **Live Transcription Completed**\n\n✨ Transcribed with WhisperX ultra-fast streaming\n🎭 ${result.chunks?.length || 0} segments with speaker diarization\n\n💡 You can generate a detailed summary from the meeting detail page.`
            } as LocalTranscriptionResult & { enhancedTitle: string; enhancedSummary: string };

            toast.success('🎉 Streaming transcription completed! Saving...', { duration: 2000 });
            const savedMeeting = await handleSave(enhancedResult);

            // 🤖 AUTO-GENERATE SUMMARY EN BACKGROUND (si activé)
            if (autoGenerateSummaryAfterStreaming && savedMeeting?.id) {
              console.log('🤖 AUTO-SUMMARY ACTIVATED! Generating in background...');
              toast('🤖 Generating AI summary in background...', { duration: 3000 });

              // Générer en background (ne bloque pas l'UX)
              (async () => {
                try {
                  console.log('📝 Generating title with AI using custom prompts...');
                  console.log('   → Custom title prompt:', userPrompts.title ? 'YES' : 'NO');
                  const aiTitle = await generateTitle(result.text, userPrompts.title || undefined);

                  console.log('📊 Generating summary with AI using custom prompts...');
                  console.log('   → Custom summary prompt:', userPrompts.summary ? 'YES' : 'NO');
                  console.log('   → Context notes:', contextNotes ? 'YES' : 'NO');
                  
                  // #region agent log - Hypothesis G: Check prompt at generation time
                  debugLog('record.tsx:generateSummary', 'GENERATING SUMMARY', { userPromptsSummaryLength: userPrompts.summary?.length, userPromptsSummaryPreview: userPrompts.summary?.substring(0, 100), hasContextNotes: !!contextNotes }, 'G');
                  // #endregion
                  
                  // Enrich summary prompt with context notes if provided
                  let summaryPrompt = userPrompts.summary;
                  if (contextNotes) {
                    const contextSection = `\n\nADDITIONAL CONTEXT NOTES (to include in the summary):\n${contextNotes}`;
                    summaryPrompt = summaryPrompt ? summaryPrompt + contextSection : `Summarize the following meeting transcript. Pay special attention to the context notes provided.${contextSection}`;
                  }
                  
                  const aiSummary = await generateSummary(result.text, summaryPrompt || undefined);

                  // Mettre à jour le meeting avec le titre et summary générés
                  const { error: updateError } = await supabase
                    .from('meetings')
                    .update({
                      title: aiTitle || basicTitle,
                      summary: aiSummary || enhancedResult.enhancedSummary
                    })
                    .eq('id', savedMeeting.id);

                  if (updateError) {
                    console.error('❌ Failed to update meeting with AI content:', updateError);
                  } else {
                    console.log('✅ Meeting updated with AI-generated content!');
                    console.log('   → Title:', aiTitle);
                    console.log('   → Summary length:', aiSummary?.length || 0, 'chars');
                    toast.success('✨ AI summary generated successfully!', { duration: 3000 });
                  }
                } catch (aiError) {
                  console.error('❌ AI generation failed:', aiError);
                  toast.error('Failed to generate AI summary', { duration: 3000 });
                }
              })();
            }
          } else {
            throw new Error('Streaming transcription failed');
          }
        } catch (streamError) {
          console.error('⚠️ Streaming failed, falling back to batch...', streamError);
          setIsStreamingActive(false);
          toast.error('Streaming failed, using batch mode...');
          // Continue with batch mode below
        }

        return; // Exit if streaming succeeded
      }

      // 📦 BATCH MODE: Transcription classique (non-streaming)
      console.log('[record] 📦 BATCH MODE (standard transcription)');
      const result = await transcribe(audioBlob, model);

      if (result && result.text) {
        console.log('✅ Transcription completed, enhancing with custom prompts...');

        // Apply custom prompts for enhancement
        try {
          // #region agent log - Hypothesis G: Check prompt before enhanceWithLocalLLM
          debugLog('record.tsx:enhanceWithLocalLLM', 'CALLING enhanceWithLocalLLM', { userPromptsSummaryLength: userPrompts.summary?.length, userPromptsSummaryPreview: userPrompts.summary?.substring(0, 100), llmModel: userPreferences.llm_model }, 'G');
          // #endregion
          // Pass Ollama model for local LLM enhancement
          const enhanced = await enhanceWithLocalLLM(result.text, userPrompts, userPreferences.llm_model);
          console.log('🌟 Enhanced result with custom prompts:', enhanced);

          // Combine transcription result with enhanced metadata
          const enhancedResult = {
            ...result,
            enhancedTitle: enhanced.title,
            enhancedSummary: enhanced.summary
          } as LocalTranscriptionResult & { enhancedTitle: string; enhancedSummary: string };

          toast.success('Transcription & enhancement completed! ✨');
          await handleSave(enhancedResult);
        } catch (enhanceError) {
          console.warn('⚠️ Enhancement failed, using basic result:', enhanceError);
          toast.success('Transcription completed! ✨');
          await handleSave(result);
        }
      } else {
        throw new Error('Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPageState('error');
      setIsStreamingActive(false);
    }
  };

  const handleMistralTranscription = async () => {
    await handleTranscription('mistral', 'Voxtral-Mini-3B');
  };

  const handleSave = async (transcriptionResult?: LocalTranscriptionResult & { enhancedTitle?: string; enhancedSummary?: string }) => {
    console.log('💾 handleSave called with:', {
      hasAudioBlob: !!audioBlob,
      audioBlobSize: audioBlob?.size,
      hasTranscriptionResult: !!transcriptionResult,
      autoTranscribeAfterRecording,
      userPreferences
    });

    if (!audioBlob && !transcriptionResult) {
      console.error('❌ No recording to save - missing both audioBlob and transcriptionResult');
      toast.error(t('record.noRecordingToSave'));
      return;
    }

    try {
      console.log('🚀 Starting handleSave process...');
      setPageState('saving');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 User authentication check:', { hasUser: !!user, userError });
      if (!user) throw new Error('User not authenticated');

      let audioUrl = null;
      let transcript = null;
      let summary = null;

      // Upload audio if we have it
      if (audioBlob) {
        console.log('📤 Starting audio upload...', {
          audioBlobSize: audioBlob.size,
          audioBlobType: audioBlob.type
        });
        setPageState('uploading');
        
        // 🔧 Determine file extension based on blob type (iOS compatibility)
        const timestamp = Date.now();
        let fileExtension = 'webm';
        let contentType = audioBlob.type || 'audio/webm';
        
        if (contentType.includes('mp4') || contentType.includes('m4a')) {
          fileExtension = 'mp4';
          console.log('🍎 Using .mp4 extension for iOS recording');
        } else if (contentType.includes('webm')) {
          fileExtension = 'webm';
          console.log('🎵 Using .webm extension for standard recording');
        }
        
        const fileName = `${user.id}/${timestamp}.${fileExtension}`;
        console.log('📁 Upload path:', fileName, '| Content-Type:', contentType);

        const { error: uploadError } = await supabase.storage
          .from('meetingrecordings')
          .upload(fileName, audioBlob, {
            contentType: contentType,
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          throw uploadError;
        }

        console.log('✅ Audio uploaded successfully to:', fileName);
        // Store just the file path, not the full URL
        // This is consistent with how the Supabase functions handle it
        audioUrl = fileName;
      } else {
        console.log('⚠️ No audioBlob to upload');
      }

      // Use transcription result if available
      let meetingTitle = title; // Store the final title to use

      if (transcriptionResult) {
        // Store transcript as array of chunks (expected format by meeting detail page)
        transcript = transcriptionResult.chunks || [];

        // Use enhanced metadata if available
        const enhanced = transcriptionResult as any;
        if (enhanced.enhancedTitle || enhanced.enhancedSummary) {
          // Use enhanced title directly (don't wait for React state update)
          if (enhanced.enhancedTitle) {
            meetingTitle = enhanced.enhancedTitle;
            setTitle(enhanced.enhancedTitle); // Update UI
            console.log('📝 Using enhanced title:', enhanced.enhancedTitle);
          }
          summary = enhanced.enhancedSummary || generateBasicSummary(transcriptionResult);
          console.log('📝 Using enhanced metadata from custom prompts');
        } else {
          // Generate a basic summary from the transcription
          summary = generateBasicSummary(transcriptionResult);
          console.log('📝 Generated basic summary from transcription');
        }
      }

      // Helper function to generate a basic summary
      function generateBasicSummary(result: LocalTranscriptionResult): string {
        const text = result.text || '';
        const chunks = result.chunks || [];
        const duration = result.chunks && result.chunks.length > 0
          ? Math.round(result.chunks[result.chunks.length - 1].end)
          : 0;

        // Extract key information
        const speakerCount = new Set(chunks.map(c => c.speaker)).size;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const firstSentences = sentences.slice(0, 3).join('. ').trim();

        return t('record.summaryTemplate', {
          minutes: Math.floor(duration / 60),
          seconds: duration % 60,
          speakerCount: speakerCount,
          segmentsCount: chunks.length,
          firstSentences: firstSentences
        });
      }

      // Insert meeting record with user preferences AND selected prompts
      const meetingPayload: any = {
        user_id: user.id,
        title: meetingTitle || title || `Meeting ${new Date().toLocaleDateString()}`,
        duration: Math.round(duration),
        recording_url: audioUrl,
        transcript: transcript,
        summary: summary,
        status: transcriptionResult ? 'completed' : 'pending',
        transcription_provider: transcriptionResult ? 'local' : userPreferences.transcription_provider,
        transcription_model: userPreferences.transcription_model,
        participant_count: 1,
        // Save selected prompts for async transcription (verified: columns exist in DB)
        prompt_title: userPrompts.title || null,
        prompt_summary: userPrompts.summary || null,
        prompt_transcript: userPrompts.transcript || null
      };

      // Only add new columns if they're available (after migration)
      // This prevents 400 errors if migrations haven't been run yet
      if (contextNotes) {
        meetingPayload.context_notes = contextNotes;
      }
      
      // Set meeting_status if it's a draft meeting being updated
      if (existingMeetingId) {
        meetingPayload.meeting_status = transcriptionResult ? 'completed' : 'in_progress';
      }

      console.log('💾 Inserting meeting with payload:', meetingPayload);
      console.log('📝 User prompts being saved:', {
        title: userPrompts.title?.substring(0, 50) + '...',
        summary: userPrompts.summary?.substring(0, 50) + '...',
        transcript: userPrompts.transcript?.substring(0, 50) + '...'
      });




      let meetingData;
      let meetingError;

      if (existingMeetingId) {
        // 🔄 Update existing meeting (when recording from a draft)
        console.log('🔄 Updating existing meeting:', existingMeetingId);
        console.log('📦 Update payload:', meetingPayload);
        
        const result = await supabase
          .from('meetings')
          .update(meetingPayload)
          .eq('id', existingMeetingId)
          .select()
          .single();
        
        meetingData = result.data;
        meetingError = result.error;
        
        if (meetingError) {
          console.error('❌ Update error:', meetingError);
          console.error('📦 Failed payload:', JSON.stringify(meetingPayload, null, 2));
        }
      } else {
        // ✨ Create new meeting
        console.log('📦 Insert payload:', meetingPayload);
        
        const result = await supabase
          .from('meetings')
          .insert(meetingPayload)
          .select()
          .single();
        
        meetingData = result.data;
        meetingError = result.error;
        
        if (meetingError) {
          console.error('❌ Insert error:', meetingError);
          console.error('📦 Failed payload:', JSON.stringify(meetingPayload, null, 2));
        }
      }

      console.log('💾 Saved meeting with preferences:', {
        id: meetingData.id,
        title: meetingData.title,
        status: transcriptionResult ? 'completed' : 'pending',
        transcription_provider: transcriptionResult ? 'local' : userPreferences.transcription_provider,
        transcription_model: userPreferences.transcription_model,
        has_audio: !!audioUrl,
        has_transcript: !!transcript,
        will_trigger_async: !transcriptionResult && userPreferences.transcription_provider !== 'local'
      });

      if (meetingError) {
        console.error('❌ Meeting creation error:', meetingError);
        throw meetingError;
      }

      console.log('✅ Meeting created successfully:', meetingData);

      // Trigger transcription and WAIT for completion (non-local providers)
      if (!transcriptionResult && userPreferences.transcription_provider !== 'local') {
        console.log('🚀 Triggering transcription with provider:', userPreferences.transcription_provider);
        try {
          setPageState('processing');
          toast.loading('🔄 Transcription en cours... Veuillez patienter.', { duration: Infinity, id: 'transcription-progress' });

          // Call start-transcription function
          const { data: { session } } = await supabase.auth.getSession();
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/start-transcription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              meeting_id: meetingData.id
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          console.log('✅ Transcription started:', result);

          // Poll the meeting status until transcription is complete
          console.log('⏳ Waiting for transcription to complete...');
          let attempts = 0;
          const maxAttempts = 120; // 120 * 5s = 10 minutes max
          let isCompleted = false;

          while (!isCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;

            // Check meeting status
            const { data: meeting, error: fetchError } = await supabase
              .from('meetings')
              .select('status, transcript, summary')
              .eq('id', meetingData.id)
              .single();

            if (fetchError) {
              console.error('❌ Error fetching meeting status:', fetchError);
              break;
            }

            console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} - Status:`, meeting?.status);

            if (meeting?.transcript && Array.isArray(meeting.transcript) && meeting.transcript.length > 0) {
              console.log('✅ Transcription completed!');
              isCompleted = true;
              toast.success('✅ Transcription terminée avec succès !', { id: 'transcription-progress', duration: 3000 });
              break;
            }

            // Update progress message
            if (attempts % 3 === 0) {
              toast.loading(`🔄 Transcription en cours... (${Math.round(attempts * 100 / maxAttempts)}%)`, { id: 'transcription-progress' });
            }
          }

          if (!isCompleted) {
            console.warn('⚠️ Transcription timeout - navigating anyway');
            toast.dismiss('transcription-progress');
            toast('⏱️ Transcription prend plus de temps que prévu. Vous pouvez vérifier plus tard.', { duration: 5000, icon: '⚠️' });
          }

        } catch (error) {
          console.error('❌ Failed to start transcription:', error);
          toast.dismiss('transcription-progress');
          toast.error('❌ Erreur lors de la transcription');
        }
      }

      setSavedMeetingId(meetingData.id);
      setPageState('ready');

      if (transcriptionResult) {
        toast.success(t('record.successTitle'));
      } else {
        toast.success(t('record.successDesc'));
      }

      // Reset form
      resetRecorder();
      setTitle('');

      // Navigate to the meeting detail
      setTimeout(() => {
        navigate(`/tabs/meeting/${meetingData.id}`);
      }, 1000);

      // 🎯 Return the created meeting for auto-summary
      return meetingData;

    } catch (error) {
      console.error('❌ Save error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        hasAudioBlob: !!audioBlob,
        hasUser: !!(await supabase.auth.getUser()).data.user
      });

      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }

      toast.error(`Failed to save meeting: ${errorMessage}`);
      setPageState('error');
      setWaitingForAutoProcess(false); // Reset waiting state on error
    }
  };

  const getStateConfig = () => {
    switch (pageState) {
      case 'recording':
        return {
          title: t('record.recordingInProgress'),
          subtitle: t('record.captureAudio'),
          color: 'from-red-500 to-pink-600',
          icon: Radio,
          bgColor: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20'
        };
      case 'local-transcribing':
        return {
          title: t('record.transcribing'),
          subtitle: t('record.convertingToText'),
          color: 'from-blue-500 to-indigo-600',
          icon: Waves,
          bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
        };
      case 'saving':
      case 'uploading':
        return {
          title: t('record.saving'),
          subtitle: t('record.uploading'),
          color: 'from-green-500 to-emerald-600',
          icon: RefreshCw,
          bgColor: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
        };
      case 'error':
        return {
          title: t('record.error'),
          subtitle: t('record.somethingWrong'),
          color: 'from-red-500 to-pink-600',
          icon: Square,
          bgColor: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20'
        };
      default:
        return {
          title: t('record.ready'),
          subtitle: t('record.startCapturing'),
          color: 'from-purple-500 to-pink-600',
          icon: Mic,
          bgColor: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
        };
    }
  };

  const stateConfig = getStateConfig();
  const StateIcon = stateConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-purple-900/20 dark:to-pink-900/20">
      {/* iOS Standalone mode indicator (for debugging) - positioned below safe area */}
      {isIOSStandalone && (
        <div 
          className="fixed left-0 right-0 bg-purple-600 text-white text-xs text-center py-1 z-50"
          style={{ top: 'env(safe-area-inset-top, 0px)' }}
        >
          📱 PWA Mode {wakeLockActive ? '• Wake Lock Active' : ''}
        </div>
      )}

      <div 
        className="relative overflow-hidden pb-16"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-red-600/10"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg mb-6">
              <FileAudio className="w-5 h-5 text-purple-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('record.audioRecording')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 dark:from-white dark:via-purple-200 dark:to-pink-200 bg-clip-text text-transparent mb-4">
              {stateConfig.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {stateConfig.subtitle}
            </p>
          </div>

          {/* Main Recording Interface */}
          <div className="max-w-2xl mx-auto">

            {/* Status Card */}
            <div className={`bg-gradient-to-r ${stateConfig.bgColor} backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-8 mb-8`}>
              <div className="text-center">
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r ${stateConfig.color} flex items-center justify-center shadow-xl animate-pulse`}>
                  <StateIcon className="w-12 h-12 text-white" />
                </div>

                {/* Timer */}
                <div className="text-center mb-6">
                  <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white mb-2">
                    {formatTime(duration)}
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{t('record.duration')}</span>
                  </div>
                </div>

                {/* Recording Indicator */}
                {isRecording && (
                  <div className="flex items-center justify-center space-x-2 mb-6">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {isPaused ? t('record.paused') : t('record.recording')}
                    </span>
                  </div>
                )}

                {/* Progress for transcription */}
                {isTranscribing && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{t('record.transcribingProgress')}</span>
                      <span>{Math.round(transcriptionProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${transcriptionProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 🚀 LIVE TRANSCRIPTION ZONE - Visible dès le début de l'enregistrement ! */}
            {(enableStreamingTranscription && (isRecording || isStreamingActive || isTranscribing || liveTranscriptionSegments.length > 0)) && (
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-700/50 rounded-2xl p-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center animate-pulse">
                    <Waves className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      💬 {t('record.liveTranscription')}
                    </h3>
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      {t('record.liveSubtitle')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStreamingActive ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          {t('record.streaming')}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {liveTranscriptionSegments.length > 0 ? t('record.completed') : t('record.ready')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Scrollable transcription zone - Auto-scroll activé */}
                <div
                  ref={transcriptionContainerRef}
                  className="max-h-96 overflow-y-auto bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 space-y-3 border border-violet-200/50 dark:border-violet-700/30 scroll-smooth"
                >
                  {liveTranscriptionSegments.length > 0 ? (
                    liveTranscriptionSegments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
                        <div className="flex items-start gap-3">
                          {segment.speaker && (
                            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2 py-1 rounded-full">
                              {segment.speaker}
                            </span>
                          )}
                          <p className="flex-1 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                            {segment.text}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Waves className="w-5 h-5 text-violet-500 animate-pulse" />
                        <span>{t('record.waiting')}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        {t('record.segmentsAppear')}
                      </p>
                    </div>
                  )}

                  {/* Loading indicator - visible only during active streaming */}
                  {isStreamingActive && liveTranscriptionSegments.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      <span className="ml-2">{t('record.receivingSegments')}</span>
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="mt-4 flex items-center justify-between text-xs text-violet-600 dark:text-violet-400">
                  <span>✨ {t('record.segmentsReceived', { count: liveTranscriptionSegments.length })}</span>
                  <span>🏆 {t('record.diarization')}</span>
                </div>
              </div>
            )}

            {/* Audio Security Policy Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    🔒 {t('record.securityPolicy')}
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <Trans i18nKey="record.securityDesc" components={{ strong: <strong /> }} />
                  </p>
                </div>
              </div>
            </div>

            {/* Meeting Title Input */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6 mb-8">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t('record.meetingTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Meeting ${new Date().toLocaleDateString()}`}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                disabled={isRecording || isTranscribing}
              />
            </div>

            {/* Preparation Notes (read-only) */}
            {preparationNotes && (
              <div className="bg-blue-50/70 dark:bg-blue-900/20 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg p-6 mb-8">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  📝 Notes de préparation
                </h3>
                <div className="text-sm text-blue-800 dark:text-blue-200 max-h-60 overflow-y-auto p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <MarkdownRenderer content={preparationNotes} />
                </div>
              </div>
            )}

            {/* Context Notes (editable) - for enriching the summary */}
            <div className="bg-amber-50/70 dark:bg-amber-900/20 backdrop-blur-sm rounded-2xl border border-amber-200/50 dark:border-amber-700/50 shadow-lg p-6 mb-8">
              <label className="block text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                📌 Notes de contexte (optionnel)
              </label>
              <textarea
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                placeholder="Ajoutez des notes pendant l'enregistrement pour enrichir le résumé AI (ex: décisions prises, points clés, références non-verbales...)"
                className="w-full px-4 py-3 border border-amber-200 dark:border-amber-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all min-h-[120px] resize-y"
                disabled={isTranscribing}
              />
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                💡 Ces notes seront utilisées comme contexte additionnel lors de la génération du résumé AI
              </p>
            </div>

            {/* User Preferences Display */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                {t('record.settingsTitle')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200/30 dark:border-blue-700/30">
                  <div className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium">{t('record.provider')}</div>
                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 capitalize">
                    {userPreferences.transcription_provider}
                    {userPreferences.transcription_provider === 'local' && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                        {t('record.private')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200/30 dark:border-purple-700/30">
                  <div className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide font-medium">{t('record.model')}</div>
                  <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {userPreferences.transcription_model}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                {userPreferences.transcription_provider === 'local' ? (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    {t('record.localDesc')}
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    {t('record.cloudDesc')}
                  </span>
                )}

                {(userPrompts.title !== 'Generate a short, descriptive title for the meeting in French.' ||
                  userPrompts.summary !== 'Provide a concise one-paragraph summary of the key discussion points and decisions, in French.' ||
                  userPrompts.transcript !== 'A detailed, diarized transcript with speaker identification.') && (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                      {t('record.customPrompts')}
                    </span>
                  )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-4">
              {!isRecording && !audioBlob && (
                <Button
                  onClick={handleStartRecording}
                  disabled={pageState !== 'ready'}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  <Mic className="w-6 h-6 mr-3" />
                  {t('record.startRecording')}
                </Button>
              )}


              {isRecording && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={handlePauseResume}
                    variant="outline"
                    className="py-4 text-lg font-semibold rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-6 h-6 mr-2" />
                        {t('record.resume')}
                      </>
                    ) : (
                      <>
                        <PauseIcon className="w-6 h-6 mr-2" />
                        {t('record.pause')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Square className="w-6 h-6 mr-2" />
                    {t('record.stop')}
                  </Button>
                </div>
              )}

              {audioBlob && !isRecording && !autoTranscribeAfterRecording && (
                <div className="space-y-4">
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
                      {t('record.processingOptions')}
                    </h3>

                    {/* Prompt Template Selector */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 mb-4 border border-purple-200 dark:border-purple-700/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 flex items-center">
                          <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                          {t('record.promptTemplate')}
                        </h4>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => navigate('/tabs/prompts')}
                          className="text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {t('record.managePrompts')}
                        </Button>
                      </div>

                      {promptTemplates.length > 0 ? (
                        <>
                          <select
                            className="w-full px-4 py-3 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                            value={selectedPromptId || ''}
                            onChange={(e) => applyPromptTemplate(e.target.value)}
                            disabled={isTranscribing}
                          >
                            <option value="">{t('record.selectPrompt')}</option>
                            {promptTemplates.map(template => (
                              <option key={template.id} value={template.id}>
                                {template.is_favorite && '⭐ '}
                                {template.name}
                              </option>
                            ))}
                          </select>
                          {selectedPromptId && (
                            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                              ✓ Prompt sélectionné pour le résumé
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-2 text-sm text-purple-700 dark:text-purple-300">
                          <p className="mb-2">{t('record.noPrompts')}</p>
                          <Button
                            variant="outline"
                            size="small"
                            onClick={() => navigate('/tabs/prompts')}
                          >
                            {t('record.createFirst')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Automatic processing with user preferences */}
                    <div className="grid gap-3">
                      <Button
                        onClick={() => {
                          if (userPreferences.transcription_provider === 'local') {
                            handleTranscription('local', userPreferences.transcription_model);
                          } else {
                            handleSave(); // Will trigger async transcription with user preferences
                          }
                        }}
                        disabled={isTranscribing}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg font-semibold"
                      >
                        {userPreferences.transcription_provider === 'local' ? (
                          <>
                            <Waves className="w-5 h-5 mr-2" />
                            {t('record.transcribeLocal', { model: userPreferences.transcription_model })}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            {t('record.processCloud', { provider: userPreferences.transcription_provider, model: userPreferences.transcription_model })}
                          </>
                        )}
                      </Button>

                      {/* Alternative options */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                          🔧 {t('record.otherOptions')}
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {userPreferences.transcription_provider !== 'local' && (
                            <Button
                              onClick={() => handleTranscription('local', 'Xenova/whisper-tiny')}
                              disabled={isTranscribing}
                              variant="outline"
                              className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                            >
                              <Waves className="w-4 h-4 mr-2" />
                              {t('record.tryLocal')}
                            </Button>
                          )}
                          <Button
                            onClick={handleMistralTranscription}
                            disabled={isTranscribing}
                            variant="outline"
                            className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {t('record.testMistral')}
                          </Button>
                          <Button
                            onClick={() => handleSave()}
                            disabled={isTranscribing}
                            variant="outline"
                            className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <FileAudio className="w-4 h-4 mr-2" />
                            {t('record.saveAudioOnly')}
                          </Button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-transcription indicator when enabled */}
              {audioBlob && !isRecording && autoTranscribeAfterRecording && !isTranscribing && (
                <div className="bg-blue-50/70 dark:bg-blue-900/30 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg p-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {t('record.autoProcessingEnabled')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {userPreferences.transcription_provider === 'local'
                        ? t('record.localDesc')
                        : t('record.cloudDesc')
                      } using your preferred settings:
                      <br />
                      <span className="font-medium">{userPreferences.transcription_provider} - {userPreferences.transcription_model}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('record.changeSettings')}
                    </p>
                  </div>
                </div>
              )}

              {/* Reset Button */}
              {(audioBlob || pageState === 'error') && !isRecording && !isTranscribing && (
                <Button
                  onClick={() => {
                    resetRecorder();
                    setTitle('');
                    setPageState('ready');
                    setSavedMeetingId(null);
                  }}
                  variant="outline"
                  className="w-full py-3 rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  {t('record.startOver')}
                </Button>
              )}

              {/* #region agent log - Debug Logs Panel */}
              <DebugLogsPanel />
              {/* #endregion */}
            </div>

            {/* Success Message */}
            {savedMeetingId && (
              <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm rounded-2xl border border-green-200/50 dark:border-green-700/50 shadow-lg p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    {t('record.successTitle')}
                  </h3>
                  <p className="text-green-700 dark:text-green-300 mb-4">
                    {t('record.successDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}