import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';

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
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-black">Meeting Reports</h1>
        </header>

        {reports.length === 0 ? (
          <div className="text-center py-16 bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-lg shadow-black/5">
            <div className="p-3 bg-gray-100/80 rounded-xl w-fit mx-auto mb-4">
              <FileText size={32} className="text-gray-400" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-black">No Reports Yet</h3>
            <p className="mt-2 text-sm text-gray-500">Your generated meeting reports will appear here.</p>
            <button
              onClick={() => navigate('/meetings')}
              className="mt-6 px-6 h-12 bg-black text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10"
            >
              Go to Meetings
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                to={`/report/view?id=${report.id}`}
                className="block p-4 bg-white/20 backdrop-blur-xl border border-gray-300/30 rounded-2xl shadow-lg shadow-black/5 hover:shadow-xl hover:scale-[1.01] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-100/80 rounded-xl mr-4">
                      <FileText size={20} className="text-black" />
                    </div>
                    <div>
                      <p className="font-semibold text-black">{report.title}</p>
                      <p className="text-sm text-gray-500">{new Date(report.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{report.format}</span>
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
