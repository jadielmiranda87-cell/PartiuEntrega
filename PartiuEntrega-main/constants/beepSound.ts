/**
 * Base64-encoded WAV beep sound (440 Hz, 0.4s, mono, 8000 Hz, 8-bit PCM).
 * Embedded directly to avoid any network dependency.
 */

// 440 Hz sine wave, 8000 Hz sample rate, 8-bit PCM, 0.4 s = 3200 samples
function generateBeepBase64(): string {
  const sampleRate = 8000;
  const frequency = 880;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);

  // WAV header (44 bytes) + PCM data
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);        // chunk size
  view.setUint16(20, 1, true);         // PCM
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (1 ch * 8-bit = sampleRate)
  view.setUint16(32, 1, true);         // block align
  view.setUint16(34, 8, true);         // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);

  for (let i = 0; i < numSamples; i++) {
    // Sine wave 0-255 (8-bit unsigned)
    const t = i / sampleRate;
    // Fade in/out 10% each side to avoid clicks
    const fadeIn = i < numSamples * 0.1 ? i / (numSamples * 0.1) : 1;
    const fadeOut = i > numSamples * 0.9 ? (numSamples - i) / (numSamples * 0.1) : 1;
    const sample = Math.sin(2 * Math.PI * frequency * t) * fadeIn * fadeOut;
    view.setUint8(44 + i, Math.floor((sample * 0.9 + 1) * 127.5));
  }

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

  // btoa is available in React Native (Hermes / JSC)
  return 'data:audio/wav;base64,' + btoa(binary);
}

export const BEEP_DATA_URI = generateBeepBase64();
