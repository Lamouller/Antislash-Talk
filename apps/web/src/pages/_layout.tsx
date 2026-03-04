import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';
import { useMarketingPagesConfig } from '../hooks/useMarketingPagesConfig';
import { RecordingProvider } from '../contexts/RecordingContext';

// #region agent log - Global Debug Logs Panel Component
function GlobalDebugLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshLogs = () => {
    setIsRefreshing(true);
    try {
      const stored = JSON.parse(localStorage.getItem('__debug_logs__') || '[]');
      setLogs(stored);
    } catch { setLogs([]); }
    setTimeout(() => setIsRefreshing(false), 300);
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

  if (isMinimized) {
    return (
      <button
        onClick={() => { setIsMinimized(false); setIsOpen(true); refreshLogs(); }}
        className="fixed bottom-20 right-4 z-50 w-10 h-10 bg-white/20 backdrop-blur-xl border border-gray-300/30 text-gray-500 rounded-xl shadow-lg flex items-center justify-center text-sm font-bold hover:bg-white/40 active:scale-95 transition-all"
        title="Debug Logs"
      >
        D
      </button>
    );
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-300/30 max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50">
          <span className="text-gray-700 font-medium text-sm">Debug Logs ({logs.length})</span>
          <div className="flex gap-1.5">
            <button
              onClick={refreshLogs}
              className={`px-3 py-1.5 ${isRefreshing ? 'bg-black' : 'bg-gray-100 hover:bg-gray-200'} ${isRefreshing ? 'text-white' : 'text-gray-700'} rounded-lg text-xs font-medium active:scale-95 transition-all`}
            >
              {isRefreshing ? 'OK' : 'Refresh'}
            </button>
            <button
              onClick={copyLogs}
              className={`px-3 py-1.5 ${copied ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} rounded-lg text-xs font-medium active:scale-95 transition-all`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg text-xs font-medium active:scale-95 transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium active:scale-95 transition-all"
            >
              Min
            </button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-3 custom-scrollbar">
          <pre className="text-gray-600 whitespace-pre-wrap font-mono text-[10px]">
            {logs.length === 0 ? 'No logs yet. Perform actions to see debug output.' :
              logs.slice(-50).map((l: any) => `[${l.hypothesisId}] ${new Date(l.timestamp).toLocaleTimeString()} ${l.location}\n  ${l.message}: ${JSON.stringify(l.data)}`).join('\n\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
// #endregion

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
        console.error('Supabase connection error:', error);
        setSupabaseOnline(false);
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
        navigate('/tabs', { replace: true });
      } else if (!session && !isAuthRoute && !isOfflineRoute && !isRootRoute) {
        navigate('/', { replace: true });
      } else if (!session && shouldHideMarketingPages) {
        if (isRootRoute) {
          navigate('/auth/login', { replace: true });
        } else if (isAuthIndexRoute) {
          navigate('/auth/login', { replace: true });
        }
      }
    }
  }, [session, initialized, supabaseOnline, configLoading, shouldHideMarketingPages, navigate, location.pathname]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm font-medium">Initialisation...</p>
        </div>
      </div>
    );
  }

  return (
    <RecordingProvider>
      {/* Animated gradient mesh background */}
      <div className="min-h-screen bg-[#F5F5F7] relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-[20vh] -right-[10vw] w-[50vw] h-[50vw] rounded-full bg-gray-300/30 blur-[120px] animate-float-slow" />
          <div className="absolute -bottom-[10vh] -left-[15vw] w-[45vw] h-[45vw] rounded-full bg-gray-200/25 blur-[100px] animate-float-medium" />
          <div className="absolute top-[30vh] right-[20vw] w-[30vw] h-[30vw] rounded-full bg-gray-300/20 blur-[100px] animate-float-fast" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}
          />
        </div>

        <div className="relative z-10">
          <Toaster
            position="top-center"
            containerStyle={{
              top: 'max(env(safe-area-inset-top, 0px), 20px)',
            }}
            toastOptions={{
              style: {
                background: 'rgba(255, 255, 255, 0.90)',
                backdropFilter: 'blur(16px)',
                color: '#1a1a1a',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              },
            }}
          />
          <Outlet />
          {(localStorage.getItem('__debug_mode__') === 'true' || import.meta.env.DEV) && <GlobalDebugLogsPanel />}
        </div>
      </div>
    </RecordingProvider>
  );
}
