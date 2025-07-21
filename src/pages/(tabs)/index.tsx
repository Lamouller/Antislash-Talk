import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { FilePlus, ListMusic, Calendar, Clock, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
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
  { title: 'Total Meetings', value: '0', icon: ListMusic },
  { title: 'Recordings', value: '0', icon: FilePlus },
  { title: 'Time Recorded', value: '0s', icon: Clock },
  { title: 'Avg. Participants', value: '0.0', icon: Users },
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
        supabase.from('meetings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      ]);
      
      if (statsRes.error) {
        console.error('Error fetching dashboard stats:', JSON.stringify(statsRes.error, null, 2));
        setSummaryStats(initialStats);
      } else if (statsRes.data && statsRes.data.length > 0) {
        const stats = statsRes.data[0];
        setSummaryStats([
          { title: 'Total Meetings', value: stats.total_meetings.toString(), icon: ListMusic },
          { title: 'Recordings', value: stats.total_recordings.toString(), icon: FilePlus },
          { title: 'Time Recorded', value: formatDuration(stats.total_duration_sec), icon: Clock },
          { title: 'Avg. Participants', value: parseFloat(stats.avg_participants.toString()).toFixed(1), icon: Users },
        ]);
      } else {
        setSummaryStats(initialStats);
      }

      if (activityRes.error) {
        console.error('Error fetching weekly activity:', JSON.stringify(activityRes.error, null, 2));
        setChartData([]);
      } else {
        setChartData(activityRes.data);
      }
      
      if (recentRes.error) {
        console.error('Error fetching recent meetings:', JSON.stringify(recentRes.error, null, 2));
        setRecentMeetings([]);
      } else {
        setRecentMeetings(recentRes.data);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  }, 300);

  useEffect(() => {
    // We only want to refetch when the user is on the dashboard page
    if (location.pathname === '/' || location.pathname === '/tabs' || location.pathname === '/tabs/') {
      fetchDashboardData();
    }
  }, [location.pathname, fetchDashboardData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Welcome back! Here's a summary of your activity.
          </p>
        </div>
        <div className="flex space-x-4">
          <Link to="/tabs/record">
            <Button variant="outline">
              <FilePlus className="mr-2 h-5 w-5" />
              New Recording
            </Button>
          </Link>
          <Link to="/tabs/meetings">
            <Button>
              <ListMusic className="mr-2 h-5 w-5" />
              View Meetings
            </Button>
          </Link>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6 h-28 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))
        ) : (
          summaryStats.map((stat) => (
            <Card key={stat.title} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
                  <stat.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="xl:col-span-2">
          <Card className="p-6 h-96">
            <h2 className="text-xl font-bold mb-4">Weekly Activity</h2>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day_name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                      backdropFilter: 'blur(5px)',
                      border: '1px solid #ddd',
                      borderRadius: '0.5rem'
                    }} 
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="meetings_count" fill="#8884d8" name="Meetings" />
                  <Bar yAxisId="right" dataKey="duration_minutes" fill="#82ca9d" name="Duration (min)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Recent Meetings */}
        <div>
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Meetings</h2>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
                ))}
              </div>
            ) : (
              <ul className="space-y-4">
                {recentMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <Link to={`/meeting/${meeting.id}`} className="block hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-md">
                      <p className="font-semibold">{meeting.title}</p>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Calendar size={14} className="mr-2"/>
                        {new Date(meeting.created_at).toLocaleDateString()}
                        <Clock size={14} className="ml-4 mr-2"/>
                        {formatDuration(meeting.duration || 0)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}