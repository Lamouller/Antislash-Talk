import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js'
import { supabase } from '../../lib/supabase';
import type { Meeting } from '../../lib/schemas';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowLeft, User, Clock, Cpu, Play, Pause } from 'lucide-react';

type Tab = 'summary' | 'transcript';

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className}`}>
    {children}
  </span>
);

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);

  const play = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };


  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id) {
        setError('Meeting ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          throw new Error('Meeting not found or you do not have access.');
        }

        setMeeting(data);

        if (data.recording_url) {
            const { data: urlData } = supabase.storage
                .from('meetingrecordings')
                .getPublicUrl(data.recording_url);

            if (urlData) {
                setAudioUrl(urlData.publicUrl);
            }
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeeting();
  }, [id]);

  useEffect(() => {
    if (audioUrl && waveformContainerRef.current) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }

      wavesurferRef.current = WaveSurfer.create({
        container: waveformContainerRef.current,
        waveColor: 'rgb(200, 200, 200)',
        progressColor: 'rgb(100, 100, 100)',
        url: audioUrl,
        height: 60,
      });

      wavesurferRef.current.on('play', () => setIsPlaying(true));
      wavesurferRef.current.on('pause', () => setIsPlaying(false));
      wavesurferRef.current.on('finish', () => setIsPlaying(false));

      return () => {
        wavesurferRef.current?.destroy();
      };
    }
  }, [audioUrl]);

  if (loading) {
    return <div className="p-8 text-center">Loading meeting details...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  if (!meeting) {
    return <div className="p-8 text-center">Meeting not found.</div>;
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <Button variant="outline" onClick={() => navigate('/tabs/meetings')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to All Meetings
      </Button>

      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <div className="text-sm text-gray-500 flex items-center flex-wrap gap-x-4 gap-y-2 mt-2">
            <span>{new Date(meeting.created_at).toLocaleString()}</span>
            <span className="flex items-center"><Clock className="mr-1 h-4 w-4" /> {formatDuration(meeting.duration)}</span>
            {meeting.transcription_provider && (
              <Badge>
                <Cpu className="mr-1.5 h-4 w-4" />
                {meeting.transcription_provider}: {meeting.transcription_model}
              </Badge>
            )}
          </div>
        </div>

        {audioUrl && (
          <div className="p-6 border-t">
              <div className="flex items-center space-x-4">
                  <Button onClick={play} variant="outline" size="small">
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <div ref={waveformContainerRef} className="w-full" />
              </div>
          </div>
        )}

        <div className="p-6 pt-0">
          <div className="border-b mb-4">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('summary')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'summary' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'transcript' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Transcript
              </button>
            </nav>
          </div>

          <div>
            {activeTab === 'summary' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Meeting Summary</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{meeting.summary || 'No summary available.'}</p>
              </div>
            )}
            {activeTab === 'transcript' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Full Transcript</h3>
                <div className="space-y-6">
                  {Array.isArray(meeting.transcript) ? (
                    meeting.transcript.map((segment: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 bg-gray-200 rounded-full h-10 w-10 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{segment.speaker}</p>
                          <div className="bg-gray-100 p-3 rounded-lg mt-1">
                            <p className="text-gray-800">{segment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No transcript available or format is incorrect.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
} 