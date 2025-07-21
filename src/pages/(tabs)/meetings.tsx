import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MeetingCard } from '../../components/meetings/MeetingCard';
import { Link } from 'react-router-dom';
import { Meeting } from '../../lib/schemas';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setMeetings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
    
    // Set up real-time subscription
    const channel = supabase.channel('meetings')
      .on<Meeting>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          console.log('Change received!', payload);
          if (payload.eventType === 'INSERT') {
            const newMeeting = payload.new;
            setMeetings(currentMeetings => [newMeeting, ...currentMeetings]);
          }
          if (payload.eventType === 'UPDATE') {
            const updatedMeeting = payload.new;
            setMeetings(currentMeetings => 
              currentMeetings.map(m => m.id === updatedMeeting.id ? updatedMeeting : m)
            );
          }
        }
      )
      .subscribe();

    // Clean up subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };

  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Your Meetings</h1>
      {meetings.length === 0 ? (
        <div className="text-center py-10 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">You have no meetings yet.</p>
          <Link to="/tabs/record" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Start a new recording
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {meetings.map((meeting) => (
            <Link to={`/tabs/meeting/${meeting.id}`} key={meeting.id} className="block hover:scale-105 transition-transform">
              <MeetingCard 
                {...meeting}
                participantCount={0}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}