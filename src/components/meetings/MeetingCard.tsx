import { Calendar, Clock, ChevronRight, Mic, FileText } from 'lucide-react';
import { Card } from '../ui/Card';
import { format as formatDate } from 'date-fns';
import { Meeting } from '../../lib/schemas';

type MeetingCardProps = Pick<Meeting, 'id' | 'title' | 'created_at' | 'duration' | 'status' | 'transcript'> & {
  participantCount: number;
};

export function MeetingCard({
  title,
  created_at,
  duration,
  status,
  transcript,
  participantCount
}: MeetingCardProps) {
  
  const isValidDate = created_at && !isNaN(new Date(created_at).getTime());

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const statusClasses = {
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    processing: 'bg-yellow-500',
    pending: 'bg-gray-400',
    uploading: 'bg-blue-500',
  };

  return (
    <Card className="w-full text-left p-4 h-full">
      <div className="flex justify-between items-start h-full flex-col">
        <div className="w-full">
          <p className="text-base font-semibold text-gray-900 dark:text-white truncate mb-2">
            {title}
          </p>
          
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center mr-4">
              <Calendar size={14} className="text-indigo-500 mr-1.5" />
              <span>
                {isValidDate ? formatDate(new Date(created_at), 'MMM d, yyyy') : 'Invalid Date'}
              </span>
            </div>
            
            <div className="flex items-center">
              <Clock size={14} className="text-indigo-500 mr-1.5" />
              <span>
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-3 w-full justify-between">
            <div className="flex items-center">
                <div className={`px-2 py-0.5 rounded-full text-white text-xs font-medium ${statusClasses[status]}`}>
                  {status}
                </div>
                
                {!!transcript && (
                  <div className="ml-2 bg-indigo-100 dark:bg-indigo-900 p-1 rounded-full">
                    <FileText size={12} className="text-indigo-500" />
                  </div>
                )}
                
                {participantCount > 0 && (
                  <div className="ml-2 flex items-center bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded-full">
                    <Mic size={12} className="text-indigo-500 mr-1" />
                    <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{participantCount}</span>
                  </div>
                )}
            </div>
          
            <ChevronRight size={20} className="text-gray-400" />
        </div>
      </div>
    </Card>
  );
}