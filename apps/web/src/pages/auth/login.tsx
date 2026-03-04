
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, Mic2, Shield, Globe, Zap, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Version simplifiee sans la partie gauche (mode client)
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
    <div className="min-h-screen">
      {/* Navigation with safe area for Dynamic Island */}
      <nav
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 backdrop-blur-xl border-b border-gray-300/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-black p-2 rounded-xl shadow-lg shadow-black/10 group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                {t('auth.communityEdition')}
              </div>
            </div>
          </Link>
          <Link
            to="/auth/register"
            className="px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
          >
            {t('auth.signUp')}
          </Link>
        </div>
      </nav>

      {/* Main Content - Centered */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-2xl shadow-black/10 p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/10">
              <Mic2 size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-black mb-3">{t('auth.welcomeBack')}</h2>
            <p className="text-sm text-gray-500">{t('auth.signInSubtitle')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
              <AlertCircle size={20} className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full h-12 pl-12 pr-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 focus:outline-none transition-all"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full h-12 pl-12 pr-12 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 focus:outline-none transition-all"
                  placeholder="--------"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-gray-600 hover:text-black transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
            <p className="text-sm text-gray-600">
              {t('auth.noAccount')}{' '}
              <Link to="/auth/register" className="text-black font-medium hover:underline">
                {t('auth.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Version complete avec la partie gauche (mode SaaS)
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
    <div className="min-h-screen">
      {/* Navigation with safe area for Dynamic Island */}
      <nav
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 backdrop-blur-xl border-b border-gray-300/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-black p-2 rounded-xl shadow-lg shadow-black/10 group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                {t('auth.communityEdition')}
              </div>
            </div>
          </Link>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/Lamouller/Antislash-Talk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-500 hover:text-black transition-colors"
            >
              <Github size={20} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link
              to="/auth/register"
              className="px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
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
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-8">
                  <Shield size={16} className="mr-2" />
                  {t('auth.welcomePrivacy')}
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black tracking-tight mb-6">
                  {t('auth.continueJourney')}
                </h1>

                <p className="text-lg text-gray-500 mb-12 leading-relaxed">
                  {t('auth.signInSubtitle')}
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
                  <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                    <Shield size={24} className="text-black" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">{t('auth.localProcessing')}</h3>
                  <p className="text-sm text-gray-500">{t('auth.localProcessingDesc')}</p>
                </div>

                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
                  <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                    <Globe size={24} className="text-black" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">{t('auth.openSource')}</h3>
                  <p className="text-sm text-gray-500">{t('auth.openSourceDesc')}</p>
                </div>

                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
                  <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                    <Zap size={24} className="text-black" />
                  </div>
                  <h3 className="font-semibold text-black mb-2">{t('auth.aiPowered')}</h3>
                  <p className="text-sm text-gray-500">{t('auth.aiPoweredDesc')}</p>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex items-center justify-center px-4 lg:px-12">
              <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-2xl shadow-black/10 p-8">
                {/* Form Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/10">
                    <Mic2 size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-black mb-2">{t('auth.welcomeBack')}</h2>
                  <p className="text-sm text-gray-500">{t('auth.signInSubtitle')}</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center">
                      <AlertCircle size={20} className="text-red-600 mr-2" />
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
                        placeholder="you@example.com"
                        autoCapitalize="none"
                        required
                        className="w-full h-12 pl-12 pr-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                        placeholder="--------"
                        required
                        className="w-full h-12 pl-12 pr-12 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <Link
                      to="/auth/forgot-password"
                      className="text-sm text-gray-600 hover:text-black transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
                  <p className="text-sm text-gray-600">
                    {t('auth.noAccount')}{' '}
                    <Link
                      to="/auth/register"
                      className="text-black font-medium hover:underline"
                    >
                      {t('auth.createAccount')}
                    </Link>
                  </p>
                </div>

                {/* Enterprise Notice */}
                <div className="mt-6 p-4 bg-white/40 backdrop-blur-sm border border-gray-200 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-2">
                      {t('auth.enterpriseNeed')}
                    </p>
                    <a
                      href="https://github.com/Lamouller/Antislash-Talk-Enterprise"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-black font-medium hover:underline"
                    >
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

  // Si marketing cache -> Version simplifiee sans partie gauche
  // Si marketing visible -> Version complete avec features
  return hideMarketingPages ? <SimplifiedLoginForm /> : <FullLoginForm />;
}
