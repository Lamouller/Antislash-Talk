import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setInitialized(true);
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
    if (initialized) {
      const isAuthRoute = location.pathname.startsWith('/auth');
      
      if (session && isAuthRoute) {
        // Logged-in user on an auth page, redirect to tabs
        navigate('/tabs');
      } else if (!session && !isAuthRoute && location.pathname !== '/') {
        // Not logged-in user on a protected page, redirect to auth
        navigate('/auth');
      }
    }
  }, [session, initialized, navigate, location.pathname]);

  if (!initialized) {
    return null; // or a loading screen
  }

  return (
    <div>
      <Toaster />
      <Outlet />
    </div>
  );
}