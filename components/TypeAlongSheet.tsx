import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { charMatchStatus } from '../utils/similarity';

interface TypeAlongSheetProps { visible: boolean; quoteText: string; onClose: () => void; onSuccess: () => void; }

export default function TypeAlongSheet({ visible, quoteText, onClose, onSuccess }: TypeAlongSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [typed, setTyped] = useState('');

  useEffect(() => { if (!visible) setTyped(''); }, [visible]);
  useEffect(() => { if (typed.length > 0 && typed === quoteText) onSuccess(); }, [typed, quoteText]);

  const matchStatus = charMatchStatus(typed, quoteText);
  const progress = quoteText.length > 0 ? typed.length / quoteText.length : 0;
  const isComplete = typed === quoteText;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('type.title')}</Text>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>{t('type.instruction')}</Text>

          <View style={[styles.quoteBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={styles.highlightedText}>
              {quoteText.split('').map((char, i) => {
                let color: string = colors.textMuted;
                if (i < typed.length) color = matchStatus[i] ? colors.success : colors.error;
                return <Text key={i} style={{ color }}>{char}</Text>;
              })}
            </Text>
          </View>

          <TextInput
            style={[styles.input, { borderColor: colors.primaryLight, color: colors.textPrimary }]}
            value={typed}
            onChangeText={setTyped}
            placeholder={t('type.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus={visible}
          />

          <View style={styles.progressRow}>
            <View style={[styles.progressBar, { backgroundColor: colors.grass0 }]}>
              <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: isComplete ? colors.success : colors.primary }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{typed.length}/{quoteText.length}</Text>
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>{t('type.close')}</Text>
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
  highlightedText: { ...Fonts.quote, fontSize: FontSize.lg, lineHeight: 32, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, minHeight: 80, textAlignVertical: 'top', marginBottom: Spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: Spacing.sm, marginBottom: Spacing.lg },
  progressBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { ...Fonts.body, fontSize: FontSize.xs, width: 60, textAlign: 'right' },
  closeButton: { padding: Spacing.sm },
  closeText: { ...Fonts.body, fontSize: FontSize.md },
});
