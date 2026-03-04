
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mail, ArrowRight, CheckCircle, Mic, Eye, EyeOff, AlertCircle, Github, Star, Code, Heart, Users } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center px-4 bg-white">
        <div className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-black mb-4">Welcome!</h2>
            <p className="text-gray-500 mb-6">
              Your account has been created successfully.
            </p>
            <p className="text-sm text-gray-400">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Mic className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Antislash Talk</h1>
          <p className="text-gray-400 text-lg">Join thousands of professionals who trust Antislash Talk for their meetings.</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-center mb-2">Create Account</h2>
          <p className="text-gray-500 text-sm text-center mb-8">Start your journey today</p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg flex items-start">
              <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
                placeholder="John Doe"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-10 border border-gray-200 rounded-lg text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
                  placeholder="--------"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-10 border border-gray-200 rounded-lg text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-colors"
                  placeholder="--------"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {password && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Password requirements:</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li className={password.length >= 6 ? 'text-green-600' : ''}>
                    {password.length >= 6 ? '✓' : '•'} At least 6 characters
                  </li>
                  <li className={password === confirmPassword && password ? 'text-green-600' : ''}>
                    {password === confirmPassword && password ? '✓' : '•'} Passwords match
                  </li>
                </ul>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6">
            <span className="text-sm text-gray-500">Already have an account? </span>
            <Link to="/auth/login" className="text-sm font-medium text-black hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant "Coming Soon" (mode SaaS)
function ComingSoonRegister() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 backdrop-blur-xl border-b border-gray-300/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-black p-2 rounded-xl shadow-lg shadow-black/10 group-hover:shadow-xl transition-shadow">
              <Mic size={24} className="text-white" />
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
              to="/auth/login"
              className="px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen pt-20">
        {/* Split Layout */}
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 items-center">

          {/* Left Side - Community & Benefits */}
          <div className="flex items-center justify-center min-h-screen text-center lg:text-left">
            <div className="w-full max-w-lg px-4 lg:px-8">
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-6">
                  <Star size={16} className="mr-2" />
                  Privacy-First AI Revolution
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black tracking-tight mb-4">
                  {t('auth.comingSoonTitle')}
                </h1>

                <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                  {t('auth.comingSoonSubtitle')}
                </p>
              </div>

              {/* Benefits Grid - Compact */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-xl p-4 text-center shadow-lg shadow-black/5">
                  <Code size={20} className="text-black mx-auto mb-2" />
                  <h3 className="font-semibold text-black text-sm mb-1">{t('auth.openSource')}</h3>
                </div>

                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-xl p-4 text-center shadow-lg shadow-black/5">
                  <Heart size={20} className="text-black mx-auto mb-2" />
                  <h3 className="font-semibold text-black text-sm mb-1">Free Forever</h3>
                </div>

                <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-xl p-4 text-center shadow-lg shadow-black/5">
                  <Users size={20} className="text-black mx-auto mb-2" />
                  <h3 className="font-semibold text-black text-sm mb-1">{t('auth.community')}</h3>
                </div>
              </div>

              {/* Platform Stats - Compact */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/20 backdrop-blur-sm border border-gray-300/30 rounded-xl p-3">
                  <div className="text-xl font-bold text-black">v2</div>
                  <div className="text-gray-500 text-xs">Upgrading</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm border border-gray-300/30 rounded-xl p-3">
                  <div className="text-xl font-bold text-black">Free</div>
                  <div className="text-gray-500 text-xs">Still Free</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm border border-gray-300/30 rounded-xl p-3">
                  <div className="text-xl font-bold text-black">Soon</div>
                  <div className="text-gray-500 text-xs">Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Coming Soon */}
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md mx-4 lg:mx-8 bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-2xl shadow-black/10 p-8">

              {/* Coming Soon Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Star size={32} className="text-black" />
                </div>
                <h2 className="text-2xl font-bold text-black mb-3">Coming Soon</h2>
                <p className="text-gray-500">{t('auth.comingSoonSubtitle')}</p>
              </div>

              {/* Status Information */}
              <div className="bg-white/40 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 mb-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-3 h-3 bg-gray-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-sm font-semibold text-black">Platform Enhancement</span>
                  </div>
                  <h3 className="font-semibold text-black mb-2">
                    {t('auth.platformUpgrade')}
                  </h3>
                </div>
              </div>

              {/* What's Coming */}
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold text-black text-center mb-4">
                  What's Coming Next
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center p-3 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl">
                    <div className="p-2 bg-gray-100 rounded-lg mr-3">
                      <CheckCircle size={16} className="text-black" />
                    </div>
                    <p className="text-sm font-medium text-black">Enhanced AI Models</p>
                  </div>

                  <div className="flex items-center p-3 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl">
                    <div className="p-2 bg-gray-100 rounded-lg mr-3">
                      <Users size={16} className="text-black" />
                    </div>
                    <p className="text-sm font-medium text-black">Team Collaboration</p>
                  </div>

                  <div className="flex items-center p-3 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl">
                    <div className="p-2 bg-gray-100 rounded-lg mr-3">
                      <Star size={16} className="text-black" />
                    </div>
                    <p className="text-sm font-medium text-black">Premium Features</p>
                  </div>
                </div>
              </div>

              {/* Notify Me Section */}
              <div className="bg-white/40 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 mb-6">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-black mb-3">
                    {t('auth.getNotified')}
                  </h4>
                  <a
                    href="mailto:hello@antislash.studio?subject=Antislash Talk - Notify Me&body=Hi! I'd like to be notified when new registrations are available for Antislash Talk."
                    className="inline-flex items-center px-6 py-3 bg-black text-white font-medium rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10"
                  >
                    <Mail size={16} className="mr-2" />
                    {t('auth.notifyMe')}
                  </a>
                </div>
              </div>

              {/* Alternative Actions */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-4">
                    {t('auth.alreadyHaveAccount')}
                  </p>
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-black font-medium rounded-xl hover:border-black hover:bg-white transition-all"
                  >
                    <ArrowRight size={16} className="mr-2" />
                    {t('auth.signInHere')}
                  </Link>
                </div>

                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Follow our progress on{' '}
                    <a
                      href="https://github.com/Lamouller/Antislash-Talk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black font-medium hover:underline"
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

  // Si marketing cache -> Formulaire fonctionnel
  // Si marketing visible -> Page "Coming Soon"
  return hideMarketingPages ? <FunctionalRegisterForm /> : <ComingSoonRegister />;
}
