import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic2, Github, Heart } from 'lucide-react';

export default function AuthHeader({ title, description }: { title: string, description: string }) {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      {/* Navigation */}
      <div className="flex justify-start mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* Community Edition Branding */}
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
            <Mic2 size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          🎙️ Antislash Talk
        </h1>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-4">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Community Edition
        </div>
      </div>

      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>

      {/* Community Features Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-3 mb-6 border border-blue-100 dark:border-gray-600">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-700 dark:text-gray-300">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
            <span>100% Local</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></div>
            <span>Open Source</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5"></div>
            <span>Privacy First</span>
          </div>
        </div>
      </div>

      {/* Open Source Notice */}
      <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
        <Github size={14} />
        <span>Free & Open Source</span>
        <span>•</span>
        <span>MIT License</span>
        <span>•</span>
        <div className="flex items-center">
          <span>Made with</span>
          <Heart size={12} className="mx-1 text-red-500" />
          <span>by Community</span>
        </div>
      </div>
    </div>
  );
}