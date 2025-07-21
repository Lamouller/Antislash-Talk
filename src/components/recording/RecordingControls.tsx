import { Mic, Square, Pause } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export default function RecordingControls({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordingControlsProps) {
  if (!isRecording) {
    return (
      <button onClick={onStart} className="start-button">
        <Mic size={32} />
      </button>
    );
  }

  return (
    <div className="controls-container">
      <button onClick={isPaused ? onResume : onPause} className="pause-button">
        {isPaused ? <Mic size={24} /> : <Pause size={24} />}
      </button>
      <button onClick={onStop} className="stop-button">
        <Square size={24} />
      </button>
    </div>
  );
}