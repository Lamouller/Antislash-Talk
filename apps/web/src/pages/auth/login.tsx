
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, Mic2, Shield, Globe, Zap, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Version simplifiée sans la partie gauche (mode client)
function SimplifiedLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Navigation with safe area for Dynamic Island - Fixed to prevent scroll bounce */}
      <nav 
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 dark:bg-gray-900/20 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10 dark:border-gray-700/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                {t('auth.communityEdition')}
              </div>
            </div>
          </Link>
          <Link
            to="/auth/register"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('auth.signUp')}
          </Link>
        </div>
      </nav>

      {/* Main Content - Centered */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mic2 size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('auth.welcomeBack')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('auth.signInSubtitle')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={20} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                to="/auth/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('auth.signingIn')}
                </>
              ) : (
                <>
                  {t('auth.signIn')}
                  <ArrowRight size={20} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link to="/auth/register" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">
                {t('auth.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Version complète avec la partie gauche (mode SaaS - garde l'existant)
function FullLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Navigation with safe area for Dynamic Island - Fixed to prevent scroll bounce */}
      <nav 
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 dark:bg-gray-900/20 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10 dark:border-gray-700/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                {t('auth.communityEdition')}
              </div>
            </div>
          </Link>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/Lamouller/Antislash-Talk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Github size={20} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link
              to="/auth/register"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              {t('auth.signUpFree')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full">
          {/* Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-screen lg:min-h-0">

            {/* Left Side - Welcome & Features */}
            <div className="text-center lg:text-left px-4 lg:px-12">
              <div className="mb-8">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium mb-8">
                  <Shield size={16} className="mr-2" />
                  {t('auth.welcomePrivacy')}
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                  {t('auth.continueJourney')}
                </h1>

                <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed">
                  {t('auth.signInSubtitle')}
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Shield size={24} className="text-white flex-shrink-0" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('auth.localProcessing')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.localProcessingDesc')}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Globe size={24} className="text-white flex-shrink-0" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('auth.openSource')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.openSourceDesc')}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Zap size={24} className="text-white flex-shrink-0" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('auth.aiPowered')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.aiPoweredDesc')}</p>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex items-center justify-center px-4 lg:px-12">
              <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                {/* Form Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Mic2 size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.welcomeBack')}</h2>
                  <p className="text-gray-600 dark:text-gray-400">{t('auth.signInSubtitle')}</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-center">
                      <AlertCircle size={20} className="text-red-500 mr-2" />
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {t('auth.email')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={20} className="text-gray-400" />
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoCapitalize="none"
                        required
                        className="block w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={20} className="text-gray-400" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="block w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff size={20} className="text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye size={20} className="text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <Link
                      to="/auth/forgot-password"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('auth.signingIn')}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        {t('auth.signIn')}
                        <ArrowRight size={16} className="ml-2" />
                      </div>
                    )}
                  </button>
                </form>

                {/* Sign Up Link */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('auth.noAccount')}{' '}
                    <Link
                      to="/auth/register"
                      className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      {t('auth.createAccount')}
                    </Link>
                  </p>
                </div>

                {/* Enterprise Notice */}
                <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t('auth.enterpriseNeed')}
                    </p>
                    <a
                      href="https://github.com/Lamouller/Antislash-Talk-Enterprise"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <span className="bg-gradient-to-r from-orange-400 to-pink-400 text-transparent bg-clip-text font-bold mr-1">✨</span>
                      {t('auth.exploreEnterprise')}
                      <ArrowRight size={14} className="ml-1" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Composant principal qui choisit entre les deux versions
export default function LoginScreen() {
  const hideMarketingPages = import.meta.env.VITE_HIDE_MARKETING_PAGES === 'true';

  // Si marketing caché → Version simplifiée sans partie gauche
  // Si marketing visible → Version complète avec features
  return hideMarketingPages ? <SimplifiedLoginForm /> : <FullLoginForm />;
}
