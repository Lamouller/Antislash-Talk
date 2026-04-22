import { describe, it, expect, vi } from 'vitest';
import { getVisibilityResumeDelayMs, getPlatform, isNative } from '../platform';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('platform', () => {
  it('defaults to web on non-capacitor env', () => {
    expect(getPlatform()).toBe('web');
  });

  it('returns 500ms for web platform', () => {
    expect(getVisibilityResumeDelayMs()).toBe(500);
  });

  it('isNative returns false on web', () => {
    expect(isNative()).toBe(false);
  });

  it('returns 1500ms for android platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.getPlatform).mockReturnValueOnce('android');
    expect(getVisibilityResumeDelayMs()).toBe(1500);
  });

  it('returns 500ms for ios platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.getPlatform).mockReturnValueOnce('ios');
    expect(getVisibilityResumeDelayMs()).toBe(500);
  });
});
