import { Link } from 'react-router-dom';
import { Mic, ArrowRight, Github, Shield, Globe, Users } from 'lucide-react';

export default function HomeScreen() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Mic className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Antislash Talk</h1>
          <p className="text-lg text-gray-400 mb-3">AI-Powered Meeting Transcription</p>
          <p className="text-gray-500 leading-relaxed mb-8">
            Transform your meetings into actionable insights with cutting-edge AI transcription, speaker identification, and multi-language support.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-gray-300">
              AI Transcription
            </span>
            <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-gray-300">
              Multi-Language
            </span>
            <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-gray-300">
              Secure
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile logo header */}
        <div className="lg:hidden flex items-center justify-center pt-12 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-black">Antislash Talk</span>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-lg">
            {/* Hero */}
            <h2 className="text-3xl sm:text-4xl font-bold text-black tracking-tight mb-4">
              Record, Transcribe,
              <br />
              Analyze
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-10">
              AI-powered meeting intelligence that helps you capture every word, identify speakers, and extract key insights automatically.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link
                to="/auth/register"
                className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors group"
              >
                Get Started
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://github.com/Lamouller/Antislash-Talk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-200 text-black rounded-lg font-medium hover:border-black transition-colors"
              >
                <Github size={18} className="mr-2" />
                View on GitHub
              </a>
            </div>

            {/* Feature Grid 2x2 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Mic size={18} className="text-black" />
                </div>
                <h3 className="font-semibold text-black text-sm mb-1">AI Transcription</h3>
                <p className="text-xs text-gray-500">High-accuracy speech-to-text across multiple languages.</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Users size={18} className="text-black" />
                </div>
                <h3 className="font-semibold text-black text-sm mb-1">Speaker ID</h3>
                <p className="text-xs text-gray-500">Automatically identify and label different speakers.</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Globe size={18} className="text-black" />
                </div>
                <h3 className="font-semibold text-black text-sm mb-1">Multi-Language</h3>
                <p className="text-xs text-gray-500">Support for multiple languages with translation.</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Shield size={18} className="text-black" />
                </div>
                <h3 className="font-semibold text-black text-sm mb-1">Secure Storage</h3>
                <p className="text-xs text-gray-500">Encrypted meeting data stored securely in the cloud.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 text-center">
          <div className="text-xs text-gray-400">
            <span>&copy; 2026 Antislash Talk</span>
            <span className="mx-2">&middot;</span>
            <span>Antislash Studio</span>
          </div>
        </div>
      </div>
    </div>
  );
}
