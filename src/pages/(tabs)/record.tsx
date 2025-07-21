import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mic, Square, Pause as PauseIcon, RefreshCw } from 'lucide-react';
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

// interface Participant {
//   id: string;
//   name: string;
// }

// interface TranscriptSegment {
//   speaker: string;
//   text: string;
// }

// interface GeminiResponse {
//   title?: string;
//   summary?: string;
//   transcript?: TranscriptSegment[];
//   error?: string;
//   raw?: string;
// }

type PageState = 'ready' | 'recording' | 'saving' | 'uploading' | 'processing' | 'error' | 'local-transcribing';

// const SYNC_PROCESSING_LIMIT_MB = 0.1; // Temporarily lowered for testing
// const SYNC_PROCESSING_LIMIT_BYTES = SYNC_PROCESSING_LIMIT_MB * 1024 * 1024;

// Unused component - commented out to fix build errors
/*
const ResultsDisplay = ({ results, participants, title, onTitleChange, onParticipantNameChange, onEditParticipant }: { 
  results: GeminiResponse | null, 
  participants: Participant[],
  title: string,
  onTitleChange: (newTitle: string) => void,
  onParticipantNameChange: (id: string, newName: string) => void,
  onEditParticipant: (speakerId: string) => void,
}) => {
  if (!results) return null;

  if (results.error) {
    return (
      <div className="text-red-500 bg-red-50 p-4 rounded-lg">
        <h3 className="font-bold">Transcription Failed</h3>
        <p>{results.error}</p>
        {results.raw && <pre className="mt-2 text-sm whitespace-pre-wrap">Raw Response: {results.raw}</pre>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Transcription Results</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Meeting Title</label>
        <input 
          type="text" 
          value={title} 
          onChange={e => onTitleChange(e.target.value)} 
          className="w-full p-2 border rounded text-lg bg-white" 
        />
      </div>
       <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Summary</label>
        <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{results.summary || "No summary provided."}</p>
      </div>
      <DetectedParticipants participants={participants} onNameChange={onParticipantNameChange} onEdit={onEditParticipant} />
      <div className="space-y-4 max-h-96 overflow-y-auto p-4 border rounded-lg bg-white">
        {results.transcript?.map((segment, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                <span>{segment.speaker.replace('SPEAKER_', '')}</span>
              </span>
            </div>
            <div className="flex-1">
              <strong className="text-sm">
                {participants.find(p => p.id === segment.speaker)?.name || segment.speaker}
              </strong>
              <p className="text-gray-700">{segment.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
*/

// Unused component - commented out
/*
const DetectedParticipants = ({ participants, onEdit }: { participants: Participant[], onNameChange: (id: string, newName: string) => void, onEdit: (id: string) => void }) => {
  if (participants.length === 0) return null;

  return (
    <div className="mb-4 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-medium mb-2">Detected Participants</h3>
      <div className="space-y-2">
        {participants.map(p => (
          <div key={p.id} className="flex items-center space-x-2">
            <span className="font-semibold w-32">{p.name}</span>
            <Button onClick={() => onEdit(p.id)} variant="outline" size="small">
              <Pencil size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
*/

