import { Link } from 'react-router-dom';
import { Mic, ArrowRight, Github, Star, Shield, Globe, Users } from 'lucide-react';

export default function HomeScreen() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav
        className="fixed left-0 right-0 z-50 px-4 lg:px-8 py-4 bg-white/20 backdrop-blur-xl border-b border-gray-300/20"
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-black p-2 rounded-xl shadow-lg shadow-black/10">
              <Mic size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                Community Edition
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/Lamouller/Antislash-Talk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-500 hover:text-black transition-colors"
            >
              <Github size={20} />
              <span className="hidden sm:inline">Star on GitHub</span>
            </a>
            <Link
              to="/auth"
              className="px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-24">
        <div className="w-full text-center max-w-5xl mx-auto">
          {/* Hero Content */}
          <div className="mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-8">
              <Star size={16} className="mr-2" />
              AI-Powered Meeting Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black tracking-tight mb-6">
              AI-Powered
              <br />
              Meeting Transcription
            </h1>

            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-12">
              Record, transcribe, and analyze your meetings with AI-powered insights.
              <br className="hidden sm:block" />
              Multi-language support, speaker identification, and secure cloud storage.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-16">
              <Link
                to="/auth/register"
                className="px-8 py-4 bg-black text-white rounded-2xl text-lg font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 group"
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
                className="px-8 py-4 border-2 border-gray-300 hover:border-black text-black rounded-2xl font-medium text-lg transition-all flex items-center"
              >
                <Github size={20} className="mr-2" />
                View on GitHub
              </a>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Mic size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">AI Transcription</h3>
              <p className="text-sm text-gray-500">Automatic speech-to-text with high accuracy across multiple languages.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Users size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Speaker Identification</h3>
              <p className="text-sm text-gray-500">Automatically identify and label different speakers in your meetings.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Globe size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Multi-Language</h3>
              <p className="text-sm text-gray-500">Support for multiple languages with real-time translation capabilities.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Shield size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Secure Storage</h3>
              <p className="text-sm text-gray-500">Your meeting data is encrypted and securely stored in the cloud.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
            <span>© 2026 Antislash Talk</span>
            <span>·</span>
            <span>Antislash Studio</span>
            <span>·</span>
            <a href="https://github.com/Lamouller/Antislash-Talk" className="hover:text-black transition-colors">
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
