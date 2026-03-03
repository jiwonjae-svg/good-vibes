import { useCallback, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { useUserStore } from '../stores/useUserStore';

const LANGUAGE_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

interface TTSOptions {
  rate?: number;
  pitch?: number;
}

interface SpeakOptions {
  onDone?: () => void;
}

export function useTTS(options: TTSOptions = {}) {
  const { rate = 0.9, pitch = 1.0 } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const userLanguage = useUserStore((s) => s.language);

  const getLanguageCode = useCallback(() => {
    return LANGUAGE_MAP[userLanguage] || 'ko-KR';
  }, [userLanguage]);

  const speak = useCallback(
    async (text: string, speakOptions?: SpeakOptions) => {
      if (speakingRef.current) {
        await Speech.stop();
      }

      speakingRef.current = true;
      setIsSpeaking(true);
      const customOnDone = speakOptions?.onDone;

      const langCode = getLanguageCode();

      Speech.speak(text, {
        language: langCode,
        rate,
        pitch,
        onDone: () => {
          speakingRef.current = false;
          setIsSpeaking(false);
          customOnDone?.();
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
    [getLanguageCode, rate, pitch]
  );

  const stop = useCallback(async () => {
    await Speech.stop();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
