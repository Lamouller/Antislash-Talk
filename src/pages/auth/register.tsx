
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle, Mic2, Users, Code, Heart, Github, Star } from 'lucide-react';

export default function RegisterScreen() {

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
                  Privacy-First AI Revolution
                </div>
                
                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Amazing Things{' '}
                  <span className="text-emerald-200">
                    Coming
                  </span>
                  <br />
                  Soon
                </h1>
                
                <p className="text-lg text-emerald-100 mb-8 leading-relaxed">
                  We're upgrading the platform to bring you an even better experience. <strong>New registrations</strong> will be available very soon with exciting features.
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

              {/* Platform Stats - Compact */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">🚀</div>
                  <div className="text-emerald-100 text-xs">Upgrading</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">∞</div>
                  <div className="text-emerald-100 text-xs">Still Free</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="text-xl font-bold text-white">Soon</div>
                  <div className="text-emerald-100 text-xs">Available</div>
                </div>
              </div>
              </div>
            </div>

            {/* Right Side - Coming Soon */}
            <div className="flex items-center justify-center min-h-screen">
              <div className="w-full max-w-md mx-4 lg:mx-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                
                {/* Coming Soon Header */}
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <span className="text-3xl">🚀</span>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Coming Soon</h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400">New registrations are temporarily paused</p>
                </div>

                {/* Status Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-6 border border-blue-200/50 dark:border-blue-700/50">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Platform Enhancement</span>
                    </div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      🛠️ Upgrading Our Infrastructure
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                      We're working hard to improve your experience with better performance, 
                      enhanced security, and exciting new features.
                    </p>
                  </div>
                </div>

                {/* What's Coming */}
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-4">
                    What's Coming Next
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">Enhanced AI Models</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Better transcription accuracy</p>
                      </div>
                    </div>

                    <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                        <Users size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Team Collaboration</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Share and collaborate on meetings</p>
                      </div>
                    </div>

                    <div className="flex items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                      <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                        <Star size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Premium Features</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Advanced export & integrations</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notify Me Section */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700 rounded-2xl p-6 mb-6">
                  <div className="text-center">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      📧 Get Notified
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Want to be the first to know when registrations reopen?
                    </p>
                    <a 
                      href="mailto:hello@antislash.studio?subject=Antislash Talk - Notify Me&body=Hi! I'd like to be notified when new registrations are available for Antislash Talk."
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Mail size={16} className="mr-2" />
                      Notify Me by Email
                    </a>
                  </div>
                </div>

                {/* Alternative Actions */}
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Already have an account?
                    </p>
                    <Link 
                      to="/auth/login" 
                      className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-700 border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 text-green-700 dark:text-green-300 font-semibold rounded-xl transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <ArrowRight size={16} className="mr-2" />
                      Sign In Here
                    </Link>
                  </div>

                  <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Follow our progress on{' '}
                      <a 
                        href="https://github.com/Lamouller/Antislash-Talk" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 font-medium"
                      >
                        GitHub
                      </a>
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