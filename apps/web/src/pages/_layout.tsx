import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';
import { useMarketingPagesConfig } from '../hooks/useMarketingPagesConfig';
import { Mic } from 'lucide-react';
import { RecordingProvider, useRecordingState } from '../contexts/RecordingContext';

// #region agent log - Global Debug Logs Panel Component
function GlobalDebugLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  
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
    if (isOpen && !isMinimized) {
      refreshLogs();
      const interval = setInterval(refreshLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isMinimized]);

  // Floating button when minimized
  if (isMinimized) {
    return (
      <button
        onClick={() => { setIsMinimized(false); setIsOpen(true); refreshLogs(); }}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-gray-900 text-yellow-400 rounded-full shadow-lg flex items-center justify-center text-lg font-bold border-2 border-yellow-400"
        title="Debug Logs"
      >
        🔍
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-gray-900 rounded-t-xl shadow-2xl border border-gray-700 max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <span className="text-yellow-400 font-mono text-sm">🔍 Debug Logs ({logs.length})</span>
          <div className="flex gap-2">
            <button onClick={refreshLogs} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Refresh</button>
            <button onClick={copyLogs} className={`px-2 py-1 ${copied ? 'bg-green-600' : 'bg-purple-600'} text-white rounded text-xs`}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
            <button onClick={clearLogs} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Clear</button>
            <button onClick={() => setIsMinimized(true)} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">—</button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          <pre className="text-green-400 whitespace-pre-wrap font-mono text-[10px]">
            {logs.length === 0 ? 'No logs yet.' : 
              logs.slice(-50).map((l: any) => `[${l.hypothesisId}] ${new Date(l.timestamp).toLocaleTimeString()} ${l.location}\n  ${l.message}: ${JSON.stringify(l.data)}`).join('\n\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
// #endregion

// Format time helper
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Global Liquid Glass Recording Button with Timer
function GlobalRecordingButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const recordingState = useRecordingState();
  
  // Don't show on record page (it has its own controls) or auth pages only
  const isRecordPage = location.pathname === '/tabs/record';
  const isAuthPage = location.pathname.startsWith('/auth');
  
  if (isRecordPage || isAuthPage) return null;

  const { isRecording, isPaused, duration, isTranscribing, transcriptionProgress } = recordingState;
  
  // Recording in progress - show timer and status
  if (isRecording || isTranscribing) {
    return (
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <button
          onClick={() => navigate('/tabs/record')}
          className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full transition-all duration-300 active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(50px) saturate(200%)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
            boxShadow: '0 2px 20px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.1)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Recording indicator */}
          <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
          
          {/* Timer */}
          <span className="text-white/90 text-lg font-mono font-semibold min-w-[60px]">
            {formatTime(duration)}
          </span>
          
          {/* Status */}
          <span className="text-white/60 text-xs font-medium">
            {isTranscribing ? 'Transcription...' : isPaused ? 'Pause' : 'REC'}
          </span>
          
          {/* Progress bar for transcription */}
          {isTranscribing && (
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${transcriptionProgress}%`,
                  background: 'rgba(255,255,255,0.7)'
                }}
              />
            </div>
          )}
        </button>
      </div>
    );
  }
  
  // Default state - show record button
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <button
        onClick={() => navigate('/tabs/record')}
        className="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 active:scale-95"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.1)',
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, rgba(255,59,48,0.85) 0%, rgba(255,45,85,0.85) 100%)',
            boxShadow: '0 2px 12px rgba(255,59,48,0.3)',
          }}
        >
          <Mic className="w-5 h-5 text-white" />
        </div>
        <span className="text-white/60 text-sm font-medium pr-1">Enregistrer</span>
      </button>
    </div>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [supabaseOnline, setSupabaseOnline] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldHideMarketingPages, loading: configLoading } = useMarketingPagesConfig();

  useEffect(() => {
    async function checkSession() {
      try {
        // Vérifier la connexion Supabase avec timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );

        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        setSession(session);
        setSupabaseOnline(true);
      } catch (error) {
        console.error('❌ Supabase connection error:', error);
        setSupabaseOnline(false);
        // Rediriger vers /offline seulement si on n'y est pas déjà
        if (location.pathname !== '/offline') {
          navigate('/offline', { replace: true });
        }
      } finally {
        setInitialized(true);
      }
    }
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (initialized && supabaseOnline && !configLoading) {
      const isAuthRoute = location.pathname.startsWith('/auth');
      const isAuthIndexRoute = location.pathname === '/auth';
      const isOfflineRoute = location.pathname === '/offline';
      const isRootRoute = location.pathname === '/';
      
      if (session && (isAuthRoute || isRootRoute)) {
        // Utilisateur connecté sur une page auth OU page marketing → rediriger vers /tabs
        console.log('✅ Utilisateur connecté - redirection vers /tabs');
        navigate('/tabs', { replace: true });
      } else if (!session && !isAuthRoute && !isOfflineRoute && !isRootRoute) {
        // Utilisateur NON connecté sur une page protégée → rediriger vers / (page d'accueil)
        console.log('🔒 Page protégée - redirection vers la page d\'accueil');
        navigate('/', { replace: true });
      } else if (!session && shouldHideMarketingPages) {
        // Marketing pages cachées → rediriger vers /auth/login
        if (isRootRoute) {
          console.log('🎯 Marketing pages cachées - redirection depuis / vers /auth/login');
          navigate('/auth/login', { replace: true });
        } else if (isAuthIndexRoute) {
          console.log('🎯 Marketing pages cachées - redirection depuis /auth vers /auth/login');
          navigate('/auth/login', { replace: true });
        }
        // Garder /auth/login et /auth/register accessibles
      }
    }
  }, [session, initialized, supabaseOnline, configLoading, shouldHideMarketingPages, navigate, location.pathname]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Initialisation...</p>
        </div>
      </div>
    );
  }

  return (
    <RecordingProvider>
      <div className="min-h-screen">
        <Toaster 
          position="top-center"
          containerStyle={{
            top: 'max(env(safe-area-inset-top, 0px), 20px)',
          }}
        />
        <Outlet />
        {/* Global Liquid Glass Recording Button - visible on all pages except record */}
        <GlobalRecordingButton />
        {/* Global Debug Panel - available on all pages */}
        <GlobalDebugLogsPanel />
      </div>
    </RecordingProvider>
  );
}