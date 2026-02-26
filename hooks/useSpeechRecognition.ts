import { useState, useCallback, useRef } from 'react';

// Lazy-load the native module so Expo Go doesn't crash.
// expo-speech-recognition requires a dev build (native module).
let SpeechModule: any = null;
let SpeechEventHook: ((event: string, handler: (e: any) => void) => void) | null = null;
let isAvailable = false;

try {
  const mod = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule;
  SpeechEventHook = mod.useSpeechRecognitionEvent;
  isAvailable = true;
} catch {
  // Running in Expo Go — speech recognition not available
}

// No-op hook when native module is absent
function useNoopEvent(_event: string, _handler: (e: any) => void) {}

const safeUseEvent: (event: string, handler: (e: any) => void) => void =
  SpeechEventHook ?? useNoopEvent;

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognitionHook(): UseSpeechRecognitionReturn {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const finalRef = useRef('');

  safeUseEvent('result', (event: any) => {
    const results = event.results;
    if (results?.length > 0) {
      const latest = results[results.length - 1];
      const text: string = latest?.transcript ?? '';
      if (event.isFinal) {
        finalRef.current += text;
        setTranscript(finalRef.current);
      } else {
        setTranscript(finalRef.current + text);
      }
    }
  });

  safeUseEvent('end', () => setListening(false));
  safeUseEvent('error', () => setListening(false));

  const startListening = useCallback(async () => {
    if (!isAvailable || !SpeechModule) {
      console.warn('Speech recognition is not available in Expo Go. Use a dev build.');
      return;
    }
    const result = await SpeechModule.requestPermissionsAsync();
    if (!result.granted) return;

    finalRef.current = '';
    setTranscript('');
    setListening(true);

    SpeechModule.start({ lang: 'ko-KR', interimResults: true, continuous: true });
  }, []);

  const stopListening = useCallback(() => {
    if (!isAvailable || !SpeechModule) return;
    SpeechModule.stop();
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening: listening,
    transcript,
    isAvailable,
    startListening,
    stopListening,
    resetTranscript,
  };
}
