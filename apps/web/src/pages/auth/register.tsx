
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mail, ArrowRight, CheckCircle, Mic2, Users, Code, Heart, Github, Star, Eye, EyeOff, Lock, AlertCircle, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Composant pour le formulaire d'inscription fonctionnel (mode client)
function FunctionalRegisterForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  const handleRegister = async () => {
    setLoading(true);
    setError('');

    // Validation
    if (!email || !password || !fullName) {
      setError(t('auth.fillAllFields'));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordLength'));
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      // Redirect to login after successful registration
      setTimeout(() => navigate('/auth/login'), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRegister();
  };

  if (success) {
    return (
      <div 
        className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-green-900 dark:to-emerald-900 flex items-center justify-center px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('auth.welcome')}</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              {t('auth.accountCreated')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('auth.redirecting')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-green-900 dark:to-emerald-900">
      {/* Navigation with safe area for Dynamic Island - Fixed to prevent scroll bounce */}
      <nav 
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 dark:bg-gray-900/20 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10 dark:border-gray-700/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
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
            to="/auth/login"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('auth.signIn')}
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('auth.createAccountTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('auth.joinToday')}</p>
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
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.fullName')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-gray-400" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:text-white transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

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
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:text-white transition-all"
                  placeholder="you@example.com"
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
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:text-white transition-all"
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.confirmPassword')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:text-white transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {t('auth.createAccountTitle')}
                  <ArrowRight size={20} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/auth/login" className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 font-semibold">
                {t('auth.signInHere')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Composant "Coming Soon" (mode SaaS - garde l'existant)
function ComingSoonRegister() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600">
      {/* Navigation - Fixed to prevent scroll bounce */}
      <nav 
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/10 dark:bg-gray-900/20 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></span>
                {t('auth.communityEdition')}
              </div>
            </div>
          </Link>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/Lamouller/Antislash-Talk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
            >
              <Github size={20} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link
              to="/auth/login"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors backdrop-blur-sm"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen pt-20">
        {/* Split Layout - Full Width */}
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 items-center">

          {/* Left Side - Community & Benefits */}
          <div className="flex items-center justify-center min-h-screen text-center lg:text-left text-white">
            <div className="w-full max-w-lg px-4 lg:px-8">
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-6">
                  <Star size={16} className="mr-2" />
                  Privay-First AI Revolution
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  {t('auth.comingSoonTitle')}
                </h1>

                <p className="text-lg text-emerald-100 mb-8 leading-relaxed">
                  {t('auth.comingSoonSubtitle')}
                </p>
              </div>

              {/* Benefits Grid - Compact */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Code size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">{t('auth.openSource')}</h3>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Heart size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">Free Forever</h3>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Users size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">{t('auth.community')}</h3>
                </div>
              </div>

              {/* Platform Stats - Compact */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">🚀</div>
                  <div className="text-emerald-100 text-xs">Upgrading</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">∞</div>
                  <div className="text-emerald-100 text-xs">Still Free</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">Soon</div>
                  <div className="text-emerald-100 text-xs">Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Coming Soon */}
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md mx-4 lg:mx-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">

              {/* Coming Soon Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <span className="text-3xl">🚀</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Coming Soon</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">{t('auth.comingSoonSubtitle')}</p>
              </div>

              {/* Status Information */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-6 border border-blue-200/50 dark:border-blue-700/50">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Platform Enhancement</span>
                  </div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    🛠️ {t('auth.platformUpgrade')}
                  </h3>
                </div>
              </div>

              {/* What's Coming */}
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-4">
                  What's Coming Next
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                      <CheckCircle size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Enhanced AI Models</p>
                    </div>
                  </div>

                  <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                      <Users size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Team Collaboration</p>
                    </div>
                  </div>

                  <div className="flex items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                      <Star size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Premium Features</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notify Me Section */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700 rounded-2xl p-6 mb-6">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    📧 {t('auth.getNotified')}
                  </h4>
                  <a
                    href="mailto:hello@antislash.studio?subject=Antislash Talk - Notify Me&body=Hi! I'd like to be notified when new registrations are available for Antislash Talk."
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Mail size={16} className="mr-2" />
                    {t('auth.notifyMe')}
                  </a>
                </div>
              </div>

              {/* Alternative Actions */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('auth.alreadyHaveAccount')}
                  </p>
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-700 border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 text-green-700 dark:text-green-300 font-semibold rounded-xl transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                  >
                    <ArrowRight size={16} className="mr-2" />
                    {t('auth.signInHere')}
                  </Link>
                </div>

                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Follow our progress on{' '}
                    <a
                      href="https://github.com/Lamouller/Antislash-Talk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 font-medium"
                    >
                      GitHub
                    </a>
                  </p>
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
export default function RegisterScreen() {
  const hideMarketingPages = import.meta.env.VITE_HIDE_MARKETING_PAGES === 'true';

  // Si marketing caché → Formulaire fonctionnel
  // Si marketing visible → Page "Coming Soon"
  return hideMarketingPages ? <FunctionalRegisterForm /> : <ComingSoonRegister />;
}