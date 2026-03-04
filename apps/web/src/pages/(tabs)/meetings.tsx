
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MeetingCard } from '../../components/meetings/MeetingCard';
import { Link } from 'react-router-dom';
import { Meeting } from '../../lib/schemas';
import { ListMusic, Search, Filter, Clock, Mic, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const { t } = useTranslation();

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
          if (payload.eventType === 'DELETE') {
            const deletedMeeting = payload.old;
            setMeetings(currentMeetings =>
              currentMeetings.filter(m => m.id !== deletedMeeting.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.transcript?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || meeting.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (error) {
    return (
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex items-center justify-center min-h-[60vh]"
      >
        <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="p-2.5 bg-gray-100/80 rounded-xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <ListMusic className="w-8 h-8 text-gray-700" />
            </div>
            <h2 className="text-xl font-semibold text-black mb-2">
              {t('meetings.errorLoading')}
            </h2>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 pt-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {t('meetings.title')}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('meetings.subtitle')}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t('meetings.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 transition-all outline-none"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="h-12 pl-3 pr-10 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl text-gray-900 focus:border-black focus:bg-white focus:shadow-lg focus:shadow-black/5 transition-all outline-none"
              >
                <option value="all">{t('meetings.allStatus')}</option>
                <option value="completed">{t('meetings.completed')}</option>
                <option value="pending">{t('meetings.pending')}</option>
              </select>
            </div>

            {/* New Meeting Button */}
            <Link to="/tabs/record">
              <Button className="bg-black text-white px-6 py-3 rounded-xl shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] transition-all duration-200">
                <Mic className="w-5 h-5 mr-2" />
                {t('meetings.newMeeting')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/40 rounded-xl p-4 border border-gray-200/50">
            <div className="flex items-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl mr-3">
                <ListMusic className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('dashboard.totalMeetings')}</p>
                <p className="text-2xl font-bold text-black">{meetings.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/40 rounded-xl p-4 border border-gray-200/50">
            <div className="flex items-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl mr-3">
                <Clock className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('meetings.completed')}</p>
                <p className="text-2xl font-bold text-black">
                  {meetings.filter(m => m.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/40 rounded-xl p-4 border border-gray-200/50">
            <div className="flex items-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl mr-3">
                <Sparkles className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('meetings.thisMonth')}</p>
                <p className="text-2xl font-bold text-black">
                  {meetings.filter(m => new Date(m.created_at).getMonth() === new Date().getMonth()).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meetings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-12 max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <ListMusic className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">
              {searchTerm || filterStatus !== 'all' ? t('meetings.noMeetingsFound') : t('meetings.noMeetingsYet')}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || filterStatus !== 'all'
                ? t('meetings.adjustCriteria')
                : t('meetings.startRecordingFirst')
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <Link to="/tabs/record">
                <Button className="bg-black text-white px-6 py-3 rounded-xl shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] transition-all duration-200">
                  <Mic className="w-5 h-5 mr-2" />
                  {t('meetings.recordFirstMeeting')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings.map((meeting) => (
            <Link key={meeting.id} to={`/tabs/meeting/${meeting.id}`} className="block">
              <MeetingCard
                id={meeting.id}
                title={meeting.title}
                created_at={meeting.created_at}
                duration={meeting.duration}
                status={meeting.status}
                transcript={meeting.transcript}
                participantCount={0}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
