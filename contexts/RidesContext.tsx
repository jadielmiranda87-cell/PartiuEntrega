import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

// Interval between beeps in milliseconds
const BEEP_INTERVAL_MS = 3000;

interface RidesContextType {
  newRidesCount: number;
  setNewRidesCount: React.Dispatch<React.SetStateAction<number>>;
  clearBadge: () => void;
  // Sound control shared across screens (persists across navigation)
  isSoundPlaying: boolean;
  startAlertSound: () => Promise<void>;
  stopAlertSound: () => Promise<void>;
}

const RidesContext = createContext<RidesContextType | undefined>(undefined);

export function RidesProvider({ children }: { children: ReactNode }) {
  const [newRidesCount, setNewRidesCount] = useState(0);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const soundRef = useRef<any | null>(null);
  const soundPlayingRef = useRef(false);
  const beepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBadge = () => setNewRidesCount(0);

  // ── Unload current sound object ─────────────────────────────────────────
  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  }, []);

  // ── Stop all sound & cancel timer ──────────────────────────────────────
  const stopAlertSound = useCallback(async () => {
    soundPlayingRef.current = false;
    setIsSoundPlaying(false);
    if (beepTimerRef.current) {
      clearTimeout(beepTimerRef.current);
      beepTimerRef.current = null;
    }
    await unloadSound();
  }, [unloadSound]);

  // ── Play a single beep, then schedule the next one ─────────────────────
  const playBeep = useCallback(async () => {
    if (!soundPlayingRef.current) return;

    try {
      const { Audio } = await import('expo-av');

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Short notification beep (open CDN, good cross-platform compatibility)
      const soundUri = 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e4af8a67e.mp3';

      // Unload previous instance before loading a new one
      await unloadSound();

      if (!soundPlayingRef.current) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: soundUri },
        { isLooping: false, volume: 1.0 },
        (status) => {
          if (status.isLoaded === false && (status as any).error) {
            soundPlayingRef.current = false;
            setIsSoundPlaying(false);
          }
        }
      );

      soundRef.current = sound;

      if (!soundPlayingRef.current) {
        await sound.unloadAsync();
        soundRef.current = null;
        return;
      }

      await sound.playAsync();

      // Schedule next beep after interval
      beepTimerRef.current = setTimeout(() => {
        playBeep();
      }, BEEP_INTERVAL_MS);

    } catch (e) {
      console.warn('Alert beep error:', e);
      // Retry after interval even on error
      if (soundPlayingRef.current) {
        beepTimerRef.current = setTimeout(() => playBeep(), BEEP_INTERVAL_MS);
      }
    }
  }, [unloadSound]);

  // ── Start intermittent beeping ──────────────────────────────────────────
  const startAlertSound = useCallback(async () => {
    if (soundPlayingRef.current) return; // already ringing
    soundPlayingRef.current = true;
    setIsSoundPlaying(true);
    await playBeep();
  }, [playBeep]);

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
