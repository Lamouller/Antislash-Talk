import { useNavigate } from 'react-router-dom';
import { RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

export default function OfflinePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      // Essayer de se connecter à Supabase
      const { error } = await supabase.from('profiles').select('count').limit(1);

      if (!error) {
        // Connexion réussie, rediriger
        navigate('/');
        return;
      }
    } catch (err) {
      console.error('Still offline:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-2xl shadow-black/10 p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <Server className="w-12 h-12 text-gray-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-black mb-3">
          Services non disponibles
        </h1>

        {/* Message */}
        <p className="text-gray-500 mb-6">
          Les services Supabase ne sont pas accessibles. Veuillez demarrer Docker et Supabase.
        </p>

        {/* Instructions */}
        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-black mb-2">
                Pour redemarrer les services :
              </h3>
              <ol className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-black">1.</span>
                  <span>Ouvrez <strong>Docker Desktop</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-black">2.</span>
                  <span>Dans le terminal :</span>
                </li>
              </ol>
              <div className="mt-2 bg-gray-900 text-gray-300 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                cd /Users/trystanlamouller/Github_Lamouller/Antislash-Talk
                <br />
                docker-compose -f docker-compose.monorepo.yml up -d
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={checkConnection}
            disabled={checking}
            className="w-full h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Verification...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reessayer la connexion
              </>
            )}
          </button>

          <a
            href="http://localhost:54323"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-sm text-black font-medium hover:underline"
          >
            Ouvrir Supabase Studio
          </a>
        </div>

        {/* Technical Details */}
        <details className="mt-6 text-left">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-black">
            Details techniques
          </summary>
          <div className="mt-2 text-xs text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200 p-3 rounded-xl">
            <p><strong>URL Supabase :</strong> {import.meta.env.VITE_SUPABASE_URL}</p>
            <p className="mt-1"><strong>Services requis :</strong></p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>PostgreSQL (port 54322)</li>
              <li>Kong API Gateway (port 54321)</li>
              <li>GoTrue Auth</li>
              <li>PostgREST</li>
              <li>Edge Runtime</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