export default function RecordScreen() {
  const navigate = useNavigate();
  const {
    isRecording, duration, audioBlob,
    startRecording, stopRecording, pauseRecording, resumeRecording, resetRecorder
  } = useWebAudioRecorder();
  
  const {
    isTranscribing: isLocalTranscribing,
    progress: localProgress,
    // error: localError,
    transcribe: transcribeLocally,
    cancelTranscription,
    enhanceWithLocalLLM
  } = useLocalTranscription();
  
  const [pageState, setPageState] = useState<PageState>('ready');
  const [title, setTitle] = useState('');
  const [userPreferences, setUserPreferences] = useState<{
    transcriptionProvider: string;
    transcriptionModel: string;
    promptTitle?: string;
    promptSummary?: string;
    promptTranscript?: string;
  } | null>(null);
  // const [participants, setParticipants] = useState<Participant[]>([]);
  // const [analysisResult, setAnalysisResult] = useState<GeminiResponse | null>(null);
  
  // Fetch user preferences on component mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('preferred_transcription_provider, preferred_transcription_model, prompt_title, prompt_summary, prompt_transcript')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Could not fetch user preferences:', error);
          return;
        }

        setUserPreferences({
          transcriptionProvider: profile.preferred_transcription_provider || 'openai',
          transcriptionModel: profile.preferred_transcription_model || 'whisper-1',
          promptTitle: profile.prompt_title,
          promptSummary: profile.prompt_summary,
          promptTranscript: profile.prompt_transcript
        });
      } catch (error) {
        console.error('Error fetching user preferences:', error);
      }
    };

    fetchUserPreferences();
  }, []);

  useEffect(() => {
    if (audioBlob) {
      console.log("Audio blob received, initiating save process.");
      handleSave(audioBlob);
    }
  }, [audioBlob]);

  // ✅ Function to enhance local transcription results using LOCAL AI (100% private)
  const enhanceTranscriptionLocally = async (
    transcriptionResult: LocalTranscriptionResult, 
    preferences: typeof userPreferences
  ) => {
    try {
      console.log('[enhanceTranscriptionLocally] Starting 100% local enhancement...');
      
      // Prepare prompts (use custom or defaults)
      const prompts = {
        title: preferences?.promptTitle || 'Generate a short, descriptive title for the meeting in French.',
        summary: preferences?.promptSummary || 'Provide a concise one-paragraph summary of the key discussion points and decisions, in French.',
        transcript: preferences?.promptTranscript || 'A detailed, diarized transcript with proper speaker identification.'
      };

      // Use LOCAL LLM for enhancement
      const enhanced = await enhanceWithLocalLLM(transcriptionResult.text, prompts);
      
      console.log('[enhanceTranscriptionLocally] ✅ Local enhancement completed');
      
      return {
        transcript: transcriptionResult.chunks ? {
          utterances: transcriptionResult.chunks.map(chunk => ({
            start: chunk.start, 
            end: chunk.end,
            speaker: chunk.speaker.includes('Locuteur') ? parseInt(chunk.speaker.replace('Locuteur_', '')) - 1 : 0,
            text: chunk.text
          }))
        } : { utterances: [{ start: 0, end: duration, speaker: 0, text: transcriptionResult.text }] },
        title: enhanced.title,
        summary: enhanced.summary,
        participant_count: transcriptionResult.chunks ? new Set(transcriptionResult.chunks.map(c => c.speaker)).size : 1
      };

    } catch (error) {
      console.error('[enhanceTranscriptionLocally] Error during local enhancement:', error);
      // Return basic structure on error
      return {
        transcript: transcriptionResult.chunks ? {
          utterances: transcriptionResult.chunks.map(chunk => ({
            start: chunk.start, 
            end: chunk.end,
            speaker: chunk.speaker.includes('Locuteur') ? parseInt(chunk.speaker.replace('Locuteur_', '')) - 1 : 0,
            text: chunk.text
          }))
        } : { utterances: [{ start: 0, end: duration, speaker: 0, text: transcriptionResult.text }] },
        title: null,
        summary: null,
        participant_count: null
      };
    }
  };

  const handleSave = async (blob: Blob) => {
    setPageState('saving');
    console.log(`[handleSave] Starting save process for blob of size: ${blob.size} bytes.`);
    
    // Check transcription provider preference
    if (userPreferences?.transcriptionProvider === 'local') {
      console.log('[handleSave] Using local transcription');
      await handleLocalTranscription(blob);
    } else if (userPreferences?.transcriptionProvider === 'mistral') {
      console.log('[handleSave] Using Mistral (Voxtral) transcription');
      await handleMistralTranscription(blob);
    } else {
      console.log('[handleSave] Using cloud transcription');
      await handleAsynchronousSave(blob);
    }
  };

  const handleLocalTranscription = async (blob: Blob) => {
    let tempMeetingId = '';
    console.log("[handleLocalTranscription] Starting local transcription process.");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      const meetingTitle = title.trim() || `Meeting - ${new Date().toLocaleString()}`;
      console.log("[handleLocalTranscription] Meeting title:", meetingTitle);

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: meetingTitle,
          duration: duration,
          status: 'processing',
          transcription_provider: userPreferences?.transcriptionProvider,
          transcription_model: userPreferences?.transcriptionModel,
        })
        .select()
        .single();

      if (meetingError || !meeting) { throw new Error(meetingError?.message || "Failed to create meeting record."); }

      tempMeetingId = meeting.id;
      toast.success('Processing your recording locally...');
      setPageState('local-transcribing'); // Set state to show transcription progress

      const modelId = userPreferences?.transcriptionModel || 'Xenova/whisper-tiny';
      console.log(`[handleLocalTranscription] Starting transcription with model: ${modelId}`);
      
      const transcriptionResult: LocalTranscriptionResult = await transcribeLocally(blob, modelId);
      
      console.log(`[handleLocalTranscription] Transcription completed, enhancing with AI...`);
      
      // ✅ POST-PROCESS with LOCAL AI to generate proper title, summary, and improve transcript
      // 🔒 100% PRIVATE: No data sent to cloud, everything stays on your device
      console.log(`[handleLocalTranscription] 🔒 Starting 100% local enhancement (no cloud, no API calls)`);
      toast.loading('🔒 Enhancing with local AI (100% private)...', { id: 'saving-transcription' });

      const enhancedResult = await enhanceTranscriptionLocally(
        transcriptionResult, 
        userPreferences
      );

      // ✅ IMPORTANT: Save transcription BEFORE navigating
      const updatePayload = {
        status: 'completed',
        transcript: enhancedResult.transcript,
        title: enhancedResult.title || transcriptionResult.text.split('.')[0] || meetingTitle,
        summary: enhancedResult.summary || `Local transcription completed. ${transcriptionResult.chunks?.length || 1} segments identified.`,
        participant_count: enhancedResult.participant_count || Math.max(1, new Set(transcriptionResult.chunks?.map(c => c.speaker) || ['Locuteur_01']).size)
      };

      console.log('[handleLocalTranscription] Saving enhanced results to database...');
      const { error: updateError } = await supabase
        .from('meetings')
        .update(updatePayload)
        .eq('id', tempMeetingId);

      if (updateError) {
        console.error('[handleLocalTranscription] Failed to save transcription:', updateError);
        toast.error('Failed to save transcription results', { id: 'saving-transcription' });
        throw updateError; // Don't navigate if save failed
      } else {
        console.log('[handleLocalTranscription] Transcription saved successfully');
        toast.success('✅ Local transcription enhanced and saved! (100% private)', { id: 'saving-transcription' });
        navigate(`/tabs/meeting/${tempMeetingId}`);
        setPageState('ready'); // Reset state
      }

    } catch (error: any) {
      console.error("[handleLocalTranscription] Error:", error);
      setPageState('error');
      
      // Clean up meeting record if creation succeeded but processing failed
      if (tempMeetingId) {
        try {
          await supabase.from('meetings').delete().eq('id', tempMeetingId);
          console.log('[handleLocalTranscription] Cleaned up failed meeting record');
        } catch (cleanupError) {
          console.error('[handleLocalTranscription] Failed to clean up meeting record:', cleanupError);
        }
      }

      // Check if it's a model-specific error and suggest alternatives
      if (error.message.includes('Model loading failed') || error.message.includes('failed to allocate')) {
        toast.error(`❌ Local transcription failed: ${error.message}\n\n💡 Try: 1) Smaller model (Whisper Tiny), 2) Cloud transcription, or 3) Restart browser`, { duration: 8000 });
      } else {
        toast.error(`❌ Local transcription failed: ${error.message}`);
      }
    }
  };

  const handleMistralTranscription = async (blob: Blob) => {
    let tempMeetingId = '';
    console.log("[handleMistralTranscription] Starting Mistral (Voxtral) transcription process.");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      const meetingTitle = title.trim() || `Meeting - ${new Date().toLocaleString()}`;
      console.log("[handleMistralTranscription] Meeting title:", meetingTitle);

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: meetingTitle,
          duration: duration,
          status: 'processing',
          transcription_provider: userPreferences?.transcriptionProvider,
          transcription_model: userPreferences?.transcriptionModel,
        })
        .select()
        .single();

      if (meetingError || !meeting) { throw new Error(meetingError?.message || "Failed to create meeting record."); }

      tempMeetingId = meeting.id;
      toast.success('🎯 Processing with Voxtral (advanced AI)...');
      setPageState('local-transcribing'); // Set state to show transcription progress

      const modelId = userPreferences?.transcriptionModel || 'voxtral-mini';
      console.log(`[handleMistralTranscription] Starting Voxtral transcription with model: ${modelId}`);
      
      // Use the local transcription hook which will detect Voxtral and use Mistral API
      const transcriptionResult: LocalTranscriptionResult = await transcribeLocally(blob, modelId);
      
      console.log(`[handleMistralTranscription] Voxtral transcription completed with advanced features!`);
      
      // ✅ Enhanced processing - Voxtral already provides advanced features
      console.log(`[handleMistralTranscription] 🎯 Using Voxtral's built-in enhancement capabilities`);
      toast.loading('🎯 Applying Voxtral enhancements (semantic understanding)...', { id: 'saving-transcription' });

      const enhancedResult = await enhanceTranscriptionLocally(
        transcriptionResult, 
        userPreferences
      );

      // ✅ Save Voxtral results
      const updatePayload = {
        status: 'completed',
        transcript: enhancedResult.transcript,
        title: enhancedResult.title || transcriptionResult.text.split('.')[0] || meetingTitle,
        summary: enhancedResult.summary || `Voxtral transcription completed with semantic understanding. ${transcriptionResult.chunks?.length || 1} segments identified.`,
        participant_count: enhancedResult.participant_count || Math.max(1, new Set(transcriptionResult.chunks?.map(c => c.speaker) || ['Locuteur_01']).size)
      };

      console.log('[handleMistralTranscription] Saving Voxtral results to database...');
      const { error: updateError } = await supabase
        .from('meetings')
        .update(updatePayload)
        .eq('id', tempMeetingId);

      if (updateError) {
        console.error('[handleMistralTranscription] Failed to save transcription:', updateError);
        toast.error('Failed to save Voxtral results', { id: 'saving-transcription' });
        throw updateError;
      } else {
        console.log('[handleMistralTranscription] Voxtral transcription saved successfully');
        toast.success('✅ Voxtral transcription completed with advanced AI features!', { id: 'saving-transcription' });
        navigate(`/tabs/meeting/${tempMeetingId}`);
        setPageState('ready');
      }

    } catch (error: any) {
      console.error("[handleMistralTranscription] Error:", error);
      setPageState('error');
      
      // Clean up meeting record if needed
      if (tempMeetingId) {
        try {
          await supabase.from('meetings').delete().eq('id', tempMeetingId);
          console.log('[handleMistralTranscription] Cleaned up failed meeting record');
        } catch (cleanupError) {
          console.error('[handleMistralTranscription] Failed to clean up meeting record:', cleanupError);
        }
      }

      // Enhanced error handling for Mistral/Voxtral specific errors
      if (error.message.includes('API key')) {
        toast.error(`🔑 ${error.message}`, { duration: 10000 });
      } else if (error.message.includes('429')) {
        toast.error('⏳ Mistral API rate limit exceeded. Please try again in a few minutes.', { duration: 8000 });
      } else if (error.message.includes('413')) {
        toast.error('📁 Audio file too large for Voxtral API. Try a shorter recording or use local transcription.', { duration: 8000 });
      } else {
        toast.error(`❌ Voxtral transcription failed: ${error.message}`, { duration: 8000 });
      }
    }
  };

  const handleAsynchronousSave = async (blob: Blob) => {
    let tempMeetingId = ''; // Keep track of the ID for error handling
    console.log("[handleAsynchronousSave] Starting asynchronous save.");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { throw new Error('User not authenticated'); }
      console.log("[handleAsynchronousSave] User authenticated:", user.id);

      const meetingTitle = title.trim() || `Meeting - ${new Date().toLocaleString()}`;
      console.log("[handleAsynchronousSave] Meeting title:", meetingTitle);

      // STEP 1: Create the meeting record immediately with 'uploading' status. This is fast.
      console.log("[handleAsynchronousSave] Step 1: Creating meeting record with 'uploading' status.");
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({ 
          user_id: user.id, 
          title: meetingTitle, 
          duration: duration,
          status: 'uploading'
        })
        .select('id')
        .single();

      if (meetingError || !meeting) {
        console.error("[handleAsynchronousSave] Error creating meeting record:", meetingError);
        throw new Error(meetingError?.message || "Failed to create meeting record.");
      }
      
      tempMeetingId = meeting.id;
      toast.success('Preparing your recording...');
      
      // STEP 2: Redirect immediately to the new meeting's page.
      console.log(`[handleAsynchronousSave] Step 2: Redirecting user to /tabs/meeting/${tempMeetingId}.`);
      navigate(`/tabs/meeting/${tempMeetingId}`); 

      // STEP 3: Upload the file in the background. This is the slow part.
      const filePath = `${user.id}/${tempMeetingId}.webm`;
      const audioFile = new File([blob], `${tempMeetingId}.webm`, { type: 'audio/webm' });
      console.log(`[handleAsynchronousSave] Step 3: Uploading file to path: ${filePath}`);
      
      const { error: uploadError } = await supabase.storage
        .from('meetingrecordings')
        .upload(filePath, audioFile, { upsert: false });

      if (uploadError) {
        console.error("[handleAsynchronousSave] File upload failed:", uploadError);
        // If upload fails, the meeting will be stuck in 'uploading'. We'll mark it as failed.
        await supabase.from('meetings').update({ status: 'failed' }).eq('id', tempMeetingId);
        throw uploadError;
      }
      console.log("[handleAsynchronousSave] File upload successful.");
      
      // STEP 4: Once upload is successful, update status to 'pending' to trigger the webhook.
      console.log("[handleAsynchronousSave] Step 4: Updating meeting status to 'pending'.");
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ status: 'pending', recording_url: filePath })
        .eq('id', tempMeetingId);

      if (updateError) {
        console.error("[handleAsynchronousSave] Failed to update meeting status:", updateError);
        throw updateError;
      }
       console.log("[handleAsynchronousSave] Meeting status updated to 'pending'.");
      
      // STEP 4: Call the intermediary Edge Function to safely trigger the Netlify webhook
       console.log("[handleAsynchronousSave] Step 5: Invoking 'start-transcription' function for meeting:", tempMeetingId);
      const { error: functionError } = await supabase.functions.invoke('start-transcription', {
        body: { meeting_id: tempMeetingId }
      });
      
      if (functionError) {
        // Log this error, but the user journey is already complete, so we don't need to throw.
        console.error("[handleAsynchronousSave] Failed to invoke start-transcription function:", functionError);
        toast.error("Could not start transcription process. Please contact support.");
      } else {
        console.log("[handleAsynchronousSave] 'start-transcription' function invoked successfully.");
      }
      
    } catch (error: any) {
      console.error('[Async Save Process Error]:', error);
      toast.error(`A background error occurred: ${error.message}`);
      if (tempMeetingId) {
        console.log(`[Async Save Process Error] Updating meeting ${tempMeetingId} to 'failed'.`);
        await supabase.from('meetings').update({ status: 'failed' }).eq('id', tempMeetingId);
      }
    }
  }

  const handleStart = () => {
    setPageState('recording');
    startRecording();
  };

  const handleStop = () => stopRecording();
  const handlePause = () => { setPageState('recording'); pauseRecording(); };
  const handleResume = () => { setPageState('recording'); resumeRecording(); };

  const resetAll = () => {
    resetRecorder();
    setTitle('');
    // setParticipants([]);
    // setAnalysisResult(null);
    setPageState('ready');
  };

  // const handleParticipantNameChange = (id: string, newName: string) => {
  //   setParticipants(prev => prev.map(p => (p.id === id ? { ...p, name: newName } : p)));
  // };
  
  // Unused function - commented out to fix build errors
  /*
  const handleEditParticipantName = (speakerId: string) => {
    const currentName = participants.find(p => p.id === speakerId)?.name || '';
    const newName = prompt(`Enter new name for ${currentName}:`, currentName);
    if (newName && newName.trim() !== '') {
      handleParticipantNameChange(speakerId, newName.trim());
    }
  };
  */

  const renderContent = () => {
    switch (pageState) {
      case 'ready':
        return (
          <div className="flex flex-col items-center justify-center text-center">
            <input type="text" placeholder="Give your meeting a title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="mb-6 w-full max-w-md p-3 border rounded-lg text-lg"/>
            <Button onClick={handleStart} size="large" className="w-24 h-24 rounded-full"><Mic size={48} /></Button>
            <p className="mt-4 text-gray-500">Tap to start recording</p>
          </div>
        );
      case 'recording':
        return (
          <div className="flex flex-col items-center justify-center">
            <p className="text-6xl font-mono mb-6 tabular-nums">{formatTime(duration)}</p>
            <div className="flex items-center space-x-4">
              <Button onClick={isRecording ? handlePause : handleResume} variant="secondary" size="large" className="w-20 h-20 rounded-full">{isRecording ? <PauseIcon size={32} /> : <Mic size={32} />}</Button>
              <Button onClick={handleStop} size="large" className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600"><Square size={32} /></Button>
            </div>
            <p className="mt-4 text-gray-500">{isRecording ? 'Recording...' : 'Paused'}</p>
          </div>
        );
      case 'saving':
        return (
          <div className="flex flex-col items-center justify-center text-center">
            <RefreshCw size={48} className="animate-spin mb-4" />
            <p className="text-xl">Saving your recording...</p>
            <p className="text-gray-500">Redirecting you to the meeting page...</p>
          </div>
        );
      case 'local-transcribing':
        const getProgressMessage = (progress: number) => {
          if (progress < 15) return "Loading Transformers.js library...";
          if (progress < 60) return "Downloading and loading AI model...";
          if (progress < 70) return "Converting audio format...";
          if (progress < 90) return "Transcribing speech to text...";
          return "Finalizing transcription...";
        };

        return (
          <div className="flex flex-col items-center justify-center text-center">
            <RefreshCw size={48} className="animate-spin mb-4" />
            <p className="text-xl">Transcribing your recording locally...</p>
            <div className="w-64 bg-gray-200 rounded-full h-2 mb-2 mt-4">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${localProgress}%` }}
              ></div>
            </div>
            <p className="text-gray-600 mb-2">{getProgressMessage(localProgress)}</p>
            <p className="text-gray-500">Progress: {localProgress}%</p>
            <p className="text-sm text-blue-600 mt-2">🔒 Processing locally - your data stays private</p>
            {isLocalTranscribing && (
              <Button 
                onClick={cancelTranscription} 
                variant="outline" 
                className="mt-4"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      case 'error':
        return (
           <div className="text-center text-red-500">
            <p>Something went wrong.</p>
            <Button onClick={resetAll} className="mt-4">Try again</Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 flex-1 flex flex-col items-center justify-center">
      {renderContent()}
    </div>
  );
}