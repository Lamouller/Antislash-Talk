import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useWebAudioRecorder } from '../useWebAudioRecorder';

describe('useWebAudioRecorder - baseline API', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => useWebAudioRecorder());
    expect(result.current).toHaveProperty('isRecording');
    expect(result.current).toHaveProperty('isPaused');
    expect(result.current).toHaveProperty('startRecording');
    expect(result.current).toHaveProperty('stopRecording');
    expect(result.current).toHaveProperty('pauseRecording');
    expect(result.current).toHaveProperty('resumeRecording');
    expect(result.current).toHaveProperty('resetRecorder');
    expect(result.current).toHaveProperty('duration');
    expect(result.current).toHaveProperty('audioBlob');
  });

  it('initial state is idle', () => {
    const { result } = renderHook(() => useWebAudioRecorder());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.audioBlob).toBeNull();
  });

  it('startRecording transitions to recording', async () => {
    const { result } = renderHook(() => useWebAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    expect(result.current.isPaused).toBe(false);
  });
});
