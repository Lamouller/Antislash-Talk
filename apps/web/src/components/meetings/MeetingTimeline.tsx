import React, { useEffect, useState } from 'react';
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
        color: 'text-gray-400',
        bg: 'bg-gray-100 dark:bg-gray-800'
    },
    scheduled: {
        icon: Clock,
        label: 'Scheduled',
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    in_progress: {
        icon: Circle,
        label: 'In Progress',
        color: 'text-yellow-500',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    completed: {
        icon: CheckCircle,
        label: 'Completed',
        color: 'text-green-500',
        bg: 'bg-green-50 dark:bg-green-900/20'
    },
    cancelled: {
        icon: Circle,
        label: 'Cancelled',
        color: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20'
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
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (timeline.length <= 1) {
        // Only current meeting, no series
        return null;
    }

    return (
        <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t('meetingTimeline.title')}
                    </h3>
                    {seriesName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {seriesName}
                        </p>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500"></div>

                {/* Timeline items */}
                <div className="space-y-4">
                    {timeline.map((meeting, index) => {
                        const config = statusConfig[meeting.meeting_status];
                        const StatusIcon = config.icon;
                        const isLast = index === timeline.length - 1;

                        return (
                            <div key={meeting.id} className="relative">
                                {/* Connector dot */}
                                <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${meeting.is_current
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 ring-4 ring-indigo-100 dark:ring-indigo-900/50'
                                        : config.bg
                                    }`}>
                                    <StatusIcon className={`w-4 h-4 ${meeting.is_current ? 'text-white' : config.color}`} />
                                </div>

                                {/* Meeting card */}
                                <div className="ml-12">
                                    <Link
                                        to={`/tabs/meeting/${meeting.id}`}
                                        className={`block p-4 rounded-xl border transition-all group ${meeting.is_current
                                                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-300 dark:border-indigo-700 shadow-md'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                                                        {t(`meetingStatus.${meeting.meeting_status}`)}
                                                    </span>
                                                    {meeting.is_current && (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                                                            {t('meetingTimeline.current')}
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className={`font-semibold truncate ${meeting.is_current
                                                        ? 'text-indigo-900 dark:text-indigo-100'
                                                        : 'text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                                                    }`}>
                                                    {meeting.title}
                                                </h4>

                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-400 group-hover:translate-x-1 group-hover:text-indigo-600'
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
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                        {t('meetingTimeline.totalMeetings', { count: timeline.length })}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                        {t('meetingTimeline.position', { current: timeline.findIndex(m => m.is_current) + 1, total: timeline.length })}
                    </span>
                </div>
            </div>
        </div>
    );
}
