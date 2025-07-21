import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AuthHeader({ title, description }: { title: string, description: string }) {
  const navigate = useNavigate();

  return (
    <div className="mb-8">
      <button onClick={() => navigate(-1)} className="mb-4 text-gray-600 dark:text-gray-400">
        <ArrowLeft size={24} />
      </button>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}