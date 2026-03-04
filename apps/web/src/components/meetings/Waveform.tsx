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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;
    
    console.log('[Waveform] 🎵 Initializing audio player for:', audioUrl);
    
    // 🔧 Cleanup any existing wavesurfer instance first
    if (wavesurfer.current) {
      console.log('[Waveform] 🧹 Destroying previous wavesurfer instance');
      wavesurfer.current.destroy();
      wavesurfer.current = null;
    }

    // Let WaveSurfer create and manage its own AudioContext
    // (more reliable on mobile than manually managing it)
    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#A8A8A8',
      progressColor: '#000',
      url: audioUrl,
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      height: 100,
      cursorWidth: 1,
      cursorColor: '#000',
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
      console.log('[Waveform] 🧹 Cleanup: destroying wavesurfer');
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioUrl]);

  const handlePlay = async () => {
    if (!wavesurfer.current) {
      console.warn('[Waveform] ⚠️ Cannot play: wavesurfer not initialized');
      return;
    }

    try {
      console.log('[Waveform] 🎵 Attempting to play audio...');
      await wavesurfer.current.play();
      console.log('[Waveform] ✅ Playback started successfully');
    } catch (error) {
      console.error('[Waveform] ❌ Failed to start playback:', error);
      // WaveSurfer will handle AudioContext internally
    }
  };

  const handlePause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.pause();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-100">
      <div ref={waveformRef} className="mb-4" />
      
      {/* 🔧 Fallback HTML5 audio player for iOS/Safari (WebM not supported) */}
      {audioUrl && (
        <audio 
          controls 
          className="w-full mb-4"
          preload="metadata"
          style={{ display: 'block' }}
        >
          <source src={audioUrl} type="audio/webm" />
          <source src={audioUrl} type="audio/mp4" />
          <source src={audioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              className="p-3 bg-black text-white rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <Play size={20} />
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="p-3 bg-black text-white rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <Pause size={20} />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Info message for iOS users */}
      <p className="text-xs text-gray-500 mt-2">
        Si la waveform ne fonctionne pas, utilisez le lecteur HTML5 ci-dessus
      </p>
    </div>
  );
};

export default Waveform; 