import { describe, it, expect, vi } from 'vitest';
import {
  enumerateMicDevices,
  getActiveDeviceId,
  devicesChanged,
  type MicDevice,
} from '../mediaDevices';

// ---------------------------------------------------------------------------
// enumerateMicDevices
// ---------------------------------------------------------------------------

describe('enumerateMicDevices', () => {
  it('returns only audioinput devices', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
      { deviceId: 'mic1', kind: 'audioinput', label: 'Mic 1', groupId: 'g1', toJSON: () => ({}) },
      { deviceId: 'cam1', kind: 'videoinput', label: 'Cam', groupId: 'g2', toJSON: () => ({}) },
    ] as MediaDeviceInfo[]);
    const mics = await enumerateMicDevices();
    expect(mics).toHaveLength(1);
    expect(mics[0].deviceId).toBe('mic1');
  });

  it('handles empty list', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([]);
    expect(await enumerateMicDevices()).toEqual([]);
  });

  it('handles enumerate error (e.g. permission denied)', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockRejectedValue(
      new Error('denied')
    );
    expect(await enumerateMicDevices()).toEqual([]);
  });

  it('falls back to "Microphone N" when label is empty', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
      { deviceId: 'mic1', kind: 'audioinput', label: '', groupId: 'g1', toJSON: () => ({}) },
    ] as MediaDeviceInfo[]);
    const mics = await enumerateMicDevices();
    expect(mics[0].label).toBe('Microphone 1');
  });

  it('marks first device as default when no device has id "default"', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
      { deviceId: 'mic-a', kind: 'audioinput', label: 'Mic A', groupId: 'g1', toJSON: () => ({}) },
      { deviceId: 'mic-b', kind: 'audioinput', label: 'Mic B', groupId: 'g2', toJSON: () => ({}) },
    ] as MediaDeviceInfo[]);
    const mics = await enumerateMicDevices();
    expect(mics[0].isDefault).toBe(true);
    expect(mics[1].isDefault).toBe(false);
  });

  it('marks device with deviceId "default" as default', async () => {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
      { deviceId: 'mic-a', kind: 'audioinput', label: 'Mic A', groupId: 'g1', toJSON: () => ({}) },
      { deviceId: 'default', kind: 'audioinput', label: 'Default Mic', groupId: 'g2', toJSON: () => ({}) },
    ] as MediaDeviceInfo[]);
    const mics = await enumerateMicDevices();
    const def = mics.find(m => m.deviceId === 'default');
    expect(def?.isDefault).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getActiveDeviceId
// ---------------------------------------------------------------------------

describe('getActiveDeviceId', () => {
  it('returns null for null stream', () => {
    expect(getActiveDeviceId(null)).toBe(null);
  });

  it('returns deviceId from track settings', () => {
    const fakeStream = {
      getAudioTracks: () => [{ getSettings: () => ({ deviceId: 'bt-headset' }) }],
    } as unknown as MediaStream;
    expect(getActiveDeviceId(fakeStream)).toBe('bt-headset');
  });

  it('returns null if no audio track', () => {
    const fakeStream = { getAudioTracks: () => [] } as unknown as MediaStream;
    expect(getActiveDeviceId(fakeStream)).toBe(null);
  });

  it('returns null when getSettings does not include deviceId', () => {
    const fakeStream = {
      getAudioTracks: () => [{ getSettings: () => ({}) }],
    } as unknown as MediaStream;
    expect(getActiveDeviceId(fakeStream)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// devicesChanged
// ---------------------------------------------------------------------------

describe('devicesChanged', () => {
  const mic = (id: string, isDefault = false): MicDevice => ({
    deviceId: id,
    label: id,
    groupId: 'g',
    isDefault,
  });

  it('returns false when lists are identical', () => {
    expect(devicesChanged([mic('a'), mic('b')], [mic('a'), mic('b')])).toBe(false);
  });

  it('returns true when device added', () => {
    expect(devicesChanged([mic('a')], [mic('a'), mic('b')])).toBe(true);
  });

  it('returns true when device removed', () => {
    expect(devicesChanged([mic('a'), mic('b')], [mic('a')])).toBe(true);
  });

  it('returns true when default changes', () => {
    expect(
      devicesChanged(
        [mic('a', true), mic('b')],
        [mic('a'), mic('b', true)]
      )
    ).toBe(true);
  });

  it('returns false for two empty lists', () => {
    expect(devicesChanged([], [])).toBe(false);
  });

  it('returns true when deviceId is replaced (same count, different id)', () => {
    expect(devicesChanged([mic('a'), mic('b')], [mic('a'), mic('c')])).toBe(true);
  });
});
