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
          text: 'Completed',
        };
      case 'processing':
        return {
          text: 'Processing',
        };
      case 'failed':
        return {
          text: 'Failed',
        };
      default:
        return {
          text: 'Unknown',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="group bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl hover:shadow-xl hover:shadow-black/10 transition-all duration-200 p-6 h-full cursor-pointer">
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex-1 mb-4">
          <h3 className="text-lg font-semibold text-black mb-3 line-clamp-2 group-hover:text-gray-700 transition-colors">
            {title || 'Untitled Meeting'}
          </h3>

          {/* Date and Duration */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <div className="flex items-center">
              <div className="p-1.5 bg-gray-100/80 rounded-lg mr-1.5">
                <Calendar className="w-4 h-4 text-gray-600" />
              </div>
              <span>
                {isValidDate ? formatDate(new Date(created_at), 'MMM d, yyyy') : 'Invalid Date'}
              </span>
            </div>

            <div className="flex items-center">
              <div className="p-1.5 bg-gray-100/80 rounded-lg mr-1.5">
                <Clock className="w-4 h-4 text-gray-600" />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-500 mr-2"></div>
              <span className="text-xs font-medium">
                {statusConfig.text}
              </span>
            </div>

            {/* Transcript Indicator */}
            {transcript && (
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                <FileText className="w-3 h-3 text-gray-600" />
              </div>
            )}

            {/* Participant Count */}
            {participantCount > 0 && (
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                <Mic className="w-3 h-3 text-gray-600 mr-1" />
                <span className="text-xs font-medium text-gray-700">
                  {participantCount}
                </span>
              </div>
            )}
          </div>

          {/* Arrow Indicator */}
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all duration-200" />
        </div>
      </div>
    </div>
  );
}
