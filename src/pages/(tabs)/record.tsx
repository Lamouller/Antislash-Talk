import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, Square, Pause as PauseIcon, RefreshCw, Play, Radio, Waves, Sparkles, Clock, FileAudio, Settings } from 'lucide-react';
import { useWebAudioRecorder } from '../../hooks/useWebAudioRecorder';
import { useLocalTranscription, LocalTranscriptionResult } from '../../hooks/useLocalTranscription';
import { getAdaptivePrompts, getWhisperOptimizedPrompts, requiresSpecialPrompts } from '../../lib/adaptive-prompts';
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
  
  // User preferences state
  const [userPreferences, setUserPreferences] = useState({
    transcription_provider: 'local',
    transcription_model: 'whisper-tiny',
    llm_provider: 'openai',
    llm_model: 'gpt-4o-mini'
  });

  // Custom prompts state
  const [userPrompts, setUserPrompts] = useState({
    title: '',
    summary: '',
    transcript: ''
  });

  // Recording behavior state - restored auto-processing logic
  const [autoTranscribeAfterRecording, setAutoTranscribeAfterRecording] = useState(true);
  const [waitingForAutoProcess, setWaitingForAutoProcess] = useState(false);

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
    progress: transcriptionProgress,
    enhanceWithLocalLLM
  } = useLocalTranscription();

  useEffect(() => {
    setIsPaused(recorderIsPaused);
  }, [recorderIsPaused]);

  // Auto-processing when audioBlob becomes available
  useEffect(() => {
    if (waitingForAutoProcess && audioBlob && !isRecording) {
      console.log('✅ AudioBlob ready, starting auto-processing');
      setWaitingForAutoProcess(false);
      
      if (userPreferences.transcription_provider === 'local') {
        console.log('🏠 Starting local transcription automatically');
        handleTranscription(userPreferences.transcription_provider, userPreferences.transcription_model);
      } else {
        console.log('☁️ Starting cloud transcription upload automatically');
        handleSave(); // This triggers the Netlify webhook
      }
    }
  }, [waitingForAutoProcess, audioBlob, isRecording, userPreferences]);

  // Fetch user preferences on component mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('preferred_transcription_provider, preferred_transcription_model, preferred_llm, preferred_llm_model, prompt_title, prompt_summary, prompt_transcript, auto_transcribe_after_recording, preferred_language')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Could not fetch user preferences:', error.message);
          return;
        }

        if (profile) {
          setUserPreferences({
            transcription_provider: profile.preferred_transcription_provider || 'local',
            transcription_model: profile.preferred_transcription_model || 'whisper-tiny',
            llm_provider: profile.preferred_llm || 'openai',
            llm_model: profile.preferred_llm_model || 'gpt-4o-mini'
          });

                  // Use adaptive prompts based on transcription provider and language
        const adaptivePrompts = requiresSpecialPrompts(profile.preferred_transcription_provider, profile.preferred_transcription_model)
          ? getWhisperOptimizedPrompts(profile.preferred_language || 'fr')
          : getAdaptivePrompts(
              profile.preferred_transcription_provider || 'openai',
              profile.preferred_language || 'fr',
              {
                title: profile.prompt_title,
                summary: profile.prompt_summary,
                transcript: profile.prompt_transcript
              }
            );

        setUserPrompts(adaptivePrompts);

          console.log('🎯 Loaded user preferences:', {
            transcription_provider: profile.preferred_transcription_provider,
            transcription_model: profile.preferred_transcription_model,
            llm_provider: profile.preferred_llm,
            llm_model: profile.preferred_llm_model
          });

          console.log('📝 Loaded custom prompts:', {
            title: profile.prompt_title ? 'Custom' : 'Default',
            summary: profile.prompt_summary ? 'Custom' : 'Default',
            transcript: profile.prompt_transcript ? 'Custom' : 'Default'
          });

          // Set recording behavior preference from DB
          setAutoTranscribeAfterRecording(profile.auto_transcribe_after_recording ?? true);
          console.log('🎬 Auto-transcribe after recording:', profile.auto_transcribe_after_recording ?? true);
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      }
    };

    fetchUserPreferences();
  }, []);

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

  const handleStopRecording = async () => {
    stopRecording();
    setPageState('ready');
    toast.success('Recording stopped');
    
    // Auto-processing si activé dans les préférences
    if (autoTranscribeAfterRecording) {
      console.log('🤖 Auto-processing enabled, waiting for audioBlob...');
      toast.success('Auto-processing will start once recording is ready... 🤖');
      setWaitingForAutoProcess(true);
    } else {
      console.log('🎙️ Auto-processing disabled, showing manual options');
    }
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

  const handleTranscription = async (_provider: string, model: string) => {
    if (!audioBlob) {
      toast.error('No audio recorded');
      return;
    }

    try {
      setPageState('local-transcribing');
      
      console.log('🎯 Starting transcription with custom prompts:', userPrompts);
      
      const result = await transcribe(audioBlob, model);
      
      if (result && result.text) {
        console.log('✅ Transcription completed, enhancing with custom prompts...');
        
        // Apply custom prompts for enhancement
        try {
          const enhanced = await enhanceWithLocalLLM(result.text, userPrompts);
          console.log('🌟 Enhanced result with custom prompts:', enhanced);
          
                     // Combine transcription result with enhanced metadata
           const enhancedResult = {
             ...result,
             enhancedTitle: enhanced.title,
             enhancedSummary: enhanced.summary
           } as LocalTranscriptionResult & {enhancedTitle: string; enhancedSummary: string};
          
          toast.success('Transcription & enhancement completed! ✨');
          await handleSave(enhancedResult);
        } catch (enhanceError) {
          console.warn('⚠️ Enhancement failed, using basic result:', enhanceError);
          toast.success('Transcription completed! ✨');
          await handleSave(result);
        }
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

  const handleSave = async (transcriptionResult?: LocalTranscriptionResult & {enhancedTitle?: string; enhancedSummary?: string}) => {
    console.log('💾 handleSave called with:', { 
      hasAudioBlob: !!audioBlob, 
      audioBlobSize: audioBlob?.size, 
      hasTranscriptionResult: !!transcriptionResult,
      autoTranscribeAfterRecording,
      userPreferences 
    });

    if (!audioBlob && !transcriptionResult) {
      console.error('❌ No recording to save - missing both audioBlob and transcriptionResult');
      toast.error('No recording to save');
      return;
    }

    try {
      console.log('🚀 Starting handleSave process...');
      setPageState('saving');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 User authentication check:', { hasUser: !!user, userError });
      if (!user) throw new Error('User not authenticated');

      let audioUrl = null;
      let transcript = null;
      let summary = null;

      // Upload audio if we have it
      if (audioBlob) {
        console.log('📤 Starting audio upload...', { 
          audioBlobSize: audioBlob.size, 
          audioBlobType: audioBlob.type 
        });
        setPageState('uploading');
        const timestamp = Date.now();
        const fileName = `${user.id}/${timestamp}.webm`;
        console.log('📁 Upload path:', fileName);
        
        const { error: uploadError } = await supabase.storage
          .from('meetingrecordings')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          throw uploadError;
        }
        
        console.log('✅ Audio uploaded successfully to:', fileName);
        // Store just the file path, not the full URL
        // This is consistent with how the Supabase functions handle it
        audioUrl = fileName;
      } else {
        console.log('⚠️ No audioBlob to upload');
      }

      // Use transcription result if available
      if (transcriptionResult) {
        transcript = { text: transcriptionResult.text, chunks: transcriptionResult.chunks };
        
        // Use enhanced metadata if available
        const enhanced = transcriptionResult as any;
        if (enhanced.enhancedTitle || enhanced.enhancedSummary) {
          if (enhanced.enhancedTitle && !title) {
            setTitle(enhanced.enhancedTitle);
          }
          summary = enhanced.enhancedSummary || `Transcription completed with ${transcriptionResult.chunks?.length || 1} segments.`;
          console.log('📝 Using enhanced metadata from custom prompts');
        } else {
          summary = `Transcription completed with ${transcriptionResult.chunks?.length || 1} segments.`;
        }
      }

      // Insert meeting record with user preferences
      const meetingPayload = {
        user_id: user.id,
        title: title || `Meeting ${new Date().toLocaleDateString()}`,
        duration: Math.round(duration),
        recording_url: audioUrl,
        transcript: transcript,
        summary: summary,
        status: transcriptionResult ? 'completed' : 'pending',
        transcription_provider: transcriptionResult ? 'local' : userPreferences.transcription_provider,
        transcription_model: userPreferences.transcription_model, // Always use user's preferred model
        participant_count: 1
      };
      
      console.log('💾 Inserting meeting with payload:', meetingPayload);
      
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingPayload)
        .select()
        .single();

      console.log('💾 Saved meeting with preferences:', {
        id: meetingData.id,
        title: meetingData.title,
        status: transcriptionResult ? 'completed' : 'pending',
        transcription_provider: transcriptionResult ? 'local' : userPreferences.transcription_provider,
        transcription_model: userPreferences.transcription_model,
        has_audio: !!audioUrl,
        has_transcript: !!transcript,
        will_trigger_async: !transcriptionResult && userPreferences.transcription_provider !== 'local'
      });

      if (meetingError) {
        console.error('❌ Meeting creation error:', meetingError);
        throw meetingError;
      }
      
      console.log('✅ Meeting created successfully:', meetingData);

      // Trigger async transcription if needed (non-local providers)
      if (!transcriptionResult && userPreferences.transcription_provider !== 'local') {
        console.log('🚀 Triggering async transcription with provider:', userPreferences.transcription_provider);
        try {
          setPageState('processing');
          
          // Call start-transcription function
          const { data: { session } } = await supabase.auth.getSession();
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/start-transcription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              meeting_id: meetingData.id
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          console.log('✅ Async transcription started:', result);
          toast.success('Transcription started! Processing in background... 🔄');
        } catch (error) {
          console.error('❌ Failed to start async transcription:', error);
          toast.error('Transcription will be processed automatically');
        }
      }

      setSavedMeetingId(meetingData.id);
      setPageState('ready');
      
      if (transcriptionResult) {
        toast.success('Meeting saved successfully! 🎉');
      } else {
        toast.success('Meeting uploaded! Transcription will be processed... 🔄');
      }

      // Reset form
      resetRecorder();
      setTitle('');
      
      // Navigate to the meeting detail
      setTimeout(() => {
        navigate(`/tabs/meeting/${meetingData.id}`);
      }, 1000);

    } catch (error) {
      console.error('❌ Save error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        hasAudioBlob: !!audioBlob,
        hasUser: !!(await supabase.auth.getUser()).data.user
      });
      
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }
      
      toast.error(`Failed to save meeting: ${errorMessage}`);
      setPageState('error');
      setWaitingForAutoProcess(false); // Reset waiting state on error
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

            {/* Audio Security Policy Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    🔒 Audio Security Policy
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Audio recordings are automatically deleted after <strong>48 hours</strong> for security and storage optimization. 
                    Download your audio files before expiration if needed.
                  </p>
                </div>
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

            {/* User Preferences Display */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Current Transcription Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200/30 dark:border-blue-700/30">
                  <div className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium">Provider</div>
                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 capitalize">
                    {userPreferences.transcription_provider}
                    {userPreferences.transcription_provider === 'local' && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                        Private
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200/30 dark:border-purple-700/30">
                  <div className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide font-medium">Model</div>
                  <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {userPreferences.transcription_model}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                {userPreferences.transcription_provider === 'local' ? (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Local transcription - 100% private, processed in your browser
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Cloud transcription - Will be processed asynchronously after upload
                  </span>
                )}
                
                {/* Custom prompts indicator */}
                {(userPrompts.title !== 'Generate a short, descriptive title for the meeting in French.' ||
                  userPrompts.summary !== 'Provide a concise one-paragraph summary of the key discussion points and decisions, in French.' ||
                  userPrompts.transcript !== 'A detailed, diarized transcript with speaker identification.') && (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                    Custom prompts configured - Your personalized instructions will be used
                  </span>
                )}
              </div>
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

              {audioBlob && !isRecording && !autoTranscribeAfterRecording && (
                <div className="space-y-4">
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
                      Processing Options
                    </h3>
                    
                    {/* Automatic processing with user preferences */}
                    <div className="grid gap-3">
                      <Button
                        onClick={() => {
                          if (userPreferences.transcription_provider === 'local') {
                            handleTranscription('local', userPreferences.transcription_model);
                          } else {
                            handleSave(); // Will trigger async transcription with user preferences
                          }
                        }}
                        disabled={isTranscribing}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg font-semibold"
                      >
                        {userPreferences.transcription_provider === 'local' ? (
                          <>
                            <Waves className="w-5 h-5 mr-2" />
                            Transcribe with {userPreferences.transcription_model} (Local)
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Process with {userPreferences.transcription_provider} {userPreferences.transcription_model}
                          </>
                        )}
                      </Button>
                      
                      {/* Alternative options */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                          🔧 Other Processing Options
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {userPreferences.transcription_provider !== 'local' && (
                            <Button
                              onClick={() => handleTranscription('local', 'Xenova/whisper-tiny')}
                              disabled={isTranscribing}
                              variant="outline"
                              className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                            >
                              <Waves className="w-4 h-4 mr-2" />
                              Try Local Transcription Instead
                            </Button>
                          )}
                          <Button
                            onClick={handleMistralTranscription}
                            disabled={isTranscribing}
                            variant="outline"
                            className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Test Mistral AI (Voxtral)
                          </Button>
                          <Button
                            onClick={() => handleSave()}
                            disabled={isTranscribing}
                            variant="outline"
                            className="w-full py-2 text-sm rounded-lg border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <FileAudio className="w-4 h-4 mr-2" />
                            Save Audio Only
                          </Button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-transcription indicator when enabled */}
              {audioBlob && !isRecording && autoTranscribeAfterRecording && !isTranscribing && (
                <div className="bg-blue-50/70 dark:bg-blue-900/30 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg p-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Auto-Processing Enabled
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {userPreferences.transcription_provider === 'local' 
                        ? 'Local transcription will start automatically' 
                        : 'Cloud transcription will start automatically after upload'
                      } using your preferred settings: 
                      <br />
                      <span className="font-medium">{userPreferences.transcription_provider} - {userPreferences.transcription_model}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      You can change this behavior in Settings → Recording Behavior
                    </p>
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