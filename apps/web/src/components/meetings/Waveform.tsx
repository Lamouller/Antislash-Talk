import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';
import { formatTime } from '../../lib/utils';

interface WaveformProps {
  audioUrl: string | null | undefined;
}

const Waveform: React.FC<WaveformProps> = ({ 
  audioUrl,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;
    
    // Initialize AudioContext on the client side
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#A8A8A8',
      progressColor: '#6E41E2',
      url: audioUrl,
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      height: 100,
      cursorWidth: 1,
      cursorColor: '#6E41E2',
    });

    wavesurfer.current.on('ready', () => {
      if (wavesurfer.current) {
        setDuration(wavesurfer.current.getDuration());
      }
    });

    wavesurfer.current.on('play', () => {
        setIsPlaying(true);
    });

    wavesurfer.current.on('pause', () => {
        setIsPlaying(false);
    });

    wavesurfer.current.on('audioprocess', (time) => {
        setCurrentTime(time);
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [audioUrl]);

  const handlePlay = async () => {
    if (wavesurfer.current && audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      await wavesurfer.current.play();
    }
  };

  const handlePause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.pause();
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div ref={waveformRef} className="mb-4" />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Play size={20} />
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Pause size={20} />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};

export default Waveform; 