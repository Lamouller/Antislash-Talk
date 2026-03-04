import { Link } from 'react-router-dom';
import { Mic2, ArrowRight, Github, Star, Zap, Shield, Globe, Users } from 'lucide-react';

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
              <Mic2 size={24} className="text-white" />
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
              Free & Open Source -- MIT License -- 100% Privacy
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black tracking-tight mb-6">
              AI-Powered
              <br />
              Meeting Transcription
            </h1>

            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-12">
              Transform your meetings with <strong className="text-black">100% local AI processing</strong>. No cloud, no privacy concerns.
              <br className="hidden sm:block" />
              Open source, free forever, and blazingly fast.
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
                <Shield size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">100% Local</h3>
              <p className="text-sm text-gray-500">Your conversations never leave your device. Complete privacy guaranteed.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Globe size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Open Source</h3>
              <p className="text-sm text-gray-500">MIT licensed, transparent, and built by the community for everyone.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Users size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Community Driven</h3>
              <p className="text-sm text-gray-500">Join thousands of developers building the future of AI transcription.</p>
            </div>

            <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-6 shadow-lg shadow-black/5">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Zap size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Lightning Fast</h3>
              <p className="text-sm text-gray-500">WebGPU acceleration delivers real-time transcription performance.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
            <span>2026 Antislash Studio</span>
            <span>-</span>
            <span>Made by the Community</span>
            <span>-</span>
            <a href="https://github.com/Lamouller/Antislash-Talk" className="hover:text-black transition-colors">
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
