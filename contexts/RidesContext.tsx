import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Audio } from 'expo-av';

/**
 * Short notification beep sounds — tried in order.
 * Prefer small files (< 50 KB) for fast loading.
 */
const SOUND_URIS = [
  // Short ding/notification — Mixkit CDN (reliable)
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  // Fallback 1: simple beep — Pixabay
  'https://cdn.pixabay.com/audio/2023/03/11/audio_40e2590fb3.mp3',
  // Fallback 2: alert tone
  'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae6aa.mp3',
];

const BEEP_INTERVAL_MS = 1000; // 1 second between beeps

interface RidesContextType {
  newRidesCount: number;
  setNewRidesCount: React.Dispatch<React.SetStateAction<number>>;
  clearBadge: () => void;
  isSoundPlaying: boolean;
  startAlertSound: () => Promise<void>;
  stopAlertSound: () => Promise<void>;
}

const RidesContext = createContext<RidesContextType | undefined>(undefined);

export function RidesProvider({ children }: { children: ReactNode }) {
  const [newRidesCount, setNewRidesCount] = useState(0);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const isPlayingRef = useRef(false);
  const beepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBadge = () => setNewRidesCount(0);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const _clearTimer = () => {
    if (beepTimerRef.current) {
      clearTimeout(beepTimerRef.current);
      beepTimerRef.current = null;
    }
  };

  const _unloadSound = async () => {
    _clearTimer();
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try { await s.stopAsync(); } catch { /* ignore */ }
      try { await s.unloadAsync(); } catch { /* ignore */ }
    }
  };

  // ── Stop alert ────────────────────────────────────────────────────────────
  const stopAlertSound = useCallback(async () => {
    isPlayingRef.current = false;
    setIsSoundPlaying(false);
    await _unloadSound();
  }, []);

  // ── Play one beep ─────────────────────────────────────────────────────────
  const _playBeep = useCallback(async () => {
    if (!isPlayingRef.current) return;

    // Reuse loaded sound or load fresh
    let sound = soundRef.current;

    if (!sound) {
      // Try each URI
      for (const uri of SOUND_URIS) {
        if (!isPlayingRef.current) return;
        try {
          const { sound: s, status } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, volume: 1.0 }
          );
          if ((status as any).isLoaded) {
            sound = s;
            soundRef.current = s;
            console.log('[RidesContext] Loaded sound:', uri);
            break;
          }
          await s.unloadAsync();
        } catch (e) {
          console.warn('[RidesContext] URI failed:', uri, e);
        }
      }
    }

    if (!isPlayingRef.current) return;

    if (sound) {
      try {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } catch (e) {
        // Sound broken — reload next cycle
        console.warn('[RidesContext] Play error, will retry:', e);
        try { await sound.unloadAsync(); } catch { /* ignore */ }
        soundRef.current = null;
      }
    }

    // Schedule next beep
    if (isPlayingRef.current) {
      beepTimerRef.current = setTimeout(_playBeep, BEEP_INTERVAL_MS);
    }
  }, []);

  // ── Start alert ───────────────────────────────────────────────────────────
  const startAlertSound = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsSoundPlaying(true);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('[RidesContext] setAudioMode error:', e);
    }

    // Start first beep immediately
    _playBeep();
  }, [_playBeep]);

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
