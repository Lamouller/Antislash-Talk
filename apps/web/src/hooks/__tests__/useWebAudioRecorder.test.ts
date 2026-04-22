import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
    expect(result.current).toHaveProperty('audioUrl');
  });

  it('initial state is idle', () => {
    const { result } = renderHook(() => useWebAudioRecorder());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.audioUrl).toBeNull();
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

describe('useWebAudioRecorder - manual pause does not auto-resume (phase 3)', () => {
  it('stays paused after manual pause even after polling delay elapses', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWebAudioRecorder());

    // Start recording
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    // Manual pause
    act(() => {
      result.current.pauseRecording();
    });
    expect(result.current.isPaused).toBe(true);

    // Advance well past the 2s polling interval and the 1500ms visibility delay
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Must still be paused — auto-resume should NOT have fired
    expect(result.current.isPaused).toBe(true);

    vi.useRealTimers();
  });
});

describe('useWebAudioRecorder - audioUrl blob URL lifecycle (phase 2)', () => {
  it('creates an audioUrl when audioBlob is set and revokes it on unmount', async () => {
    const fakeUrl = 'blob:http://localhost/fake-1234';
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useWebAudioRecorder());

    // Start and stop recording to produce an audioBlob via onstop
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
    });

    // audioUrl should have been created
    expect(createSpy).toHaveBeenCalled();
    expect(result.current.audioUrl).toBe(fakeUrl);

    // Unmount → cleanup should revoke the URL
    unmount();
    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl);
  });
});
