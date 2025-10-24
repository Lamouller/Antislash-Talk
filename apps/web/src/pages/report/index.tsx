import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

type Report = {
  id: string;
  title: string;
  created_at: string;
  format: string;
};

export default function ReportIndexScreen() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    // Mock data for reports
    const mockReports: Report[] = [
      { id: '1', title: 'Q1 Sales Strategy', created_at: '2023-03-15T10:00:00Z', format: 'Summary' },
      { id: '2', title: 'Project Phoenix Kick-off', created_at: '2023-03-14T14:30:00Z', format: 'Minutes' },
      { id: '3', title: 'Marketing Campaign Review', created_at: '2023-03-12T09:00:00Z', format: 'Detailed' },
    ];
    setReports(mockReports);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="mb-6">
            <h1 className="text-3xl font-bold">Meeting Reports</h1>
        </header>

        {reports.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <FileText size={48} className="mx-auto text-indigo-400" />
            <h3 className="mt-4 text-xl font-semibold">No Reports Yet</h3>
            <p className="mt-1 text-sm text-gray-500">Your generated meeting reports will appear here.</p>
            <Button onClick={() => navigate('/meetings')} className="mt-6">
                Go to Meetings
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Link key={report.id} to={`/report/view?id=${report.id}`} className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText size={24} className="text-indigo-500" />
                    <div className="ml-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{report.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(report.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                     <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{report.format}</span>
                     <ChevronRight size={20} className="ml-4 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}