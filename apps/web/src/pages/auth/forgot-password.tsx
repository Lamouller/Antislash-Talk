import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import AuthHeader from '../../components/auth/AuthHeader';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePasswordReset = async () => {
    setLoading(true);
    setMessage('');
    setIsSuccess(false);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/reset-password',
    });

    if (error) {
      setMessage(error.message);
      setIsSuccess(false);
    } else {
      setMessage('Password reset link sent! Please check your email.');
      setIsSuccess(true);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePasswordReset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <AuthHeader 
            title="Forgot Password"
            description="Enter your email to receive a password reset link."
          />
          
          {message && (
            <div className={`p-4 rounded-xl border ${
              isSuccess 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center">
                {isSuccess ? (
                  <CheckCircle size={20} className="text-green-500 mr-2" />
                ) : (
                  <AlertCircle size={20} className="text-red-500 mr-2" />
                )}
                <p className={`text-sm ${
                  isSuccess 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {message}
                </p>
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
                  className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white transition-all"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                We'll send you a secure link to reset your password.
              </p>
            </div>

            {/* Send Reset Button */}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending reset link...
                </div>
              ) : (
                <div className="flex items-center">
                  <Mail size={16} className="mr-2" />
                  Send Reset Link
                  <ArrowRight size={16} className="ml-2" />
                </div>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Remembered your password?{' '}
              <Link 
                to="/auth/login" 
                className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Help Notice */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-blue-100 dark:border-gray-600">
            <div className="text-center">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                🔐 Security Notice
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                For security, reset links expire in 1 hour. Check your spam folder if you don't see the email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}