import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [supabaseOnline, setSupabaseOnline] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
    if (initialized && supabaseOnline) {
      const isAuthRoute = location.pathname.startsWith('/auth');
      const isOfflineRoute = location.pathname === '/offline';
      const isRootRoute = location.pathname === '/';
      
      if (session && isAuthRoute) {
        // Utilisateur connecté sur une page auth → rediriger vers /tabs
        navigate('/tabs', { replace: true });
      } else if (!session && !isAuthRoute && !isOfflineRoute && !isRootRoute) {
        // Utilisateur NON connecté sur une page protégée → rediriger vers / (page d'accueil)
        console.log('🔒 Page protégée - redirection vers la page d\'accueil');
        navigate('/', { replace: true });
      }
    }
  }, [session, initialized, supabaseOnline, navigate, location.pathname]);

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
    <div>
      <Toaster />
      <Outlet />
    </div>
  );
}