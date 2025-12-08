import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLocalTranscription } from '../../hooks/useLocalTranscription';
import { Button } from '../../components/ui/Button';
import { Upload, FileAudio, X, CheckCircle, Sparkles, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function UploadAudioPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  // 🚀 LOCAL TRANSCRIPTION HOOK
  const { transcribe, isTranscribing, progress: transcriptionProgress } = useLocalTranscription();

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    handleFileSelection(droppedFile);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  }, []);

  const handleFileSelection = (selectedFile: File) => {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/x-m4a'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'mp4', 'mpeg'];

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension || '')) {
      toast.error(t('upload.invalidFileType'));
      return;
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error(t('upload.fileTooLarge'));
      return;
    }

    setFile(selectedFile);
    toast.success(t('upload.fileSelected'));
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error(t('upload.selectFileFirst'));
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error(t('upload.loginRequired'));
      }

      // Upload to Storage
      setProgress(20);
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${user.id}/${timestamp}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('meetingrecordings')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      setProgress(50);

      // Get user preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_transcription_provider, preferred_transcription_model, preferred_llm, preferred_llm_model')
        .eq('id', user.id)
        .single();

      // Create meeting record
      const meetingTitle = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const meetingPayload = {
        user_id: user.id,
        title: meetingTitle || `Uploaded Meeting ${new Date().toLocaleDateString()}`,
        recording_url: fileName,
        status: 'pending',
        transcription_provider: profile?.preferred_transcription_provider || 'google',
        transcription_model: profile?.preferred_transcription_model || 'gemini-2.0-flash-exp',
        llm_provider: profile?.preferred_llm || 'openai',
        llm_model: profile?.preferred_llm_model || 'gpt-4o-mini',
      };

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert([meetingPayload])
        .select()
        .single();

      if (meetingError) throw meetingError;

      setProgress(70);
      setMeetingId(meeting.id);

      // 🚀 CHECK IF LOCAL TRANSCRIPTION IS SELECTED
      const isLocalTranscription = profile?.preferred_transcription_provider === 'local';

      if (isLocalTranscription) {
        // ✨ LOCAL TRANSCRIPTION WITH BROWSER/PYTORCH/WHISPER.CPP
        console.log('🚀 Using LOCAL transcription...');
        toast(t('upload.transcribing'), { duration: 3000 });

        try {
          // Transcribe directly from the file (it's already a Blob)
          const modelId = profile?.preferred_transcription_model || 'tiny';
          console.log(`📝 Transcribing with model: ${modelId}`);

          const result = await transcribe(file, modelId);

          console.log('✅ Local transcription completed!');

          // Update meeting with transcription result
          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              status: 'completed',
              transcript: result.chunks || [],
            })
            .eq('id', meeting.id);

          if (updateError) {
            console.error('❌ Failed to update meeting:', updateError);
            throw updateError;
          }

          setProgress(100);
          toast.success(t('upload.localSuccess'));

          // Navigate to meeting details
          setTimeout(() => {
            navigate(`/tabs/meeting/${meeting.id}`);
          }, 2000);

          // 🎯 Return the created meeting for auto-summary
          // Note: added check for result.text if we want to do something with it later

        } catch (transcribeError) {
          console.error('❌ Local transcription failed:', transcribeError);
          toast.error(t('upload.localError'));

          // Still navigate to the meeting page
          setTimeout(() => {
            navigate(`/tabs/meeting/${meeting.id}`);
          }, 2000);
        }

      } else {
        // 🌐 API TRANSCRIPTION (GOOGLE, OPENAI, ETC.)
        console.log('🌐 Using API transcription...');

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-transcription`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ meeting_id: meeting.id }),
          });

          if (response.ok) {
            setProgress(100);
            toast.success(t('upload.uploadStarted'));

            // Navigate to meeting details after 2 seconds
            setTimeout(() => {
              navigate(`/tabs/meeting/${meeting.id}`);
            }, 2000);
          } else {
            setProgress(100);
            toast.success(t('upload.uploadManual'));
            setTimeout(() => {
              navigate(`/tabs/meeting/${meeting.id}`);
            }, 2000);
          }
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : t('upload.uploadFailed'));
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/tabs/meetings')}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('upload.backToMeetings')}
          </Button>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <Upload className="w-10 h-10 mr-4 text-blue-500" />
            {t('upload.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('upload.subtitle')}
          </p>
        </div>

        {/* Upload Area */}
        <div className="max-w-3xl mx-auto">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl 
              border-2 border-dashed transition-all duration-300 p-12
              ${isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-105'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
              }
              ${uploading ? 'pointer-events-none opacity-75' : ''}
            `}
          >
            {!file ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <FileAudio className="w-10 h-10 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('upload.dropHere')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('upload.clickToBrowse')}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t('upload.selectButton')}
                </Button>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  {t('upload.supportedFormats')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* File Info */}
                <div className="flex items-start justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-700/50">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <FileAudio className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {file.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatFileSize(file.size)} • {file.type || t('upload.audioFile')}
                      </p>
                    </div>
                  </div>

                  {!uploading && (
                    <Button
                      onClick={removeFile}
                      variant="outline"
                      size="small"
                      className="ml-4"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Progress Bar */}
                {(uploading || isTranscribing) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {isTranscribing ? t('upload.transcribing') : t('upload.processing')}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {isTranscribing ? `${transcriptionProgress}%` : `${progress}%`}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${isTranscribing ? transcriptionProgress : progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                {!uploading && !isTranscribing && !meetingId && (
                  <Button
                    onClick={handleUpload}
                    disabled={!file || uploading || isTranscribing}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    {t('upload.uploadAndTranscribe')}
                  </Button>
                )}

                {/* Success Message */}
                {meetingId && (
                  <div className="flex items-center justify-center space-x-3 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-semibold">{t('upload.successRedirect')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t('upload.fastUploadTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('upload.fastUploadDesc')}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t('upload.autoTranscribeTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('upload.autoTranscribeDesc')}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t('upload.readyTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('upload.readyDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
