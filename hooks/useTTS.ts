import { useCallback, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

interface TTSOptions {
  language?: string;
  rate?: number;
  pitch?: number;
}

export function useTTS(options: TTSOptions = {}) {
  const { language = 'ko-KR', rate = 0.9, pitch = 1.0 } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const speak = useCallback(
    async (text: string) => {
      if (speakingRef.current) {
        await Speech.stop();
      }

      speakingRef.current = true;
      setIsSpeaking(true);

      Speech.speak(text, {
        language,
        rate,
        pitch,
        onDone: () => {
          speakingRef.current = false;
          setIsSpeaking(false);
        },
        onStopped: () => {
          speakingRef.current = false;
          setIsSpeaking(false);
        },
        onError: () => {
          speakingRef.current = false;
          setIsSpeaking(false);
        },
      });
    },
    [language, rate, pitch]
  );

  const stop = useCallback(async () => {
    await Speech.stop();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
