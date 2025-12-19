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
    
    // 🔧 Cleanup any existing wavesurfer instance first
    if (wavesurfer.current) {
      wavesurfer.current.destroy();
      wavesurfer.current = null;
    }

    // 🔧 Close any existing AudioContext to free resources on mobile
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        console.log('[Waveform] 🧹 Previous AudioContext closed');
      }).catch(err => {
        console.warn('[Waveform] ⚠️ Could not close AudioContext:', err);
      });
    }

    // Initialize fresh AudioContext
    audioContextRef.current = new AudioContext();
    console.log('[Waveform] 🎵 New AudioContext created:', audioContextRef.current.state);

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
        console.log('[Waveform] ✅ Audio ready, duration:', wavesurfer.current.getDuration());
      }
    });

    wavesurfer.current.on('play', () => {
        setIsPlaying(true);
        console.log('[Waveform] ▶️ Playback started');
    });

    wavesurfer.current.on('pause', () => {
        setIsPlaying(false);
        console.log('[Waveform] ⏸️ Playback paused');
    });

    wavesurfer.current.on('audioprocess', (time) => {
        setCurrentTime(time);
    });

    wavesurfer.current.on('error', (err) => {
      console.error('[Waveform] ❌ Error loading audio:', err);
    });

    return () => {
      console.log('[Waveform] 🧹 Cleanup: destroying wavesurfer and closing AudioContext');
      wavesurfer.current?.destroy();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  const handlePlay = async () => {
    if (!wavesurfer.current) {
      console.warn('[Waveform] ⚠️ Cannot play: wavesurfer not initialized');
      return;
    }

    try {
      // 🔧 Resume AudioContext if suspended (common on mobile)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('[Waveform] 🔄 Resuming suspended AudioContext...');
        await audioContextRef.current.resume();
        console.log('[Waveform] ✅ AudioContext resumed:', audioContextRef.current.state);
      }

      // 🎵 Start playback
      await wavesurfer.current.play();
      console.log('[Waveform] ▶️ Playback started successfully');
    } catch (error) {
      console.error('[Waveform] ❌ Failed to start playback:', error);
      
      // 🔧 Try recreating AudioContext on mobile if it failed
      if (audioContextRef.current && audioContextRef.current.state === 'closed') {
        console.log('[Waveform] 🔄 Recreating AudioContext after failure...');
        audioContextRef.current = new AudioContext();
        try {
          await wavesurfer.current.play();
        } catch (retryError) {
          console.error('[Waveform] ❌ Retry failed:', retryError);
        }
      }
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