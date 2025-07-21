import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import toast from 'react-hot-toast';

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

export default function MeetingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [participantName, setParticipantName] = useState('');

  const fetchMeeting = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('meetings')
      .select('*, participants(*)')
      .eq('id', id)
      .order('id', { foreignTable: 'participants', ascending: true })
      .single();

    if (error) {
      console.error('Error fetching meeting:', error);
      toast.error('Failed to fetch meeting details.');
      setMeeting(null);
    } else {
      const fetchedMeeting = data as MeetingData;

      if (fetchedMeeting.transcript) {
        const speakerIndices = [
          ...new Set(fetchedMeeting.transcript.utterances.map((u) => u.speaker)),
        ];

        const maxSpeakerIndex = speakerIndices.length > 0 ? Math.max(...speakerIndices) : -1;
        const requiredParticipants = maxSpeakerIndex + 1;

        if (fetchedMeeting.participants.length < requiredParticipants) {
          const newParticipants = Array.from(
            { length: requiredParticipants - fetchedMeeting.participants.length },
            () => ({
              meeting_id: fetchedMeeting.id,
              name: null,
            })
          );

          const { error: insertError } = await supabase
            .from('participants')
            .insert(newParticipants);

          if (insertError) {
            console.error('Error creating missing participants:', insertError);
            toast.error('Error creating missing participants.');
          } else {
            // Re-fetch after creating participants
            fetchMeeting();
            return;
          }
        }
      }

      setMeeting(fetchedMeeting);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  const handleSaveParticipantName = async (participantId: number) => {
    if (!participantName.trim()) {
      toast.error("Participant name can't be empty.");
      return;
    }

    const { error } = await supabase
      .from('participants')
      .update({ name: participantName })
      .eq('id', participantId);

    if (error) {
      console.error('Error updating participant name:', error);
      toast.error('Failed to update participant name.');
    } else {
      toast.success('Participant name updated successfully.');
      if (meeting) {
        const updatedParticipants = meeting.participants.map((p) =>
          p.id === participantId ? { ...p, name: participantName } : p
        );
        setMeeting({ ...meeting, participants: updatedParticipants });
      }
      setEditingParticipantId(null);
      setParticipantName('');
    }
  };

  const generateSummary = async () => {
    if (!meeting || !meeting.transcript) return;

    setGeneratingSummary(true);

    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: meeting.transcript.utterances.map((u) => ({
            speaker:
              meeting.participants.find((_, index) => index === u.speaker)?.name ||
              `Speaker ${u.speaker}`,
            text: u.transcript,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary.');
      }

      const data = await response.json();
      setSummary(data.summary);
      toast.success('Summary generated successfully.');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error generating summary:', error);
        toast.error(error.message);
      }
    } finally {
      setGeneratingSummary(false);
    }
  };

  const deleteMeeting = async () => {
    if (!id) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting.');
    } else {
      toast.success('Meeting deleted successfully.');
      navigate('/meetings');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Loading...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Meeting not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{meeting.title || 'Meeting Details'}</h1>
      <div className="mb-4 flex space-x-4 text-sm text-gray-500">
        {meeting.transcription_provider && (
          <p>
            <strong>Provider:</strong> {meeting.transcription_provider}
          </p>
        )}
        {meeting.transcription_model && (
          <p>
            <strong>Model:</strong> {meeting.transcription_model}
          </p>
        )}
        {meeting.participant_count && (
          <p>
            <strong>Participants:</strong> {meeting.participant_count}
          </p>
        )}
      </div>

      {meeting.participants && meeting.participants.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-xl font-bold p-4">Speakers</h2>
          <div className="p-4">
            <ul>
              {meeting.participants.map((participant, index) => (
                <li key={participant.id} className="flex items-center justify-between py-2">
                  {editingParticipantId === participant.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={participantName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setParticipantName(e.target.value)
                        }
                        placeholder={`Speaker ${index}`}
                        className="flex-grow p-2 border rounded"
                      />
                      <Button onClick={() => handleSaveParticipantName(participant.id)}>Save</Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingParticipantId(null);
                          setParticipantName('');
                        }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-grow">{participant.name || `Speaker ${index}`}</span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingParticipantId(participant.id);
                          setParticipantName(participant.name || '');
                        }}>
                        Edit
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {summary && (
        <Card className="mb-4">
          <h2 className="text-xl font-bold p-4">Summary</h2>
          <div className="p-4">
            <p>{summary}</p>
          </div>
        </Card>
      )}

      {!summary && meeting.transcript && (
        <Button onClick={generateSummary} disabled={generatingSummary} className="mb-4">
          {generatingSummary ? 'Generating...' : 'Generate Summary'}
        </Button>
      )}

      <Card>
        <h2 className="text-xl font-bold p-4">Transcript</h2>
        <div className="p-4">
          <div className="space-y-4">
            {meeting.transcript?.utterances.map((utterance, index) => (
              <div key={index} className="flex flex-col">
                <p className="font-semibold">
                  {meeting.participants.find((_, i) => i === utterance.speaker)?.name ||
                    `Speaker ${utterance.speaker}`}
                </p>
                <p>{utterance.transcript}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex gap-2 mt-4">
        <Button variant="danger" onClick={deleteMeeting}>
          Delete Meeting
        </Button>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    </div>
  );
}