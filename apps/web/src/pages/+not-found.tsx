import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-gray-200 mb-6">404</p>
        <h1 className="text-xl font-semibold text-black mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8">The page you are looking for does not exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
