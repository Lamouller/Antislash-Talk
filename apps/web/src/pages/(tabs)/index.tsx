import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { FilePlus, ListMusic, Clock, Users, Mic, BarChart3, Upload } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

const formatDuration = (totalSeconds: number) => {
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
};

interface WeeklyActivity {
  day_name: string;
  meetings_count: number;
  duration_minutes: number;
}

export default function TabsIndex() {
  const { t } = useTranslation();

  const initialStats = [
    { title: t('dashboard.totalMeetings'), value: '0', icon: ListMusic },
    { title: t('dashboard.recordings'), value: '0', icon: FilePlus },
    { title: t('dashboard.timeRecorded'), value: '0s', icon: Clock },
    { title: t('dashboard.avgParticipants'), value: '0.0', icon: Users },
  ];

  const [summaryStats, setSummaryStats] = useState<any[]>(initialStats);
  const [chartData, setChartData] = useState<WeeklyActivity[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Update stats when language changes (if loading is false, to refresh titles)
  useEffect(() => {
    setSummaryStats(prevStats => prevStats.map((stat, index) => ({
      ...stat,
      title: initialStats[index].title
    })));
  }, [t]);

  const fetchDashboardData = useDebouncedCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [statsRes, activityRes, recentRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats', { p_user_id: user.id }),
        supabase.rpc('get_weekly_activity', { p_user_id: user.id }),
        supabase
          .from('meetings')
          .select(`
            id,
            title,
            created_at,
            duration,
            status,
            participant_count
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (statsRes.data && statsRes.data.length > 0) {
        const stats = statsRes.data[0];
        setSummaryStats([
          {
            title: t('dashboard.totalMeetings'),
            value: stats.total_meetings?.toString() || '0',
            icon: ListMusic,
          },
          {
            title: t('dashboard.recordings'),
            value: stats.total_recordings?.toString() || '0',
            icon: FilePlus,
          },
          {
            title: t('dashboard.timeRecorded'),
            value: formatDuration(stats.total_duration_seconds || 0),
            icon: Clock,
          },
          {
            title: t('dashboard.avgParticipants'),
            value: stats.avg_participants?.toFixed(1) || '0.0',
            icon: Users,
          },
        ]);
      }

      if (activityRes.data) {
        setChartData(activityRes.data);
      }

      if (recentRes.data) {
        setRecentMeetings(recentRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, 300);

  useEffect(() => {
    fetchDashboardData();
  }, [location, fetchDashboardData, t]); // Add t dependency to refetch/update on language change

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 pt-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {t('dashboard.welcomeBack')}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('dashboard.welcomeSubtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-6 hover:shadow-xl hover:shadow-black/10 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-gray-100/80 rounded-xl">
                  <IconComponent className="w-5 h-5 text-gray-700" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-black">
                    {loading ? (
                      <div className="w-12 h-8 bg-gray-200 rounded animate-pulse"></div>
                    ) : (
                      stat.value
                    )}
                  </div>
                </div>
              </div>
              <h3 className="text-sm text-gray-500">
                {stat.title}
              </h3>
            </div>
          );
        })}
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Activity Chart */}
        <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-6">
          <div className="flex items-center mb-6">
            <div className="p-2.5 bg-gray-100/80 rounded-xl mr-3">
              <BarChart3 className="w-5 h-5 text-gray-700" />
            </div>
            <h2 className="text-xl font-semibold text-black">{t('dashboard.weeklyActivity')}</h2>
          </div>

          {loading ? (
            <div className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day_name"
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="meetings_count"
                  name={t('dashboard.chartMeetings')}
                  fill="#171717"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('dashboard.noActivity')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Meetings */}
        <div className="bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2.5 bg-gray-100/80 rounded-xl mr-3">
                <Mic className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-xl font-semibold text-black">{t('dashboard.recentMeetings')}</h2>
            </div>
            <Link to="/tabs/meetings">
              <Button variant="outline" size="small" className="text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-black rounded-xl">
                {t('dashboard.viewAll')}
              </Button>
            </Link>
          </div>

          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 bg-gray-100 rounded-xl animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="w-24 h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))
            ) : recentMeetings.length > 0 ? (
              recentMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/tabs/meeting/${meeting.id}`}
                  className="block group"
                >
                  <div className="flex items-center space-x-4 p-4 rounded-xl bg-white/40 border border-gray-200/50 hover:bg-white/70 hover:shadow-md transition-all duration-200">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black truncate group-hover:text-gray-700 transition-colors">
                        {meeting.title || t('dashboard.untitledMeeting')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(meeting.created_at).toLocaleDateString()} • {formatDuration(meeting.duration || 0)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs px-2.5 py-1">
                        {meeting.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('dashboard.noMeetings')}</p>
                <Link to="/tabs/record">
                  <Button className="mt-4 bg-black text-white rounded-xl hover:bg-gray-800 active:scale-[0.98] shadow-lg shadow-black/10">
                    {t('common.startRecording')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="text-center">
        <div className="inline-flex items-center flex-wrap justify-center gap-4 p-2 bg-white/20 backdrop-blur-xl rounded-2xl border border-gray-300/30 shadow-lg shadow-black/5">
          <Link to="/tabs/record">
            <Button className="bg-black text-white px-6 py-3 rounded-xl shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] transition-all duration-200">
              <Mic className="w-5 h-5 mr-2" />
              {t('common.startRecording')}
            </Button>
          </Link>
          <Link to="/tabs/upload">
            <Button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-all duration-200">
              <Upload className="w-5 h-5 mr-2" />
              {t('dashboard.uploadAudio')}
            </Button>
          </Link>
          <Link to="/tabs/meetings">
            <Button variant="outline" className="px-6 py-3 rounded-xl border-gray-200 hover:bg-gray-100 transition-all duration-200">
              <ListMusic className="w-5 h-5 mr-2" />
              {t('dashboard.viewMeetings')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
