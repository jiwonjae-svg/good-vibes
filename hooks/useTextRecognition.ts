import { useState, useCallback } from 'react';

interface UseTextRecognitionReturn {
  recognizedText: string;
  isProcessing: boolean;
  processImage: (uri: string) => Promise<string>;
  reset: () => void;
}

/**
 * OCR hook placeholder.
 * In production, integrate with react-native-mlkit for on-device text recognition.
 * For now, provides the interface that WriteAlongSheet will use.
 */
export function useTextRecognition(): UseTextRecognitionReturn {
  const [recognizedText, setRecognizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const processImage = useCallback(async (uri: string): Promise<string> => {
    setIsProcessing(true);
    try {
      // Placeholder: in production, call MLKit TextRecognition here
      // import TextRecognition from '@react-native-ml-kit/text-recognition';
      // const result = await TextRecognition.recognize(uri);
      // const text = result.blocks.map(b => b.text).join(' ');
      console.log('OCR processing image:', uri);
      const text = '';
      setRecognizedText(text);
      return text;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRecognizedText('');
  }, []);

  return { recognizedText, isProcessing, processImage, reset };
}
