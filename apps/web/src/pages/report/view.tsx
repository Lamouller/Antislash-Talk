import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface Report {
    id: number;
    created_at: string;
    meeting_id: string;
    content: string;
    format: string;
    title: string;
}

export default function ReportViewScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get('id');
  const meetingId = searchParams.get('meetingId');

  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) {
        navigate('/meetings');
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('reports').select('*').eq('id', reportId).single();
        if (error) throw error;
        setReport(data);
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [reportId, navigate]);

  const handleBack = () => {
      if (meetingId) {
          navigate(`/meeting/${meetingId}?tab=reports`);
      } else {
          navigate(-1);
      }
  }

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!report) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">Report not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 h-10 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
        >
          Go back
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <h1 className="flex-1 mx-4 text-xl font-bold text-black truncate">{report.title}</h1>
        </header>

        <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-lg shadow-black/5 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm text-gray-500">
                {format(new Date(report.created_at), 'MMMM d, yyyy')}
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mt-2">
                <FileText size={14} className="mr-1.5" />
                {report.format}
              </span>
            </div>
          </div>

          <div className="prose max-w-none text-gray-900">
            {report.content}
          </div>
        </div>
      </div>
    </div>
  );
}
