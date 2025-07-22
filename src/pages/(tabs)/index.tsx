import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { FilePlus, ListMusic, Clock, Users, Mic, BarChart3, Activity } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';

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

const initialStats = [
  { title: 'Total Meetings', value: '0', icon: ListMusic, color: 'from-blue-500 to-indigo-600' },
  { title: 'Recordings', value: '0', icon: FilePlus, color: 'from-green-500 to-emerald-600' },
  { title: 'Time Recorded', value: '0s', icon: Clock, color: 'from-purple-500 to-pink-600' },
  { title: 'Avg. Participants', value: '0.0', icon: Users, color: 'from-orange-500 to-red-600' },
];

export default function TabsIndex() {
  const [summaryStats, setSummaryStats] = useState<any[]>(initialStats);
  const [chartData, setChartData] = useState<WeeklyActivity[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

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
            title: 'Total Meetings', 
            value: stats.total_meetings?.toString() || '0', 
            icon: ListMusic,
            color: 'from-blue-500 to-indigo-600'
          },
          { 
            title: 'Recordings', 
            value: stats.total_recordings?.toString() || '0', 
            icon: FilePlus,
            color: 'from-green-500 to-emerald-600'
          },
          { 
            title: 'Time Recorded', 
            value: formatDuration(stats.total_duration_seconds || 0), 
            icon: Clock,
            color: 'from-purple-500 to-pink-600'
          },
          { 
            title: 'Avg. Participants', 
            value: stats.avg_participants?.toFixed(1) || '0.0', 
            icon: Users,
            color: 'from-orange-500 to-red-600'
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
  }, [location, fetchDashboardData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-8 pb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg mb-6">
              <Activity className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard Overview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent mb-4">
              Welcome Back
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Track your meeting insights and transcription activity
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {summaryStats.map((stat) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={stat.title}
                  className="group relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color} shadow-lg`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {loading ? (
                            <div className="w-12 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          ) : (
                            stat.value
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.title}
                    </h3>
                  </div>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                </div>
              );
            })}
          </div>

          {/* Charts and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Weekly Activity Chart */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6">
              <div className="flex items-center mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 mr-3">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Activity</h2>
              </div>
              
              {loading ? (
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
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
                      name="Meetings" 
                      fill="url(#blueGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No activity data yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Meetings */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 mr-3">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Meetings</h2>
                </div>
                                 <Link to="/tabs/meetings">
                   <Button variant="outline" size="small" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                     View All
                   </Button>
                 </Link>
              </div>

              <div className="space-y-4">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      <div className="flex-1">
                        <div className="w-32 h-4 bg-gray-200 dark:bg-gray-600 rounded mb-2"></div>
                        <div className="w-24 h-3 bg-gray-200 dark:bg-gray-600 rounded"></div>
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
                      <div className="flex items-center space-x-4 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600/50 hover:bg-white/80 dark:hover:bg-gray-700/80 hover:shadow-md transition-all duration-200">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Mic className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {meeting.title || 'Untitled Meeting'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(meeting.created_at).toLocaleDateString()} • {formatDuration(meeting.duration || 0)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            meeting.status === 'completed' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {meeting.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No meetings yet</p>
                    <Link to="/tabs/record">
                      <Button className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                        Start Recording
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-4 p-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
              <Link to="/tabs/record">
                <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </Button>
              </Link>
              <Link to="/tabs/meetings">
                <Button variant="outline" className="px-6 py-3 rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-all duration-300">
                  <ListMusic className="w-5 h-5 mr-2" />
                  View Meetings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}