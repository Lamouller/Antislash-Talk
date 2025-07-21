import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, Square, Pause as PauseIcon, RefreshCw, Play, Radio, Waves, Sparkles, Clock, FileAudio, Settings } from 'lucide-react';
import { useWebAudioRecorder } from '../../hooks/useWebAudioRecorder';
import { useLocalTranscription, LocalTranscriptionResult } from '../../hooks/useLocalTranscription';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';

// Local formatTime function to avoid import issues
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) {
    return '00:00';
  }
  const date = new Date(0);
  date.setSeconds(seconds);
  const timeString = date.toISOString().substr(14, 5);
  return timeString;
};

type PageState = 'ready' | 'recording' | 'saving' | 'uploading' | 'processing' | 'error' | 'local-transcribing';

export default function RecordingScreen() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('ready');
  const [isPaused, setIsPaused] = useState(false);
  const [title, setTitle] = useState('');
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);

  const {
    isRecording,
    isPaused: recorderIsPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecorder
  } = useWebAudioRecorder();

  const {
    transcribe,
    isTranscribing,
    progress: transcriptionProgress
  } = useLocalTranscription();

  useEffect(() => {
    setIsPaused(recorderIsPaused);
  }, [recorderIsPaused]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setPageState('recording');
      toast.success('Recording started! 🎙️');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Please check your microphone permissions.');
      setPageState('error');
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setPageState('ready');
    toast.success('Recording stopped');
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
      toast.success('Recording resumed');
    } else {
      pauseRecording();
      toast.success('Recording paused');
    }
  };

  const handleTranscription = async (provider: string, model: string) => {
    if (!audioBlob) {
      toast.error('No audio recorded');
      return;
    }

    try {
      setPageState('local-transcribing');
      
      const result = await transcribe(audioBlob, model);
      
      if (result && result.text) {
        toast.success('Transcription completed! ✨');
        
        // Auto-save the meeting
        await handleSave(result);
      } else {
        throw new Error('Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPageState('error');
    }
  };

  const handleMistralTranscription = async () => {
    await handleTranscription('mistral', 'Voxtral-Mini-3B');
  };

  const handleSave = async (transcriptionResult?: LocalTranscriptionResult) => {
    if (!audioBlob && !transcriptionResult) {
      toast.error('No recording to save');
      return;
    }

    try {
      setPageState('saving');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let audioUrl = null;
      let transcript = null;
      let summary = null;

      // Upload audio if we have it
      if (audioBlob) {
        setPageState('uploading');
        const timestamp = Date.now();
        const fileName = `recordings/${user.id}/${timestamp}.webm`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
            upsert: false
          });

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('recordings')
          .getPublicUrl(fileName);
        
        audioUrl = publicUrl;
      }

      // Use transcription result if available
      if (transcriptionResult) {
        transcript = { text: transcriptionResult.text, chunks: transcriptionResult.chunks };
        summary = `Transcription completed with ${transcriptionResult.chunks?.length || 1} segments.`;
      }

      // Insert meeting record
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: title || `Meeting ${new Date().toLocaleDateString()}`,
          duration: Math.round(duration),
          recording_url: audioUrl,
          transcript: transcript,
          summary: summary,
          status: transcriptionResult ? 'completed' : 'pending',
          transcription_provider: 'local',
          transcription_model: 'whisper-tiny',
          participant_count: 1
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      setSavedMeetingId(meetingData.id);
      setPageState('ready');
      toast.success('Meeting saved successfully! 🎉');

      // Reset form
      resetRecorder();
      setTitle('');
      
      // Navigate to the meeting detail
      setTimeout(() => {
        navigate(`/tabs/meeting/${meetingData.id}`);
      }, 1000);

    } catch (error) {
      console.error('Save error:', error);
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPageState('error');
    }
  };

  const getStateConfig = () => {
    switch (pageState) {
      case 'recording':
        return {
          title: 'Recording in Progress',
          subtitle: 'Capture your meeting audio',
          color: 'from-red-500 to-pink-600',
          icon: Radio,
          bgColor: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20'
        };
      case 'local-transcribing':
        return {
          title: 'Transcribing Audio',
          subtitle: 'Converting speech to text...',
          color: 'from-blue-500 to-indigo-600',
          icon: Waves,
          bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
        };
      case 'saving':
      case 'uploading':
        return {
          title: 'Saving Meeting',
          subtitle: 'Uploading and processing your recording',
          color: 'from-green-500 to-emerald-600',
          icon: RefreshCw,
          bgColor: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
        };
      case 'error':
        return {
          title: 'Error Occurred',
          subtitle: 'Something went wrong',
          color: 'from-red-500 to-pink-600',
          icon: Square,
          bgColor: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20'
        };
      default:
        return {
          title: 'Ready to Record',
          subtitle: 'Start capturing your meeting',
          color: 'from-purple-500 to-pink-600',
          icon: Mic,
          bgColor: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
        };
    }
  };

  const stateConfig = getStateConfig();
  const StateIcon = stateConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-purple-900/20 dark:to-pink-900/20">
      <div className="relative overflow-hidden pt-8 pb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-red-600/10"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg mb-6">
              <FileAudio className="w-5 h-5 text-purple-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Recording</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 dark:from-white dark:via-purple-200 dark:to-pink-200 bg-clip-text text-transparent mb-4">
              {stateConfig.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {stateConfig.subtitle}
            </p>
          </div>

          {/* Main Recording Interface */}
          <div className="max-w-2xl mx-auto">
            
            {/* Status Card */}
            <div className={`bg-gradient-to-r ${stateConfig.bgColor} backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-8 mb-8`}>
              <div className="text-center">
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r ${stateConfig.color} flex items-center justify-center shadow-xl animate-pulse`}>
                  <StateIcon className="w-12 h-12 text-white" />
                </div>
                
                {/* Timer */}
                <div className="text-center mb-6">
                  <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white mb-2">
                    {formatTime(duration)}
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Recording Duration</span>
                  </div>
                </div>

                {/* Recording Indicator */}
                {isRecording && (
                  <div className="flex items-center justify-center space-x-2 mb-6">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {isPaused ? 'PAUSED' : 'RECORDING'}
                    </span>
                  </div>
                )}

                {/* Progress for transcription */}
                {isTranscribing && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>Transcribing...</span>
                      <span>{Math.round(transcriptionProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${transcriptionProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Meeting Title Input */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6 mb-8">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Meeting Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Meeting ${new Date().toLocaleDateString()}`}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                disabled={isRecording || isTranscribing}
              />
            </div>

            {/* Action Buttons */}
            <div className="grid gap-4">
              {!isRecording && !audioBlob && (
                <Button
                  onClick={handleStartRecording}
                  disabled={pageState !== 'ready'}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  <Mic className="w-6 h-6 mr-3" />
                  Start Recording
                </Button>
              )}

              {isRecording && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={handlePauseResume}
                    variant="outline"
                    className="py-4 text-lg font-semibold rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-6 h-6 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <PauseIcon className="w-6 h-6 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Square className="w-6 h-6 mr-2" />
                    Stop
                  </Button>
                </div>
              )}

              {audioBlob && !isRecording && (
                <div className="space-y-4">
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
                      Post-Processing Options
                    </h3>
                    <div className="grid gap-3">
                      <Button
                        onClick={() => handleTranscription('local', 'Xenova/whisper-tiny')}
                        disabled={isTranscribing}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <Waves className="w-5 h-5 mr-2" />
                        Transcribe with Local AI (Recommended)
                      </Button>
                      <Button
                        onClick={handleMistralTranscription}
                        disabled={isTranscribing}
                        variant="outline"
                        className="w-full py-3 rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <Settings className="w-5 h-5 mr-2" />
                        Transcribe with Mistral AI
                      </Button>
                      <Button
                        onClick={() => handleSave()}
                        disabled={isTranscribing}
                        variant="outline"
                        className="w-full py-3 rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <FileAudio className="w-5 h-5 mr-2" />
                        Save Audio Only
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Button */}
              {(audioBlob || pageState === 'error') && !isRecording && !isTranscribing && (
                <Button
                                   onClick={() => {
                   resetRecorder();
                   setTitle('');
                   setPageState('ready');
                   setSavedMeetingId(null);
                 }}
                  variant="outline"
                  className="w-full py-3 rounded-xl border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Start Over
                </Button>
              )}
            </div>

            {/* Success Message */}
            {savedMeetingId && (
              <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm rounded-2xl border border-green-200/50 dark:border-green-700/50 shadow-lg p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    Meeting Saved Successfully!
                  </h3>
                  <p className="text-green-700 dark:text-green-300 mb-4">
                    Your recording has been processed and saved. Redirecting to meeting details...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}