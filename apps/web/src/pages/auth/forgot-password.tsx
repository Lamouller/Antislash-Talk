import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle, AlertCircle, ArrowLeft, Mic2 } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <div className="mb-6">
          <Link to="/auth/login" className="inline-flex items-center text-gray-500 hover:text-black transition-colors">
            <ArrowLeft size={18} className="mr-1.5" />
            <span className="text-sm font-medium">Back to login</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-2xl shadow-black/10 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/10">
              <Mic2 size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">Forgot Password</h2>
            <p className="text-sm text-gray-500">Enter your email to receive a password reset link.</p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center ${
              isSuccess
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              {isSuccess ? (
                <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-600 mr-2 flex-shrink-0" />
              )}
              <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
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
              <p className="mt-2 text-xs text-gray-500">
                We'll send you a secure link to reset your password.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Remembered your password?{' '}
              <Link
                to="/auth/login"
                className="text-black font-medium hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-white/40 backdrop-blur-sm border border-gray-200 rounded-xl">
            <div className="text-center">
              <h4 className="text-sm font-semibold text-black mb-1">
                Security Notice
              </h4>
              <p className="text-xs text-gray-500">
                For security, reset links expire in 1 hour. Check your spam folder if you don't see the email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
