/**
 * useMicRouteWatcher.ts — Monitore les changements de route audio
 * (plug/unplug AirPods, casque BT, micro USB-C) pendant un recording actif.
 *
 * Phase 12.5 — gated par feature flag `micRouteHandling`.
 * Si le flag est OFF : aucune subscription, aucun side effect.
 *
 * Support : iOS Safari 16+, Android Chrome, Desktop Chrome/Firefox.
 * Fallback silencieux si navigator.mediaDevices.addEventListener non disponible.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  enumerateMicDevices,
  getActiveDeviceId,
  devicesChanged,
  type MicDevice,
} from '../lib/mediaDevices';
import { readEnvFlags, resolveFlag } from '../lib/featureFlags';

export interface MicRouteChange {
  /** deviceId de la piste audio active au moment du changement */
  previousDeviceId: string | null;
  /** deviceId du nouveau device par défaut après le changement */
  newDefaultDeviceId: string | null;
  /** Liste complète des devices après le changement */
  newDevices: MicDevice[];
  /** Timestamp Unix (ms) du changement détecté */
  at: number;
}

export interface UseMicRouteWatcherOptions {
  /** Stream actif du recording (obtenu via getActiveMediaStream du recorder) */
  activeStream: MediaStream | null;
  /** true si un recording est en cours */
  isRecording: boolean;
  /** Callback appelé à chaque changement détecté pendant un recording */
  onRouteChange?: (change: MicRouteChange) => void;
}

export interface UseMicRouteWatcherResult {
  /** Liste courante des devices audio disponibles */
  devices: MicDevice[];
  /** Dernier changement détecté (null si aucun depuis le montage) */
  lastChange: MicRouteChange | null;
  /** Rafraichit manuellement la liste des devices */
  refresh: () => Promise<void>;
}

export function useMicRouteWatcher(
  options: UseMicRouteWatcherOptions
): UseMicRouteWatcherResult {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [lastChange, setLastChange] = useState<MicRouteChange | null>(null);

  // Ref pour comparaison sans déclencher de re-render
  const devicesRef = useRef<MicDevice[]>([]);
  // Stable ref sur le callback pour éviter les stale closures dans le handler
  const callbackRef = useRef(options.onRouteChange);
  callbackRef.current = options.onRouteChange;

  // Stable ref sur les options variables utilisées dans refresh
  const activeStreamRef = useRef(options.activeStream);
  activeStreamRef.current = options.activeStream;
  const isRecordingRef = useRef(options.isRecording);
  isRecordingRef.current = options.isRecording;

  const refresh = useCallback(async () => {
    const next = await enumerateMicDevices();

    if (devicesChanged(devicesRef.current, next)) {
      devicesRef.current = next;
      setDevices(next);

      // Ne notifier que pendant un recording actif
      if (isRecordingRef.current) {
        const change: MicRouteChange = {
          previousDeviceId: getActiveDeviceId(activeStreamRef.current),
          newDefaultDeviceId: next.find(d => d.isDefault)?.deviceId ?? null,
          newDevices: next,
          at: Date.now(),
        };
        setLastChange(change);
        callbackRef.current?.(change);
      }
    } else {
      // Pas de changement structurel — mettre à jour la ref sans re-render
      devicesRef.current = next;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stable : toutes les dépendances variables passent par des refs

  useEffect(() => {
    const envFlags = readEnvFlags();
    const flagEnabled = resolveFlag('micRouteHandling', { envFlags }).value;

    // Flag OFF → aucune subscription, comportement identique à avant la phase 12.5
    if (!flagEnabled) return;

    // Chargement initial de la liste
    refresh();

    // devicechange : iOS Safari 16+, Android Chrome, Desktop Chrome/Firefox
    // Fallback silencieux via optional chaining si l'API est absente
    const handler = () => {
      refresh();
    };

    (navigator.mediaDevices as EventTarget | undefined)?.addEventListener?.(
      'devicechange',
      handler
    );

    return () => {
      (navigator.mediaDevices as EventTarget | undefined)?.removeEventListener?.(
        'devicechange',
        handler
      );
    };
  }, [refresh]);

  return { devices, lastChange, refresh };
}
