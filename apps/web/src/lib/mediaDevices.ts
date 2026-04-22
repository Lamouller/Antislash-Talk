/**
 * mediaDevices.ts — Helpers purs pour l'enumération et la détection
 * de changements de route audio (phase 12.5).
 *
 * Pas d'état React, pas d'effets de bord : fonctions testables en isolation.
 */

export interface MicDevice {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault: boolean;
}

/**
 * Enumerate audio input devices. Labels disponibles uniquement après getUserMedia.
 * Retourne un tableau vide en cas d'erreur (permission refusée, API absente).
 */
export async function enumerateMicDevices(): Promise<MicDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    return mics.map((d, idx) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone ${idx + 1}`,
      groupId: d.groupId,
      isDefault: d.deviceId === 'default' || idx === 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Récupère le deviceId réellement utilisé par un MediaStream (via getSettings).
 * Retourne null si le stream est null ou n'a pas de piste audio.
 */
export function getActiveDeviceId(stream: MediaStream | null): string | null {
  if (!stream) return null;
  const track = stream.getAudioTracks()[0];
  if (!track) return null;
  return track.getSettings().deviceId ?? null;
}

/**
 * Compare 2 listes de devices et retourne true si la liste a changé
 * (device ajoutée, retirée, ou deviceId default différent).
 */
export function devicesChanged(prev: MicDevice[], next: MicDevice[]): boolean {
  if (prev.length !== next.length) return true;
  const prevIds = new Set(prev.map(d => d.deviceId));
  for (const d of next) {
    if (!prevIds.has(d.deviceId)) return true;
  }
  const prevDefault = prev.find(d => d.isDefault)?.deviceId;
  const nextDefault = next.find(d => d.isDefault)?.deviceId;
  return prevDefault !== nextDefault;
}
