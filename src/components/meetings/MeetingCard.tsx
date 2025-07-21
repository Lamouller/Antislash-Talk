import { Calendar, Clock, ChevronRight, Mic, FileText } from 'lucide-react';
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
  
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          color: 'bg-green-500',
          text: 'Completed',
          textColor: 'text-green-700 dark:text-green-300',
          bgColor: 'bg-green-50 dark:bg-green-900/20'
        };
             case 'processing':
         return {
           color: 'bg-blue-500',
           text: 'Processing',
           textColor: 'text-blue-700 dark:text-blue-300',
           bgColor: 'bg-blue-50 dark:bg-blue-900/20'
         };
      case 'failed':
        return {
          color: 'bg-red-500',
          text: 'Failed',
          textColor: 'text-red-700 dark:text-red-300',
          bgColor: 'bg-red-50 dark:bg-red-900/20'
        };
      default:
        return {
          color: 'bg-gray-500',
          text: 'Unknown',
          textColor: 'text-gray-700 dark:text-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 h-full cursor-pointer">
      <div className="flex flex-col h-full">
        
        {/* Header */}
        <div className="flex-1 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {title || 'Untitled Meeting'}
          </h3>
          
          {/* Date and Duration */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1.5 text-blue-500" />
              <span>
                {isValidDate ? formatDate(new Date(created_at), 'MMM d, yyyy') : 'Invalid Date'}
              </span>
            </div>
            
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-green-500" />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full ${statusConfig.bgColor} border border-gray-200/50 dark:border-gray-700/50`}>
              <div className={`w-2 h-2 rounded-full ${statusConfig.color} mr-2`}></div>
              <span className={`text-xs font-medium ${statusConfig.textColor}`}>
                {statusConfig.text}
              </span>
            </div>
            
            {/* Transcript Indicator */}
            {transcript && (
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/50">
                <FileText className="w-3 h-3 text-purple-500" />
              </div>
            )}
            
            {/* Participant Count */}
            {participantCount > 0 && (
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/50 dark:border-indigo-700/50">
                <Mic className="w-3 h-3 text-indigo-500 mr-1" />
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  {participantCount}
                </span>
              </div>
            )}
          </div>
          
          {/* Arrow Indicator */}
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </div>
    </div>
  );
}