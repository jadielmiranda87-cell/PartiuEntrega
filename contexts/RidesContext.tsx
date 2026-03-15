import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { Audio } from 'expo-av';

/**
 * Sound URIs tried in order during preload.
 * Small files preferred for fast download.
 */
const SOUND_URIS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://cdn.pixabay.com/audio/2023/03/11/audio_40e2590fb3.mp3',
  'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae6aa.mp3',
];

/** Gap between beeps (ms). 1000 = 1 second. */
const BEEP_INTERVAL_MS = 1000;

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

  const soundRef   = useRef<Audio.Sound | null>(null);
  const activeRef  = useRef(false);   // true while alert loop is running
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBadge = () => setNewRidesCount(0);

  // ── Clear timer helper ─────────────────────────────────────────────────────
  const _clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // ── Preload sound on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const preload = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn('[Rides] setAudioMode:', e);
      }

      for (const uri of SOUND_URIS) {
        if (!mounted) return;
        try {
          const { sound, status } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, volume: 1.0 }
          );
          if ((status as any).isLoaded) {
            soundRef.current = sound;
            console.log('[Rides] Preloaded:', uri);
            return;
          }
          await sound.unloadAsync();
        } catch (e) {
          console.warn('[Rides] Preload failed:', uri, e);
        }
      }
      console.warn('[Rides] All URIs failed to preload — will retry on demand');
    };

    preload();

    return () => {
      mounted = false;
      _clearTimer();
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  // ── Internal: play one beep then schedule next ─────────────────────────────
  const _beep = useCallback(async () => {
    if (!activeRef.current) return;

    // Reload if sound was lost
    if (!soundRef.current) {
      for (const uri of SOUND_URIS) {
        try {
          const { sound, status } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, volume: 1.0 }
          );
          if ((status as any).isLoaded) { soundRef.current = sound; break; }
          await sound.unloadAsync();
        } catch { /* ignore */ }
      }
    }

    if (soundRef.current && activeRef.current) {
      try {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      } catch (e) {
        console.warn('[Rides] Play error:', e);
        // Attempt to reload next cycle
        try { await soundRef.current.unloadAsync(); } catch { /* ignore */ }
        soundRef.current = null;
      }
    }

    if (activeRef.current) {
      timerRef.current = setTimeout(_beep, BEEP_INTERVAL_MS);
    }
  }, []);

  // ── Stop alert ─────────────────────────────────────────────────────────────
  const stopAlertSound = useCallback(() => {
    activeRef.current = false;
    setIsSoundPlaying(false);
    _clearTimer();
    // Stop playback but KEEP sound loaded for next alert
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.setPositionAsync(0).catch(() => {});
  }, []);

  // ── Start alert — plays first beep immediately ─────────────────────────────
  const startAlertSound = useCallback(() => {
    if (activeRef.current) return; // already running
    activeRef.current = true;
    setIsSoundPlaying(true);
    // Fire immediately — no await so caller isn't blocked
    _beep();
  }, [_beep]);

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
