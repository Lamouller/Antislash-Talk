import { Link } from 'react-router-dom';
import { Mic2, ArrowRight, UserPlus, LogIn, Shield, Github, Heart } from 'lucide-react';

export default function AuthIndex() {
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
              <Mic2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Antislash Talk</h1>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                Community Edition
              </div>
            </div>
          </Link>
          <a
            href="https://github.com/Lamouller/Antislash-Talk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-500 hover:text-black transition-colors"
          >
            <Github size={20} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4 lg:px-8 py-24">
        <div className="w-full text-center max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-8">
              <Shield size={16} className="mr-2" />
              Privacy-First AI Transcription
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-black tracking-tight mb-6">
              Welcome to Antislash Talk
            </h1>

            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-12">
              Start your journey with the most advanced privacy-first AI transcription platform.
              <strong className="text-black"> 100% local processing</strong> means your data never leaves your device.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full mb-20">
            {/* Sign In Card */}
            <Link
              to="/auth/login"
              className="group bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-8 shadow-lg shadow-black/5 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              <div className="p-3 bg-gray-100 rounded-xl w-fit mx-auto mb-6">
                <LogIn size={28} className="text-black" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-4">Welcome Back</h2>
              <p className="text-gray-500 mb-6">
                Sign in to access your transcription history, saved meetings, and continue your AI-powered journey.
              </p>
              <div className="inline-flex items-center text-black font-medium">
                Sign In
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Sign Up Card */}
            <Link
              to="/auth/register"
              className="group bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl p-8 shadow-lg shadow-black/5 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              <div className="p-3 bg-gray-100 rounded-xl w-fit mx-auto mb-6">
                <UserPlus size={28} className="text-black" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-4">Join the Community</h2>
              <p className="text-gray-500 mb-6">
                Create your free account and start transcribing meetings with privacy-first AI technology.
              </p>
              <div className="inline-flex items-center text-black font-medium">
                Create Free Account
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            <div className="text-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Shield size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">100% Local</h3>
              <p className="text-sm text-gray-500">Privacy-first AI processing</p>
            </div>

            <div className="text-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Github size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Open Source</h3>
              <p className="text-sm text-gray-500">MIT licensed, transparent</p>
            </div>

            <div className="text-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Heart size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">Free Forever</h3>
              <p className="text-sm text-gray-500">No hidden costs or limits</p>
            </div>

            <div className="text-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
                <Mic2 size={24} className="text-black" />
              </div>
              <h3 className="font-semibold text-black mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-500">Cutting-edge transcription</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="w-full px-6 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
            <span>2024 Antislash Studio</span>
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
