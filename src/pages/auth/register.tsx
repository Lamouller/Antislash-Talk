
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, CheckCircle, User, Mic2, Users, Code, Heart, Github, Star } from 'lucide-react';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (pass: string) => {
    return pass.length >= 8;
  };

  const handleRegister = async () => {
    setError('');
    
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRegister();
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to Antislash Talk!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your account has been created successfully.
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                📧 Check Your Email
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We've sent a confirmation email to <strong>{email}</strong>. 
                Please click the link in the email to activate your account.
              </p>
            </div>

            <Link
              to="/auth/login"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200"
            >
              Continue to Sign In
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></span>
                Community Edition
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
              Sign In
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
                  Join the Privacy-First AI Revolution
                </div>
                
                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Join Our{' '}
                  <span className="text-emerald-200">
                    Community
                  </span>
                  <br />
                  Today
                </h1>
                
                <p className="text-lg text-emerald-100 mb-8 leading-relaxed">
                  Be part of the privacy-first AI revolution. Create your <strong>free account</strong> and start transcribing with 100% local processing.
                </p>
              </div>

              {/* Benefits Grid - Compact */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Code size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">Open Source</h3>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Heart size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">Free Forever</h3>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Users size={20} className="text-white mx-auto mb-2" />
                  <h3 className="font-semibold text-white text-sm mb-1">Community</h3>
                </div>
              </div>

              {/* Community Stats - Compact */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">1K+</div>
                  <div className="text-emerald-100 text-xs">Members</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">∞</div>
                  <div className="text-emerald-100 text-xs">Free</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">24/7</div>
                  <div className="text-emerald-100 text-xs">Available</div>
                </div>
              </div>
              </div>
            </div>

            {/* Right Side - Registration Form */}
            <div className="flex items-center justify-center min-h-screen">
              <div className="w-full max-w-md mx-4 lg:mx-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                {/* Form Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <User size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Your Account</h2>
                  <p className="text-gray-600 dark:text-gray-400">Join the community and start transcribing with privacy-first AI</p>
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
            Email Address
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
                        className="block w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 dark:text-white transition-all"
          />
        </div>
                  </div>

                  {/* Password Field */}
        <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Password
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
                        placeholder="At least 8 characters"
                        required
                        className="block w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 dark:text-white transition-all"
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
                    {password && (
                      <div className="mt-2">
                        <div className={`text-xs ${validatePassword(password) ? 'text-green-600' : 'text-red-600'}`}>
                          {validatePassword(password) ? '✓ Password strength: Good' : '⚠ Password too short (minimum 8 characters)'}
                        </div>
                      </div>
                    )}
        </div>

                  {/* Confirm Password Field */}
        <div>
                    <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Confirm Password
          </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={20} className="text-gray-400" />
                      </div>
          <input
            id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your password"
                        required
                        className="block w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 dark:text-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} className="text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye size={20} className="text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                    {confirmPassword && (
                      <div className="mt-2">
                        <div className={`text-xs ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                          {password === confirmPassword ? '✓ Passwords match' : '⚠ Passwords do not match'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terms Notice */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    By creating an account, you agree to our{' '}
                    <Link to="/terms" className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 font-medium">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 font-medium">
                      Privacy Policy
                    </Link>
                    .
        </div>

                  {/* Create Account Button */}
        <button
                    type="submit"
                    disabled={loading || !email || !password || !confirmPassword || password !== confirmPassword}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating your account...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <User size={16} className="mr-2" />
                        Create Free Account
                        <ArrowRight size={16} className="ml-2" />
                      </div>
                    )}
        </button>
                </form>

                {/* Sign In Link */}
                <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                    <Link 
                      to="/auth/login" 
                      className="font-semibold text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                    >
                      Sign in here
                </Link>
            </p>
        </div>

                {/* Privacy Notice */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-green-200 dark:border-gray-600">
                  <div className="text-center">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                      🔒 Privacy First
                    </h4>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Your transcriptions are processed locally. We only store account info and optional meeting metadata.
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