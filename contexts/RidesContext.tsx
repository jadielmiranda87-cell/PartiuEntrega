import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Audio } from 'expo-av';

const SOUND_URI = 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e4af8a67e.mp3';

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

  const clearBadge = () => setNewRidesCount(0);

  const stopAlertSound = useCallback(async () => {
    isPlayingRef.current = false;
    setIsSoundPlaying(false);
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  }, []);

  const startAlertSound = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsSoundPlaying(true);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      // Unload any previous instance
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch { /* ignore */ }
        soundRef.current = null;
      }

      if (!isPlayingRef.current) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: SOUND_URI },
        { isLooping: true, volume: 1.0, shouldPlay: true }
      );

      if (!isPlayingRef.current) {
        // Was stopped while loading
        await sound.unloadAsync();
        return;
      }

      soundRef.current = sound;
    } catch (e) {
      console.warn('[RidesContext] Sound error:', e);
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
