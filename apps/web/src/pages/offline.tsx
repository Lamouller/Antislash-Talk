import { useNavigate } from 'react-router-dom';
import { RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <Server className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          ⚠️ Services non disponibles
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Les services Supabase ne sont pas accessibles. Veuillez démarrer Docker et Supabase.
        </p>

        {/* Instructions */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Pour redémarrer les services :
              </h3>
              <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Ouvrez <strong>Docker Desktop</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Dans le terminal :</span>
                </li>
              </ol>
              <div className="mt-2 bg-gray-800 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
                cd /Users/trystanlamouller/Github_Lamouller/Antislash-Talk
                <br />
                docker-compose -f docker-compose.monorepo.yml up -d
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={checkConnection}
            disabled={checking}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer la connexion
              </>
            )}
          </Button>

          <a
            href="http://localhost:54323"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Ouvrir Supabase Studio →
          </a>
        </div>

        {/* Technical Details */}
        <details className="mt-6 text-left">
          <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            Détails techniques
          </summary>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
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

