import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, ReactNode,
} from 'react';
import { Audio } from 'expo-av';
/** Gap between beeps in ms */
const BEEP_INTERVAL_MS = 1000;

const ALERT_SOUND = require('@/assets/soud/alert.mp3');

interface RidesContextType {
  newRidesCount: number;
  setNewRidesCount: React.Dispatch<React.SetStateAction<number>>;
  clearBadge: () => void;
  isSoundPlaying: boolean;
  startAlertSound: () => void;
  stopAlertSound: () => void;
}

const RidesContext = createContext<RidesContextType | undefined>(undefined);

export function RidesProvider({ children }: { children: ReactNode }) {
  const [newRidesCount, setNewRidesCount] = useState(0);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  const soundRef  = useRef<Audio.Sound | null>(null);
  const activeRef = useRef(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBadge = useCallback(() => setNewRidesCount(0), []);

  const _clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Configure audio mode once ──────────────────────────────────────────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch((e) => console.warn('[Beep] setAudioMode:', e));
  }, []);

  // ── Create / re-create sound instance ─────────────────────────────────────
  const _loadSound = useCallback(async (): Promise<Audio.Sound | null> => {
    try {
      const { sound, status } = await Audio.Sound.createAsync(
        ALERT_SOUND,
        { shouldPlay: false, volume: 1.0, isLooping: false }
      );
      if ((status as any).isLoaded) return sound;
      await sound.unloadAsync();
    } catch (e) {
      console.warn('[Beep] createAsync failed:', e);
    }
    return null;
  }, []);

  // ── Play one beep, then schedule next ─────────────────────────────────────
  const _beep = useCallback(async () => {
    if (!activeRef.current) return;

    // Ensure we have a sound object
    if (!soundRef.current) {
      soundRef.current = await _loadSound();
    }

    if (soundRef.current && activeRef.current) {
      try {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      } catch (e) {
        console.warn('[Beep] play error:', e);
        // Unload stale reference; next cycle will reload
        try { await soundRef.current.unloadAsync(); } catch { /* ignore */ }
        soundRef.current = null;
      }
    }

    if (activeRef.current) {
      timerRef.current = setTimeout(_beep, BEEP_INTERVAL_MS);
    }
  }, [_loadSound]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopAlertSound = useCallback(() => {
    activeRef.current = false;
    setIsSoundPlaying(false);
    _clearTimer();
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.setPositionAsync(0).catch(() => {});
  }, [_clearTimer]);

  // ── Start — loads sound on first call, then plays immediately ─────────────
  const startAlertSound = useCallback(async () => {
    if (activeRef.current) return;  // already running

    // Load if needed (first time)
    if (!soundRef.current) {
      soundRef.current = await _loadSound();
    }

    activeRef.current = true;
    setIsSoundPlaying(true);
    _beep(); // fire immediately; no await so caller isn't blocked
  }, [_loadSound, _beep]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      activeRef.current = false;
      _clearTimer();
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [_clearTimer]);

  return (
    <RidesContext.Provider value={{
      newRidesCount,
      setNewRidesCount,
      clearBadge,
      isSoundPlaying,
      startAlertSound,
      stopAlertSound,
    }}>
      {children}
    </RidesContext.Provider>
  );
}

export function useRides() {
  const ctx = useContext(RidesContext);
  if (!ctx) throw new Error('useRides must be used within RidesProvider');
  return ctx;
}
