import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useTextRecognition } from '../hooks/useTextRecognition';
import { textSimilarity } from '../utils/similarity';
import { SIMILARITY_CONFIG } from '../constants/config';

interface WriteAlongSheetProps { visible: boolean; quoteText: string; onClose: () => void; onSuccess: () => void; }

export default function WriteAlongSheet({ visible, quoteText, onClose, onSuccess }: WriteAlongSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const { recognizedText, isProcessing, processImage, reset } = useTextRecognition();

  const similarity = recognizedText ? textSimilarity(recognizedText, quoteText) : 0;
  const isSuccess = similarity >= SIMILARITY_CONFIG.writeThreshold;

  useEffect(() => { if (isSuccess) onSuccess(); }, [isSuccess]);
  useEffect(() => { if (!visible) { setPhotoUri(null); reset(); } }, [visible]);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) { setPhotoUri(photo.uri); await processImage(photo.uri); }
    } catch { /* camera error */ }
  };

  if (!permission) return null;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('write.title')}</Text>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>{t('write.instruction')}</Text>

          <View style={[styles.quoteBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.quoteText, { color: colors.textPrimary }]}>{quoteText}</Text>
          </View>

          {!permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={[styles.permissionText, { color: colors.textSecondary }]}>{t('write.permissionNeeded')}</Text>
              <Pressable style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>{t('write.allowPermission')}</Text>
              </Pressable>
            </View>
          ) : photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.preview} />
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.processingText, { color: colors.textSecondary }]}>{t('write.processing')}</Text>
                </View>
              )}
              {recognizedText ? (
                <View style={[styles.resultBox, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.resultLabel, { color: colors.textMuted }]}>{t('write.recognized')}</Text>
                  {/* Char-by-char diff: highlight matching/non-matching characters */}
                  <Text style={styles.resultDiffText}>
                    {quoteText.split('').map((char, i) => {
                      const recChar = recognizedText[i];
                      const matched = recChar != null && recChar.toLowerCase() === char.toLowerCase();
                      const color = recChar == null ? colors.textMuted : matched ? colors.success : colors.error;
                      return <Text key={i} style={{ color }}>{char}</Text>;
                    })}
                  </Text>
                  <Text style={[styles.similarityText, { color: colors.primary }]}>{t('write.match')} {Math.round(similarity * 100)}%</Text>
                </View>
              ) : null}
              <Pressable style={[styles.retakeButton, { backgroundColor: colors.secondary }]} onPress={() => { setPhotoUri(null); reset(); }}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.retakeText}>{t('write.retake')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView ref={cameraRef} style={styles.camera} facing="back" />
              <Pressable style={styles.captureButton} onPress={takePhoto}>
                <View style={styles.captureInner} />
              </Pressable>
            </View>
          )}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>{t('write.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl, alignItems: 'center', maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  title: { ...Fonts.heading, fontSize: FontSize.xl, marginBottom: Spacing.xs },
  instruction: { ...Fonts.body, fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' },
  quoteBox: { padding: Spacing.md, borderRadius: BorderRadius.md, width: '100%', marginBottom: Spacing.md },
  quoteText: { ...Fonts.quote, fontSize: FontSize.md, textAlign: 'center', lineHeight: 26 },
  permissionBox: { alignItems: 'center', padding: Spacing.lg },
  permissionText: { ...Fonts.body, fontSize: FontSize.md, marginBottom: Spacing.md },
  permissionButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  permissionButtonText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  cameraContainer: { width: '100%', height: 250, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.md, position: 'relative' },
  camera: { flex: 1 },
  captureButton: { position: 'absolute', bottom: 16, alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  captureInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff' },
  previewContainer: { width: '100%', marginBottom: Spacing.md },
  preview: { width: '100%', height: 200, borderRadius: BorderRadius.md },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.md },
  processingText: { ...Fonts.body, fontSize: FontSize.sm, marginTop: Spacing.sm },
  resultBox: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm },
  resultLabel: { ...Fonts.body, fontSize: FontSize.xs, marginBottom: Spacing.xs },
  resultDiffText: { ...Fonts.quote, fontSize: FontSize.md, lineHeight: 26, textAlign: 'center', flexWrap: 'wrap' },
  resultText: { ...Fonts.body, fontSize: FontSize.md },
  similarityText: { ...Fonts.heading, fontSize: FontSize.sm, marginTop: Spacing.xs },
  retakeButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignSelf: 'center', marginTop: Spacing.sm },
  retakeText: { ...Fonts.body, fontSize: FontSize.sm, color: '#fff' },
  closeButton: { padding: Spacing.sm },
  closeText: { ...Fonts.body, fontSize: FontSize.md },
});
