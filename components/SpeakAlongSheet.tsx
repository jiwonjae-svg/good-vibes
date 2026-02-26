import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useSpeechRecognitionHook } from '../hooks/useSpeechRecognition';
import { textSimilarity } from '../utils/similarity';
import { SIMILARITY_CONFIG } from '../constants/config';

interface SpeakAlongSheetProps { visible: boolean; quoteText: string; onClose: () => void; onSuccess: () => void; }

export default function SpeakAlongSheet({ visible, quoteText, onClose, onSuccess }: SpeakAlongSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isListening, transcript, isAvailable, startListening, stopListening, resetTranscript } = useSpeechRecognitionHook();

  const similarity = transcript ? textSimilarity(transcript, quoteText) : 0;
  const isSuccess = similarity >= SIMILARITY_CONFIG.speakThreshold;

  useEffect(() => { if (isSuccess && !isListening) onSuccess(); }, [isSuccess, isListening]);
  useEffect(() => { if (!visible) { resetTranscript(); if (isListening) stopListening(); } }, [visible]);

  const handleToggle = () => {
    if (isListening) stopListening();
    else { resetTranscript(); startListening(); }
  };

  const pct = Math.round(similarity * 100);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('speak.title')}</Text>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>{t('speak.instruction')}</Text>

          <View style={[styles.quoteBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.quoteText, { color: colors.textPrimary }]}>{quoteText}</Text>
          </View>

          {!isAvailable && (
            <View style={styles.unavailableBox}>
              <Text style={styles.unavailableText}>{t('speak.unavailable')}</Text>
            </View>
          )}

          <View style={styles.transcriptBox}>
            <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>{t('speak.recognized')}</Text>
            <Text style={[styles.transcript, { color: colors.textSecondary }]}>
              {!isAvailable ? t('speak.unavailableFallback') : transcript || (isListening ? t('speak.listening') : t('speak.tapMic'))}
            </Text>
          </View>

          <View style={styles.similarityRow}>
            <Text style={[styles.similarityLabel, { color: colors.textSecondary }]}>{t('speak.match')}</Text>
            <View style={[styles.progressBar, { backgroundColor: colors.grass0 }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: isSuccess ? colors.success : colors.primary }]} />
            </View>
            <Text style={[styles.similarityValue, { color: isSuccess ? colors.success : colors.textPrimary }]}>{pct}%</Text>
          </View>

          <Pressable style={[styles.micButton, { backgroundColor: isListening ? colors.error : colors.primary }]} onPress={handleToggle}>
            {isListening ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="mic" size={32} color="#fff" />}
          </Pressable>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>{t('speak.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  title: { ...Fonts.heading, fontSize: FontSize.xl, marginBottom: Spacing.xs },
  instruction: { ...Fonts.body, fontSize: FontSize.sm, marginBottom: Spacing.lg },
  quoteBox: { padding: Spacing.md, borderRadius: BorderRadius.md, width: '100%', marginBottom: Spacing.md },
  quoteText: { ...Fonts.quote, fontSize: FontSize.lg, textAlign: 'center', lineHeight: 32 },
  unavailableBox: { backgroundColor: '#FFF3CD', borderRadius: BorderRadius.sm, padding: Spacing.sm, width: '100%', marginBottom: Spacing.md },
  unavailableText: { ...Fonts.body, fontSize: FontSize.sm, color: '#856404', textAlign: 'center', lineHeight: 20 },
  transcriptBox: { width: '100%', marginBottom: Spacing.md, minHeight: 60 },
  transcriptLabel: { ...Fonts.body, fontSize: FontSize.xs, marginBottom: Spacing.xs },
  transcript: { ...Fonts.body, fontSize: FontSize.md, lineHeight: 24 },
  similarityRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: Spacing.sm, marginBottom: Spacing.lg },
  similarityLabel: { ...Fonts.body, fontSize: FontSize.sm, width: 45 },
  progressBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  similarityValue: { ...Fonts.heading, fontSize: FontSize.sm, width: 40, textAlign: 'right' },
  micButton: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  closeButton: { padding: Spacing.sm },
  closeText: { ...Fonts.body, fontSize: FontSize.md },
});
