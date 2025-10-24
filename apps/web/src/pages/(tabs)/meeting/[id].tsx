import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import Waveform from '../../../components/meetings/Waveform';
import toast from 'react-hot-toast';
import { Calendar, Clock, Users, FileText, Play, Download, Check, X, Sparkles, MessageSquare, BarChart3, ArrowLeft, Copy, User, Edit2, FileDown, FileType, Table, Code } from 'lucide-react';
import jsPDF from 'jspdf';
import { useLocalTranscription } from '../../../hooks/useLocalTranscription';

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
  speaker_names?: Record<string, string> | null;
  audio_expires_at?: string | null;
};

type Participant = {
  id: number;
  name: string | null;
  email: string | null;
};

type Transcript = {
  utterances: Utterance[];
} | Array<{
  text: string;
  speaker?: string;
  start?: number;
  end?: number;
}>;

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

// Type guard helper
const hasUtterancesFormat = (transcript: Transcript): transcript is { utterances: Utterance[] } => {
  return !Array.isArray(transcript) && 'utterances' in transcript;
};

export default function MeetingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { generateTitle, generateSummary } = useLocalTranscription();

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  // Removed unused state variables
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Speaker editing states
  const [customSpeakerNames, setCustomSpeakerNames] = useState<Record<string, string>>({});
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempSpeakerName, setTempSpeakerName] = useState('');
  
  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'json' | 'csv' | 'txt'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const fetchMeeting = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, audio_expires_at')
        .eq('id', id)
        .single();

      if (error) throw error;

      setMeeting(data);
      setSummary(data.summary);
      
      // Load custom speaker names if they exist
      if (data.speaker_names) {
        setCustomSpeakerNames(data.speaker_names);
      }

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
    // Check if transcript exists in either format
    const hasUtterances = meeting?.transcript && hasUtterancesFormat(meeting.transcript) && meeting.transcript.utterances.length > 0;
    const hasChunks = Array.isArray(meeting?.transcript) && meeting.transcript.length > 0;
    
    if (!hasUtterances && !hasChunks) {
      toast.error('No transcript available. Please transcribe the meeting first.');
      return;
    }

    setGeneratingSummary(true);
    
    console.log('%c[Meeting Detail] 🤖 GENERATING TITLE & SUMMARY', 'color: #7c3aed; font-weight: bold; font-size: 14px');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to generate title and summary');
        return;
      }

      // Extract text from transcript (support both formats)
      let transcriptText = '';
      if (hasUtterances && !Array.isArray(meeting.transcript)) {
        // Old format: utterances
        transcriptText = meeting.transcript.utterances
          .map(u => u.transcript)
          .join(' ');
      } else if (hasChunks && Array.isArray(meeting.transcript)) {
        // New format: chunks array
        transcriptText = meeting.transcript
          .map((chunk: any) => chunk.text)
          .join(' ');
      }
      
      console.log(`[Meeting Detail] 📄 Transcript length: ${transcriptText.length} characters`);

      // Generate title with configured AI provider (Ollama, OpenAI, Gemini, etc.)
      console.log('[Meeting Detail] 📝 Generating title...');
      const generatedTitle = await generateTitle(transcriptText);
      console.log(`[Meeting Detail] ✅ Title generated: "${generatedTitle}"`);

      // Generate summary with configured AI provider
      console.log('[Meeting Detail] 📊 Generating summary...');
      const generatedSummary = await generateSummary(transcriptText);
      console.log(`[Meeting Detail] ✅ Summary generated (${generatedSummary.length} chars)`);

      // Update meeting in database
      console.log('[Meeting Detail] 💾 Updating meeting in database...');
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          title: generatedTitle,
          summary: generatedSummary,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id);

      if (updateError) throw updateError;

      // Update local state
      setSummary(generatedSummary);
      setMeeting(prev => prev ? {
        ...prev,
        title: generatedTitle,
        summary: generatedSummary
      } : null);

      console.log('%c[Meeting Detail] 🎉 Title & Summary generated successfully!', 'color: #16a34a; font-weight: bold');
      toast.success('✨ Title and summary generated successfully!');

    } catch (error) {
      console.error('%c[Meeting Detail] ❌ Generation failed', 'color: #dc2626; font-weight: bold', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate title and summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Removed unused function

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Speaker editing functions
  const getSpeakerDisplayName = useCallback((originalSpeaker: string) => {
    return customSpeakerNames[originalSpeaker] || originalSpeaker;
  }, [customSpeakerNames]);

  const startEditingSpeaker = useCallback((speaker: string) => {
    setEditingSpeaker(speaker);
    setTempSpeakerName(getSpeakerDisplayName(speaker));
  }, [getSpeakerDisplayName]);

  const saveSpeakerName = useCallback(async () => {
    if (!editingSpeaker || !meeting) return;
    
    const newCustomNames = {
      ...customSpeakerNames,
      [editingSpeaker]: tempSpeakerName.trim() || editingSpeaker
    };
    
    setCustomSpeakerNames(newCustomNames);
    setEditingSpeaker(null);
    setTempSpeakerName('');
    
    // Save to database
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ speaker_names: newCustomNames })
        .eq('id', meeting.id);
      
      if (error) throw error;
      toast.success('Nom du locuteur mis à jour');
    } catch (error) {
      console.error('Error saving speaker name:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  }, [editingSpeaker, tempSpeakerName, customSpeakerNames, meeting]);

  const cancelEditingSpeaker = useCallback(() => {
    setEditingSpeaker(null);
    setTempSpeakerName('');
  }, []);

  // Audio availability functions
  const isAudioExpired = useCallback(() => {
    if (!meeting?.audio_expires_at) return false;
    return new Date() > new Date(meeting.audio_expires_at);
  }, [meeting?.audio_expires_at]);

  const getAudioExpirationInfo = useCallback(() => {
    if (!meeting?.audio_expires_at) return null;
    
    const expirationDate = new Date(meeting.audio_expires_at);
    const now = new Date();
    const timeLeft = expirationDate.getTime() - now.getTime();
    
    if (timeLeft <= 0) {
      return {
        expired: true,
        message: 'Audio file has been deleted for security (48h retention policy)',
        timeLeft: 0
      };
    }
    
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      expired: false,
      message: `Audio expires in ${hoursLeft}h ${minutesLeft}m`,
      timeLeft: hoursLeft,
      urgent: hoursLeft < 12
    };
  }, [meeting?.audio_expires_at]);

  const audioInfo = getAudioExpirationInfo();

  // Export functions
  const formatTranscriptForExport = useCallback(() => {
    if (!meeting) return [];
    
    // Handle new transcript format (array of segments)
    if (Array.isArray(meeting.transcript)) {
      return meeting.transcript.map((segment: any, index: number) => ({
        index: index + 1,
        speaker: getSpeakerDisplayName(segment.speaker || `Locuteur_${index + 1}`),
        text: segment.text || '',
        start: segment.start || 0,
        end: segment.end || 0,
        timestamp: segment.start ? `${Math.floor(segment.start)}s` : ''
      }));
    }
    
    // Handle old transcript format (utterances)
    if (meeting.transcript && hasUtterancesFormat(meeting.transcript)) {
      return meeting.transcript.utterances.map((utterance: any, index: number) => ({
        index: index + 1,
        speaker: getSpeakerDisplayName(`Locuteur_${utterance.speaker + 1}`),
        text: utterance.transcript || '',
        start: 0,
        end: 0,
        timestamp: ''
      }));
    }
    
    return [];
  }, [meeting, getSpeakerDisplayName]);

  const exportToPDF = useCallback(async () => {
    if (!meeting) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;
    
    // Header with logo and app branding
    doc.setFillColor(59, 130, 246); // Blue gradient start
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Antislash Talk', margin, 25);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Meeting Transcript & Summary', pageWidth - margin - 80, 25);
    
    yPosition = 60;
    doc.setTextColor(0, 0, 0);
    
    // Meeting info - avoid displaying prompts as titles
    const displayTitle = meeting.title && 
      !meeting.title.toLowerCase().includes('generate') && 
      !meeting.title.toLowerCase().includes('provide') && 
      !meeting.title.toLowerCase().includes('summary') &&
      meeting.title.length < 100
      ? meeting.title 
      : `Meeting - ${formatDate(meeting.created_at).split(' ')[0]}`;
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(displayTitle, margin, yPosition);
    yPosition += 15;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${formatDate(meeting.created_at)}`, margin, yPosition);
    yPosition += 8;
    
    if (meeting.duration) {
      doc.text(`Duration: ${formatDuration(meeting.duration)}`, margin, yPosition);
      yPosition += 8;
    }
    
    if (meeting.participant_count) {
      doc.text(`Participants: ${meeting.participant_count}`, margin, yPosition);
      yPosition += 15;
    } else {
      yPosition += 10;
    }
    
    doc.setTextColor(0, 0, 0);
    
    // Summary section - avoid displaying prompts as summary
    const displaySummary = meeting.summary && 
      !meeting.summary.toLowerCase().includes('provide') && 
      !meeting.summary.toLowerCase().includes('generate') &&
      !meeting.summary.toLowerCase().includes('summary') &&
      meeting.summary.length > 20
      ? meeting.summary 
      : null;
      
    if (displaySummary) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(displaySummary, pageWidth - 2 * margin);
      doc.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 5 + 15;
    }
    
    // Transcript section
    const transcriptData = formatTranscriptForExport();
    if (transcriptData.length > 0) {
      // Check if new page needed
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('TRANSCRIPT', margin, yPosition);
      yPosition += 15;
      
      transcriptData.forEach((segment) => {
        // Check if new page needed
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Speaker name
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        const speakerText = `${segment.speaker}${segment.timestamp ? ` (${segment.timestamp})` : ''}`;
        doc.text(speakerText, margin, yPosition);
        yPosition += 8;
        
        // Transcript text
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const textLines = doc.splitTextToSize(segment.text, pageWidth - 2 * margin);
        doc.text(textLines, margin, yPosition);
        yPosition += textLines.length * 5 + 10;
      });
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by Antislash Talk - Page ${i}/${pageCount}`, margin, pageHeight - 10);
    }
    
    doc.save(`${displayTitle.replace(/[^a-z0-9]/gi, '_')}_transcript.pdf`);
  }, [meeting, formatTranscriptForExport]);

  const exportToJSON = useCallback(() => {
    if (!meeting) return;
    
    const transcriptData = formatTranscriptForExport();
    const displayTitle = meeting.title && 
      !meeting.title.toLowerCase().includes('generate') && 
      !meeting.title.toLowerCase().includes('provide') && 
      !meeting.title.toLowerCase().includes('summary') &&
      meeting.title.length < 100
      ? meeting.title 
      : `Meeting - ${formatDate(meeting.created_at).split(' ')[0]}`;
      
    const exportData = {
      meta: {
        title: displayTitle,
        originalTitle: meeting.title,
        date: meeting.created_at,
        duration: meeting.duration,
        participantCount: meeting.participant_count,
        transcriptionProvider: meeting.transcription_provider,
        transcriptionModel: meeting.transcription_model,
        status: meeting.status,
        exportedAt: new Date().toISOString(),
        exportedBy: 'Antislash Talk'
      },
      summary: meeting.summary && 
        !meeting.summary.toLowerCase().includes('provide') && 
        !meeting.summary.toLowerCase().includes('generate') &&
        !meeting.summary.toLowerCase().includes('summary') &&
        meeting.summary.length > 20
        ? meeting.summary 
        : null,
      transcript: transcriptData,
      customSpeakerNames: customSpeakerNames
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayTitle.replace(/[^a-z0-9]/gi, '_')}_transcript.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [meeting, formatTranscriptForExport, customSpeakerNames]);

  const exportToCSV = useCallback(() => {
    if (!meeting) return;
    
    const transcriptData = formatTranscriptForExport();
    const displayTitle = meeting.title && 
      !meeting.title.toLowerCase().includes('generate') && 
      !meeting.title.toLowerCase().includes('provide') && 
      !meeting.title.toLowerCase().includes('summary') &&
      meeting.title.length < 100
      ? meeting.title 
      : `Meeting - ${formatDate(meeting.created_at).split(' ')[0]}`;
    
    // CSV Headers
    const headers = ['Index', 'Speaker', 'Timestamp', 'Start (s)', 'End (s)', 'Text'];
    
    // CSV Rows
    const rows = transcriptData.map(segment => [
      segment.index.toString(),
      `"${segment.speaker.replace(/"/g, '""')}"`,
      segment.timestamp,
      segment.start.toString(),
      segment.end.toString(),
      `"${segment.text.replace(/"/g, '""')}"`
    ]);
    
    // Clean summary for CSV
    const displaySummary = meeting.summary && 
      !meeting.summary.toLowerCase().includes('provide') && 
      !meeting.summary.toLowerCase().includes('generate') &&
      !meeting.summary.toLowerCase().includes('summary') &&
      meeting.summary.length > 20
      ? meeting.summary 
      : '';
    
    // Add metadata rows at the beginning
    const metaRows = [
      ['# Meeting Information'],
      ['Title', `"${displayTitle.replace(/"/g, '""')}"`],
      ['Date', meeting.created_at],
      ['Duration', meeting.duration?.toString() || ''],
      ['Participants', meeting.participant_count?.toString() || ''],
      ['Summary', `"${displaySummary.replace(/"/g, '""')}"`],
      [''],
      ['# Transcript Data'],
      headers
    ];
    
    const csvContent = [...metaRows, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayTitle.replace(/[^a-z0-9]/gi, '_')}_transcript.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [meeting, formatTranscriptForExport]);

    const exportToTXT = useCallback(() => {
    if (!meeting) return;
    
    const transcriptData = formatTranscriptForExport();
    const displayTitle = meeting.title && 
      !meeting.title.toLowerCase().includes('generate') && 
      !meeting.title.toLowerCase().includes('provide') && 
      !meeting.title.toLowerCase().includes('summary') &&
      meeting.title.length < 100
      ? meeting.title 
      : `Meeting - ${formatDate(meeting.created_at).split(' ')[0]}`;
    
    let content = `ANTISLASH TALK - MEETING TRANSCRIPT\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    content += `Title: ${displayTitle}\n`;
    content += `Date: ${formatDate(meeting.created_at)}\n`;
    if (meeting.duration) content += `Duration: ${formatDuration(meeting.duration)}\n`;
    if (meeting.participant_count) content += `Participants: ${meeting.participant_count}\n`;
    content += `\n`;
    
    const displaySummary = meeting.summary && 
      !meeting.summary.toLowerCase().includes('provide') && 
      !meeting.summary.toLowerCase().includes('generate') &&
      !meeting.summary.toLowerCase().includes('summary') &&
      meeting.summary.length > 20
      ? meeting.summary 
      : null;
      
    if (displaySummary) {
      content += `SUMMARY\n`;
      content += `${'-'.repeat(20)}\n`;
      content += `${displaySummary}\n\n`;
    }
    
    content += `TRANSCRIPT\n`;
    content += `${'-'.repeat(20)}\n\n`;
    
    transcriptData.forEach((segment) => {
      content += `[${segment.speaker}${segment.timestamp ? ` - ${segment.timestamp}` : ''}]\n`;
      content += `${segment.text}\n\n`;
    });
    
    content += `\n${'-'.repeat(50)}\n`;
    content += `Generated by Antislash Talk on ${new Date().toLocaleString()}\n`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayTitle.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [meeting, formatTranscriptForExport]);

  const handleExport = useCallback(async () => {
    if (!meeting) return;
    
    setIsExporting(true);
    try {
      switch (exportFormat) {
        case 'pdf':
          await exportToPDF();
          toast.success('PDF exported successfully!');
          break;
        case 'json':
          exportToJSON();
          toast.success('JSON exported successfully!');
          break;
        case 'csv':
          exportToCSV();
          toast.success('CSV exported successfully!');
          break;
        case 'txt':
          exportToTXT();
          toast.success('Text file exported successfully!');
          break;
      }
      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export file');
    } finally {
      setIsExporting(false);
    }
  }, [meeting, exportFormat, exportToPDF, exportToJSON, exportToCSV, exportToTXT]);

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
                  {!summary && meeting?.transcript && (
                    (hasUtterancesFormat(meeting.transcript) && meeting.transcript.utterances.length > 0) ||
                    (Array.isArray(meeting.transcript) && meeting.transcript.length > 0)
                  ) && (
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
                          Generate Title & Summary
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
              {(Array.isArray(meeting.transcript) && meeting.transcript.length > 0) ? (
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    Transcript ({meeting.transcript.length} segments)
                  </h2>
                  
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4">
                    {meeting.transcript.map((segment: any, index: number) => {
                      // Obtenir la couleur du locuteur de manière consistante
                      const speakerColors = [
                        'from-blue-500 to-indigo-600',
                        'from-green-500 to-emerald-600', 
                        'from-purple-500 to-pink-600',
                        'from-orange-500 to-red-600',
                        'from-cyan-500 to-blue-600',
                        'from-yellow-500 to-orange-600'
                      ];
                      
                      const speakerNumber = segment.speaker?.replace(/\D/g, '') || '1';
                      const colorIndex = (parseInt(speakerNumber) - 1) % speakerColors.length;
                      const speakerColor = speakerColors[colorIndex];
                      
                      return (
                        <div key={index} className="group flex items-start gap-4 p-6 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-700/30 dark:to-gray-600/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30 hover:shadow-lg transition-all duration-300">
                          <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${speakerColor} flex items-center justify-center text-white shadow-lg`}>
                              <User className="w-6 h-6" />
                            </div>
                            {segment.start !== undefined && (
                              <div className="text-[10px] text-center text-gray-500 dark:text-gray-400 mt-1">
                                {Math.floor(segment.start)}s
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              {editingSpeaker === segment.speaker ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={tempSpeakerName}
                                    onChange={(e) => setTempSpeakerName(e.target.value)}
                                    className="text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 min-w-[120px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveSpeakerName();
                                      if (e.key === 'Escape') cancelEditingSpeaker();
                                    }}
                                  />
                                  <button
                                    onClick={saveSpeakerName}
                                    className="p-1 text-green-600 hover:text-green-700"
                                    title="Sauvegarder"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={cancelEditingSpeaker}
                                    className="p-1 text-red-600 hover:text-red-700"
                                    title="Annuler"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditingSpeaker(segment.speaker)}
                                  className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 group/edit"
                                  title="Cliquer pour éditer le nom"
                                >
                                  <span>{getSpeakerDisplayName(segment.speaker || `Locuteur ${speakerNumber}`)}</span>
                                  <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                                </button>
                              )}
                              {segment.start !== undefined && segment.end !== undefined && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-full">
                                  {Math.floor(segment.start)}s - {Math.floor(segment.end)}s
                                </span>
                              )}
                            </div>
                            <p className="text-gray-900 dark:text-white leading-relaxed text-base">
                              {segment.text}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(segment.text)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : meeting.transcript && hasUtterancesFormat(meeting.transcript) && meeting.transcript.utterances.length > 0 ? (
                // Fallback pour l'ancien format
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    Transcript
                  </h2>
                  
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4">
                    {meeting.transcript.utterances.map((utterance: any, index: number) => (
                      <div key={index} className="group flex items-start gap-4 p-6 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-700/30 dark:to-gray-600/30 rounded-2xl border border-gray-200/30 dark:border-gray-600/30 hover:shadow-lg transition-all duration-300">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                            <User className="w-6 h-6" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            {editingSpeaker === `Locuteur_${utterance.speaker + 1}` ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={tempSpeakerName}
                                  onChange={(e) => setTempSpeakerName(e.target.value)}
                                  className="text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 min-w-[120px]"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveSpeakerName();
                                    if (e.key === 'Escape') cancelEditingSpeaker();
                                  }}
                                />
                                <button
                                  onClick={saveSpeakerName}
                                  className="p-1 text-green-600 hover:text-green-700"
                                  title="Sauvegarder"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditingSpeaker}
                                  className="p-1 text-red-600 hover:text-red-700"
                                  title="Annuler"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditingSpeaker(`Locuteur_${utterance.speaker + 1}`)}
                                className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 group/edit"
                                title="Cliquer pour éditer le nom"
                              >
                                <span>{getSpeakerDisplayName(`Locuteur_${utterance.speaker + 1}`)}</span>
                                <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
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
              ) : (
                // Affichage par défaut quand il n'y a pas de transcript
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-3 shadow-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    Transcript
                  </h2>
                  
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                      <FileText className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-lg font-medium">Transcript en cours de traitement...</p>
                    <p className="text-sm mt-2">
                      {meeting.status === 'pending' ? 'La transcription est en cours.' : 
                       meeting.status === 'processing' ? 'Analyse en cours avec l\'IA...' : 
                       'Aucun transcript disponible pour ce meeting.'}
                    </p>
                    {meeting.status === 'processing' && (
                      <div className="mt-4 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                    
                    {/* 🚀 BOUTON POUR LANCER LA TRANSCRIPTION MANUELLEMENT */}
                    {(meeting.status === 'pending' || !meeting.transcript || (Array.isArray(meeting.transcript) && meeting.transcript.length === 0)) && meeting.recording_url && (
                      <button
                        onClick={async () => {
                          try {
                            toast('🚀 Starting transcription...', { duration: 2000 });
                            const { data: { session } } = await supabase.auth.getSession();
                            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                            const response = await fetch(`${supabaseUrl}/functions/v1/start-transcription`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session?.access_token}`,
                              },
                              body: JSON.stringify({
                                meeting_id: id
                              })
                            });

                            if (!response.ok) {
                              throw new Error(`HTTP error! status: ${response.status}`);
                            }

                            toast.success('✅ Transcription started! Please refresh in a few moments.');
                            setTimeout(() => window.location.reload(), 2000);
                          } catch (error) {
                            console.error('❌ Failed to start transcription:', error);
                            toast.error('Failed to start transcription. Please try again.');
                          }
                        }}
                        className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        🚀 Start Transcription
                      </button>
                    )}
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
                  <Button 
                    onClick={() => setShowExportModal(true)}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                    disabled={!meeting.transcript || (!Array.isArray(meeting.transcript) && !hasUtterancesFormat(meeting.transcript))}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export Transcript
                  </Button>
                  
                  {/* Audio download section with expiration info */}
                  {meeting.recording_url && (
                    <div className="space-y-2">
                      {audioInfo && (
                        <div className={`p-3 rounded-lg text-sm ${
                          audioInfo.expired 
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                            : audioInfo.urgent
                            ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                            : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                        }`}>
                          <div className="flex items-center gap-2">
                            {audioInfo.expired ? (
                              <>
                                <X className="w-4 h-4" />
                                <span className="font-medium">Audio no longer available</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4" />
                                <span>{audioInfo.message}</span>
                              </>
                            )}
                          </div>
                          {!audioInfo.expired && (
                            <p className="text-xs mt-1 opacity-80">
                              Audio files are automatically deleted after 48 hours for security
                            </p>
                          )}
                        </div>
                      )}
                      
                    <Button 
                      onClick={() => window.open(meeting.recording_url!, '_blank')}
                        variant="outline"
                        disabled={isAudioExpired()}
                        className={`w-full shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 ${
                          isAudioExpired()
                            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500/10 to-emerald-600/10 hover:from-green-500/20 hover:to-emerald-600/20 border-green-500/30 text-green-700 dark:text-green-400'
                        }`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                        {isAudioExpired() ? 'Audio Expired' : 'Download Audio'}
                    </Button>
                    </div>
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
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
              <h3 className="text-xl font-bold text-white mb-2">Export Transcript</h3>
              <p className="text-blue-100 text-sm">Choose your preferred export format</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-3 mb-6">
                {[
                  { 
                    value: 'pdf' as const, 
                    label: 'PDF Professional', 
                    description: 'Formatted document with app branding',
                    icon: FileType,
                    gradient: 'from-red-500 to-pink-600'
                  },
                  { 
                    value: 'json' as const, 
                    label: 'JSON Structured', 
                    description: 'Developer-friendly with metadata',
                    icon: Code,
                    gradient: 'from-yellow-500 to-orange-600'
                  },
                  { 
                    value: 'csv' as const, 
                    label: 'CSV Spreadsheet', 
                    description: 'Import into Excel or Google Sheets',
                    icon: Table,
                    gradient: 'from-green-500 to-emerald-600'
                  },
                  { 
                    value: 'txt' as const, 
                    label: 'Plain Text', 
                    description: 'Simple format, compatible everywhere',
                    icon: FileText,
                    gradient: 'from-gray-500 to-slate-600'
                  }
                ].map((format) => {
                  const IconComponent = format.icon;
                  return (
                    <label 
                      key={format.value} 
                      className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        exportFormat === format.value 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value={format.value} 
                        checked={exportFormat === format.value}
                        onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${format.gradient} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{format.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{format.description}</p>
                      </div>
                      {exportFormat === format.value && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowExportModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-2" />
                      Export
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}