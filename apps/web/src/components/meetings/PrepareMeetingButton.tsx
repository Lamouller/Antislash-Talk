import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Calendar, Loader, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface PrepareMeetingButtonProps {
    meetingId: string;
    meetingTitle: string;
    seriesName?: string | null;
    onPrepared?: (newMeetingId: string) => void;
    variant?: 'primary' | 'secondary';
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

export function PrepareMeetingButton({
    meetingId,
    meetingTitle,
    seriesName,
    onPrepared,
    variant = 'primary',
    size = 'medium',
    className = ''
}: PrepareMeetingButtonProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    async function handlePrepare() {
        try {
            setLoading(true);
            toast.loading(t('prepareMeeting.generating'), { id: 'prepare-meeting' });

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Call edge function to prepare next meeting
            const { data, error } = await supabase.functions.invoke('prepare-next-meeting', {
                body: {
                    previous_meeting_id: meetingId,
                    series_name: seriesName || `Follow-up: ${meetingTitle}`
                }
            });

            if (error) {
                throw error;
            }

            if (!data || !data.new_meeting_id) {
                throw new Error('No meeting ID returned');
            }

            console.log('✅ Preparation created:', data);

            toast.success(t('prepareMeeting.success'), { id: 'prepare-meeting' });

            // Navigate to the new meeting or call callback
            if (onPrepared) {
                onPrepared(data.new_meeting_id);
            } else {
                navigate(`/tabs/meeting/${data.new_meeting_id}`);
            }

        } catch (error) {
            console.error('Error preparing meeting:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(
                t('prepareMeeting.error', {
                    error: errorMessage
                }),
                { id: 'prepare-meeting' }
            );
        } finally {
            setLoading(false);
        }
    }

    if (variant === 'secondary') {
        return (
            <Button
                variant="outline"
                size={size}
                onClick={handlePrepare}
                disabled={loading}
                className={className}
            >
                {loading ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                    <Plus className="w-4 h-4 mr-2" />
                )}
                {t('prepareMeeting.button')}
            </Button>
        );
    }

    return (
        <Button
            variant="primary"
            size={size}
            onClick={handlePrepare}
            disabled={loading}
            className={`bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 ${className}`}
        >
            {loading ? (
                <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    {t('prepareMeeting.generating')}
                </>
            ) : (
                <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    <Calendar className="w-5 h-5 mr-2" />
                    {t('prepareMeeting.button')}
                </>
            )}
        </Button>
    );
}
