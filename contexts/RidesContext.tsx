import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

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

  const clearBadge = () => setNewRidesCount(0);

  const stopAlertSound = useCallback(async () => {
    soundPlayingRef.current = false;
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
    if (soundPlayingRef.current) return; // already ringing
    soundPlayingRef.current = true;
    setIsSoundPlaying(true);

    try {
      const { Audio } = await import('expo-av');

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Use a reliable CDN sound URI — Google's notification/alarm sounds are blocked
      // on some Android versions. We use a well-known open audio CDN instead.
      const soundUri = 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e4af8a67e.mp3';

      const { sound } = await Audio.Sound.createAsync(
        { uri: soundUri },
        { isLooping: true, volume: 1.0 },
        (status) => {
          // If load fails, reset state
          if (status.isLoaded === false && (status as any).error) {
            soundPlayingRef.current = false;
            setIsSoundPlaying(false);
          }
        }
      );

      soundRef.current = sound;

      if (soundPlayingRef.current) {
        await sound.playAsync();
      } else {
        // Stopped before it could start
        await sound.unloadAsync();
        soundRef.current = null;
      }
    } catch (e) {
      console.warn('Alert sound error:', e);
      soundPlayingRef.current = false;
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
