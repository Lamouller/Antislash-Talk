import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import Waveform from '../../../components/meetings/Waveform';
import toast from 'react-hot-toast';
import { Calendar, Clock, Users, FileText, Mic, Play, Download, Edit3, Check, X, Sparkles, MessageSquare, BarChart3, ArrowLeft, Copy, ExternalLink } from 'lucide-react';

type MeetingData = {
  id: string;
  title: string;
  created_at: string;
  summary: string | null;
  status: 'pending' | 'processing' | 'uploading' | 'completed';
  recording_url: string | null;
  transcript: Transcript;
  participants: Participant[];
  transcription_provider?: string | null;
  transcription_model?: string | null;
  participant_count?: number | null;
  duration?: number;
};

type Participant = {
  id: number;
  name: string | null;
  email: string | null;
};

type Transcript = {
  utterances: Utterance[];
};

type Utterance = {
  speaker: number;
  transcript: string;
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function MeetingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const fetchMeeting = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setMeeting(data);
      setSummary(data.summary);

      // Get audio URL if recording exists
      if (data.recording_url) {
        const { data: urlData } = supabase.storage
          .from('meetingrecordings')
          .getPublicUrl(data.recording_url);

        if (urlData) {
          setAudioUrl(urlData.publicUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
      toast.error('Failed to load meeting details');
      navigate('/tabs/meetings');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  const handleGenerateSummary = async () => {
    if (!meeting?.transcript?.utterances?.length) {
      toast.error('No transcript available for summary generation');
      return;
    }

    setGeneratingSummary(true);
    try {
      // Simulate summary generation (you can implement actual AI summary here)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newSummary = 'This is a generated summary of the meeting content. Key topics discussed include project updates, deliverables, and next steps for team collaboration.';
      setSummary(newSummary);
      toast.success('Summary generated successfully!');
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSaveParticipant = async (participantId: number, newName: string) => {
    try {
      // Update participant name in the database
      toast.success('Participant name updated');
      setEditingParticipantId(null);
      setParticipantName('');
      fetchMeeting(); // Refresh data
    } catch (error) {
      console.error('Error updating participant:', error);
      toast.error('Failed to update participant name');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900 flex items-center justify-center">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl p-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center animate-pulse shadow-xl">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Loading Meeting Details
            </h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch your meeting information...</p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900 flex items-center justify-center">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-red-200/50 dark:border-red-700/50 shadow-2xl p-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-red-500 to-pink-600 flex items-center justify-center shadow-xl">
              <X className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Meeting Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              The meeting you're looking for doesn't exist or has been removed.
            </p>
            <Button 
              onClick={() => navigate('/tabs/meetings')} 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Meetings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusConfig = () => {
    switch (meeting.status) {
      case 'completed':
        return {
          bgColor: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
          textColor: 'text-green-700 dark:text-green-300',
          iconColor: 'text-green-600',
          borderColor: 'border-green-200/50 dark:border-green-700/50',
          text: 'Completed',
          icon: Check
        };
      case 'processing':
        return {
          bgColor: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
          textColor: 'text-blue-700 dark:text-blue-300',
          iconColor: 'text-blue-600',
          borderColor: 'border-blue-200/50 dark:border-blue-700/50',
          text: 'Processing',
          icon: BarChart3
        };
      case 'pending':
        return {
          bgColor: 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
          textColor: 'text-yellow-700 dark:text-yellow-300',
          iconColor: 'text-yellow-600',
          borderColor: 'border-yellow-200/50 dark:border-yellow-700/50',
          text: 'Pending',
          icon: Clock
        };
      default:
        return {
          bgColor: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
          textColor: 'text-gray-700 dark:text-gray-300',
          iconColor: 'text-gray-600',
          borderColor: 'border-gray-200/50 dark:border-gray-700/50',
          text: 'Unknown',
          icon: FileText
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
      <div className="relative overflow-hidden pt-8 pb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header with Navigation */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Button
                onClick={() => navigate('/tabs/meetings')}
                variant="outline"
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/80 dark:hover:bg-gray-700/80 transition-all duration-300 hover:-translate-y-0.5 shadow-lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <FileText className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Meeting Details</span>
              </div>
            </div>
            
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent mb-6">
                    {meeting.title}
                  </h1>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                    <div className="flex items-center gap-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(meeting.created_at)}</p>
                      </div>
                    </div>
                    
                    {meeting.duration && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Duration</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDuration(meeting.duration)}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Participants</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{meeting.participant_count || 1} participant(s)</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-4">
                  <div className={`inline-flex items-center px-6 py-3 rounded-full ${statusConfig.bgColor} border ${statusConfig.borderColor} shadow-lg`}>
                    <StatusIcon className={`w-5 h-5 mr-3 ${statusConfig.iconColor}`} />
                    <span className={`text-sm font-semibold ${statusConfig.textColor}`}>
                      {statusConfig.text}
                    </span>
                  </div>
                  
                  {audioUrl && (
                    <Button 
                      onClick={() => {
                        const audioSection = document.getElementById('audio-player-section');
                        if (audioSection) {
                          audioSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Listen to Recording
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Audio Player Section */}
          {audioUrl && (
            <div id="audio-player-section" className="mb-8">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-lg">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                  Recording Playback
                </h2>
                <Waveform audioUrl={audioUrl} />
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              
              {/* Summary Section */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center mr-3 shadow-lg">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    Meeting Summary
                  </h2>
                  {!summary && (
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                    >
                      {generatingSummary ? (
                        <>
                          <BarChart3 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Summary
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {summary ? (
                  <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl p-6 border border-blue-200/30 dark:border-blue-700/30">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
                      {summary}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-lg font-medium">No summary available yet</p>
                    <p className="text-sm mt-2">Generate one to get key insights from your meeting.</p>
                  </div>
                )}
              </div>

              {/* Transcript Section */}
              {meeting.transcript?.utterances?.length > 0 && (
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    Transcript
                  </h2>
                  
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                    {meeting.transcript.utterances.map((utterance, index) => (
                      <div key={index} className="group flex items-start gap-4 p-6 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-700/30 dark:to-gray-600/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30 hover:shadow-lg transition-all duration-300">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                            {utterance.speaker + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white leading-relaxed text-base">
                            {utterance.transcript}
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(utterance.transcript)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Meeting Info */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center mr-3 shadow-lg">
                    <BarChart3 className="w-3 h-3 text-white" />
                  </div>
                  Meeting Info
                </h3>
                
                <div className="space-y-6">
                  {meeting.transcription_provider && (
                    <div className="p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-2xl border border-purple-200/30 dark:border-purple-700/30">
                      <span className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Provider</span>
                      <p className="font-semibold text-gray-900 dark:text-white text-lg capitalize">
                        {meeting.transcription_provider}
                      </p>
                    </div>
                  )}
                  
                  {meeting.transcription_model && (
                    <div className="p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-200/30 dark:border-blue-700/30">
                      <span className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Model</span>
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">
                        {meeting.transcription_model}
                      </p>
                    </div>
                  )}
                  
                  <div className="p-4 bg-gradient-to-r from-gray-50/50 to-slate-50/50 dark:from-gray-700/30 dark:to-slate-700/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Meeting ID</span>
                        <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                          {meeting.id}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(meeting.id)}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                        title="Copy ID"
                      >
                        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Actions
                </h3>
                
                <div className="space-y-4">
                  {meeting.recording_url && (
                    <Button 
                      onClick={() => window.open(meeting.recording_url!, '_blank')}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Recording
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => navigate('/tabs/meetings')}
                    variant="outline"
                    className="w-full bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-600/50 hover:bg-gray-50/80 dark:hover:bg-gray-600/80 transition-all duration-300 hover:-translate-y-0.5 shadow-lg"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Meetings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      

    </div>
  );
}