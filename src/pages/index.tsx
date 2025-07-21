import { Link } from 'react-router-dom';
import { Mic2, ArrowRight, Github, Star, Zap, Shield, Globe, Users } from 'lucide-react';

export default function HomeScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg">
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">🎙️ Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                Community Edition
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="https://github.com/Lamouller/Antislash-Talk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Github size={20} />
              <span className="hidden sm:inline">Star on GitHub</span>
            </a>
            <Link 
              to="/auth" 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-20">
        <div className="w-full text-center">
          {/* Hero Content */}
          <div className="mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium mb-8">
              <Star size={16} className="mr-2" />
              Free & Open Source • MIT License • 100% Privacy
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-transparent bg-clip-text">
                AI-Powered
              </span>
              <br />
              Meeting Transcription
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed mb-12">
              Transform your meetings with <strong>100% local AI processing</strong>. No cloud, no privacy concerns.
              <br className="hidden sm:block" />
              Open source, free forever, and blazingly fast.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-16">
              <Link 
                to="/auth/register" 
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
              >
                <span className="flex items-center">
                  Start Free
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <a 
                href="https://github.com/Lamouller/Antislash-Talk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-4 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center"
              >
                <Github size={20} className="mr-2" />
                View on GitHub
              </a>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Shield size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">100% Local</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Your conversations never leave your device. Complete privacy guaranteed.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Globe size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Open Source</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">MIT licensed, transparent, and built by the community for everyone.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-4">
                <Users size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Community Driven</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Join thousands of developers building the future of AI transcription.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center mb-4">
                <Zap size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Lightning Fast</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">WebGPU acceleration delivers real-time transcription performance.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 text-sm">
            <span>© 2024 Antislash Studio</span>
            <span>•</span>
            <span>Made with ❤️ by the Community</span>
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