import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, CheckCircle, Circle, Clock, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TimelineMeeting {
    id: string;
    title: string;
    created_at: string;
    meeting_status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    is_current: boolean;
    position_in_series: number;
}

interface MeetingTimelineProps {
    currentMeetingId: string;
    className?: string;
}

const statusConfig = {
    draft: {
        icon: Circle,
        label: 'Draft',
        color: 'text-gray-500',
        bg: 'bg-gray-300'
    },
    scheduled: {
        icon: Clock,
        label: 'Scheduled',
        color: 'text-gray-700',
        bg: 'bg-gray-300'
    },
    in_progress: {
        icon: Circle,
        label: 'In Progress',
        color: 'text-white',
        bg: 'bg-gray-700'
    },
    completed: {
        icon: CheckCircle,
        label: 'Completed',
        color: 'text-white',
        bg: 'bg-black'
    },
    cancelled: {
        icon: Circle,
        label: 'Cancelled',
        color: 'text-gray-500',
        bg: 'bg-gray-100'
    }
};

export function MeetingTimeline({ currentMeetingId, className = '' }: MeetingTimelineProps) {
    const { t } = useTranslation();
    const [timeline, setTimeline] = useState<TimelineMeeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [seriesName, setSeriesName] = useState<string | null>(null);

    useEffect(() => {
        fetchTimeline();
    }, [currentMeetingId]);

    async function fetchTimeline() {
        try {
            setLoading(true);

            // Get current meeting to check series name
            const { data: currentMeeting } = await supabase
                .from('meetings')
                .select('series_name')
                .eq('id', currentMeetingId)
                .single();

            setSeriesName(currentMeeting?.series_name || null);

            // Call the timeline function
            const { data, error } = await supabase
                .rpc('get_meeting_timeline', { meeting_id_param: currentMeetingId });

            if (error) {
                console.error('Error fetching timeline:', error);
                return;
            }

            setTimeline(data || []);
        } catch (error) {
            console.error('Error in fetchTimeline:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className={`animate-pulse ${className}`}>
                <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (timeline.length <= 1) {
        // Only current meeting, no series
        return null;
    }

    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-black" />
                <div>
                    <h3 className="text-xl font-bold text-gray-900">
                        {t('meetingTimeline.title')}
                    </h3>
                    {seriesName && (
                        <p className="text-sm text-gray-600">
                            {seriesName}
                        </p>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-700 via-gray-500 to-gray-300"></div>

                {/* Timeline items */}
                <div className="space-y-4">
                    {timeline.map((meeting) => {
                        const config = statusConfig[meeting.meeting_status];
                        const StatusIcon = config.icon;


                        return (
                            <div key={meeting.id} className="relative">
                                {/* Connector dot */}
                                <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${meeting.is_current
                                    ? 'bg-black ring-4 ring-gray-300'
                                    : config.bg
                                    }`}>
                                    <StatusIcon className={`w-4 h-4 ${meeting.is_current ? 'text-white' : config.color}`} />
                                </div>

                                {/* Meeting card */}
                                <div className="ml-12">
                                    <Link
                                        to={`/tabs/meeting/${meeting.id}`}
                                        className={`block p-4 rounded-xl border transition-all group ${meeting.is_current
                                            ? 'bg-gray-100 border-gray-300 shadow-md'
                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                                                        {t(`meetingStatus.${meeting.meeting_status}`)}
                                                    </span>
                                                    {meeting.is_current && (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black text-white">
                                                            {t('meetingTimeline.current')}
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className={`font-semibold truncate ${meeting.is_current
                                                    ? 'text-gray-900'
                                                    : 'text-gray-900 group-hover:text-black'
                                                    }`}>
                                                    {meeting.title}
                                                </h4>

                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(meeting.created_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>

                                            <ChevronRight className={`w-5 h-5 transition-transform ${meeting.is_current
                                                ? 'text-black'
                                                : 'text-gray-400 group-hover:translate-x-1 group-hover:text-black'
                                                }`} />
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer stats */}
            <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                        {t('meetingTimeline.totalMeetings', { count: timeline.length })}
                    </span>
                    <span className="text-gray-600">
                        {t('meetingTimeline.position', { current: timeline.findIndex(m => m.is_current) + 1, total: timeline.length })}
                    </span>
                </div>
            </div>
        </div>
    );
}
