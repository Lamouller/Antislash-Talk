import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Mock matchMedia (jsdom doesn't implement it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock MediaRecorder (jsdom doesn't have it)
class MockMediaRecorder {
  state = 'inactive';
  stream: MediaStream;
  options?: MediaRecorderOptions;
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
  }

  start(_timeslice?: number) {
    this.state = 'recording';
    this.onstart?.();
  }

  stop() {
    this.state = 'inactive';
    // Simulate ondataavailable with empty blob before onstop
    if (this.ondataavailable) {
      const evt = { data: new Blob([], { type: 'audio/webm' }) } as BlobEvent;
      this.ondataavailable(evt);
    }
    this.onstop?.();
  }

  pause() {
    this.state = 'paused';
    this.onpause?.();
  }

  resume() {
    this.state = 'recording';
    this.onresume?.();
  }

  requestData() {}

  static isTypeSupported = vi.fn(() => true);
}

// @ts-expect-error - mock replacing browser API
global.MediaRecorder = MockMediaRecorder;

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn(), kind: 'audio', label: 'mock-mic', onended: null, onmute: null, onunmute: null }],
      getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    ondevicechange: null,
  },
});
