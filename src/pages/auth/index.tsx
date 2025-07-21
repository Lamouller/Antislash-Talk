import { Link } from 'react-router-dom';
import { Mic2, ArrowRight, UserPlus, LogIn, Shield, Github, Heart, Star } from 'lucide-react';

export default function AuthIndex() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                Community Edition
              </div>
            </div>
          </Link>
          <a 
            href="https://github.com/Lamouller/Antislash-Talk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Github size={20} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full text-center">
          {/* Welcome Section */}
          <div className="mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium mb-8">
              <Star size={16} className="mr-2" />
              Join the Privacy-First AI Revolution
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-transparent bg-clip-text">
                Antislash Talk
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed mb-12">
              Start your journey with the most advanced privacy-first AI transcription platform. 
              <br className="hidden sm:block" />
              <strong>100% local processing</strong> means your data never leaves your device.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full mb-20">
            {/* Sign In Card */}
            <div className="flex justify-center">
              <Link 
                to="/auth/login"
                className="group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-full max-w-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <LogIn size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome Back</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Sign in to access your transcription history, saved meetings, and continue your AI-powered journey.
                  </p>
                  <div className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold">
                    Sign In
                    <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>

            {/* Sign Up Card */}
            <div className="flex justify-center">
              <Link 
                to="/auth/register"
                className="group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-full max-w-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <UserPlus size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Join the Community</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Create your free account and start transcribing meetings with privacy-first AI technology.
                  </p>
                  <div className="inline-flex items-center text-green-600 dark:text-green-400 font-semibold">
                    Create Free Account
                    <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">100% Local</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Privacy-first AI processing</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Github size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Open Source</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">MIT licensed, transparent</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Free Forever</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">No hidden costs or limits</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mic2 size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cutting-edge transcription</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6">
        <div className="w-full px-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 text-sm">
            <span>© 2024 Antislash Studio</span>
            <span>•</span>
            <div className="flex items-center">
              <span>Made with</span>
              <Heart size={14} className="mx-1 text-red-500" />
              <span>by the Community</span>
            </div>
            <span>•</span>
            <a href="https://github.com/Lamouller/Antislash-Talk" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}