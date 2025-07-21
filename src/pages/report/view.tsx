import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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
  
  if (isLoading) return <div className="p-6">Loading report...</div>;
  if (!report) return <div className="p-6">Report not found.</div>;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="flex items-center mb-6">
            <Button variant="outline" size="small" onClick={handleBack}><ArrowLeft size={16}/></Button>
            <h1 className="flex-1 mx-4 text-xl font-bold truncate">{report.title}</h1>
        </header>

        <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(report.created_at), 'MMMM d, yyyy')}
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 mt-2">
                        <FileText size={14} className="mr-1.5" />
                        {report.format}
                    </span>
                </div>
            </div>

            <div className="prose dark:prose-invert max-w-none">
                {report.content}
            </div>
        </Card>
      </div>
    </div>
  );
}