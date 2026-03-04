import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic2 } from 'lucide-react';

export default function AuthHeader({ title, description }: { title: string, description: string }) {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      {/* Navigation */}
      <div className="flex justify-start mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      {/* Branding */}
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg shadow-black/10">
            <Mic2 size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-black mb-2">
          Antislash Talk
        </h1>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mb-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
          Community Edition
        </div>
      </div>

      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black mb-2">{title}</h2>
        <p className="text-gray-500">{description}</p>
      </div>

      {/* Features Banner */}
      <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-xl p-3 mb-6">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></div>
            <span>100% Local</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-1.5"></div>
            <span>Open Source</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-gray-600 rounded-full mr-1.5"></div>
            <span>Privacy First</span>
          </div>
        </div>
      </div>

      {/* Open Source Notice */}
      <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 mb-6">
        <span>Free & Open Source</span>
        <span>-</span>
        <span>MIT License</span>
      </div>
    </div>
  );
}
