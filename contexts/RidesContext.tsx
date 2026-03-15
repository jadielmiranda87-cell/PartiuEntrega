import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Audio } from 'expo-av';

// Multiple fallback URIs — tried in order until one works
const SOUND_URIS = [
  'https://cdn.pixabay.com/audio/2022/03/15/audio_6e4af8a67e.mp3',
  'https://www.soundjay.com/buttons/sounds/beep-07a.mp3',
  'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
];

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
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBadge = () => setNewRidesCount(0);

  // ── Internal: unload any active sound ────────────────────────────────────
  const _unloadSound = async () => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
      } catch { /* ignore */ }
      try {
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  };

  // ── Stop ─────────────────────────────────────────────────────────────────
  const stopAlertSound = useCallback(async () => {
    isPlayingRef.current = false;
    setIsSoundPlaying(false);
    await _unloadSound();
  }, []);

  // ── Internal: try to load & play one URI ─────────────────────────────────
  const _tryPlayUri = async (uri: string): Promise<Audio.Sound | null> => {
    try {
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { isLooping: true, volume: 1.0, shouldPlay: true },
        undefined,
        true // downloadFirst — avoids stuttering
      );
      if ((status as any).isLoaded) {
        console.log('[RidesContext] Sound loaded OK:', uri);
        return sound;
      }
      await sound.unloadAsync();
      return null;
    } catch (e) {
      console.warn('[RidesContext] Failed URI:', uri, e);
      return null;
    }
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  const startAlertSound = useCallback(async () => {
    if (isPlayingRef.current) return; // already playing
    isPlayingRef.current = true;
    setIsSoundPlaying(true);

    try {
      // Simplified audio mode — no staysActiveInBackground (requires native permission)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('[RidesContext] setAudioMode error:', e);
    }

    // Unload previous sound
    await _unloadSound();
    if (!isPlayingRef.current) return;

    // Try each URI until one works
    let loadedSound: Audio.Sound | null = null;
    for (const uri of SOUND_URIS) {
      if (!isPlayingRef.current) break;
      loadedSound = await _tryPlayUri(uri);
      if (loadedSound) break;
    }

    if (!isPlayingRef.current) {
      if (loadedSound) await loadedSound.unloadAsync();
      return;
    }

    if (loadedSound) {
      soundRef.current = loadedSound;
      // Monitor playback status — restart if it stops unexpectedly
      loadedSound.setOnPlaybackStatusUpdate((status) => {
        if (!isPlayingRef.current) return;
        if ((status as any).isLoaded && !(status as any).isPlaying && !(status as any).isBuffering) {
          // isLooping should handle it, but fallback restart
          loadedSound?.playFromPositionAsync(0).catch(() => {});
        }
      });
    } else {
      // All URIs failed — use silent fallback loop so badge/UI still works
      console.warn('[RidesContext] All sound URIs failed, using silent mode');
      isPlayingRef.current = false;
      setIsSoundPlaying(false);
    }
  }, []);

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
