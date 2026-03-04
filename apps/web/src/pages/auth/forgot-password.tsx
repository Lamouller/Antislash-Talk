import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, AlertCircle, ArrowLeft, Mic } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Mic className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Antislash Talk</h1>
          <p className="text-gray-400 text-lg">Don't worry, we'll help you get back on track.</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Back link */}
          <div className="mb-6">
            <Link to="/auth/login" className="inline-flex items-center text-gray-500 hover:text-black transition-colors">
              <ArrowLeft size={18} className="mr-1.5" />
              <span className="text-sm font-medium">Back to login</span>
            </Link>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mic size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">Forgot Password</h2>
            <p className="text-sm text-gray-500">Enter your email to receive a password reset link.</p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-3xl font-bold text-black mb-2">Forgot Password</h2>
            <p className="text-gray-600">Enter your email to receive a password reset link.</p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center ${
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
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                required
                className="w-full h-11 px-4 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-black focus:ring-black focus:outline-none transition-all"
              />
              <p className="mt-2 text-xs text-gray-500">
                We'll send you a secure link to reset your password.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Sending reset link...
                </div>
              ) : (
                <div className="flex items-center">
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
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
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
