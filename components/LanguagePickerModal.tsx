import React from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { LANGUAGES, type LanguageCode } from '../i18n';

const LANG_FLAGS: Record<LanguageCode, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

interface LanguagePickerModalProps {
  visible: boolean;
  current: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
  onClose: () => void;
}

export default function LanguagePickerModal({
  visible, current, onSelect, onClose,
}: LanguagePickerModalProps) {
  const colors = useThemeColors();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: colors.grass0 }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Language / 언어</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected = item.code === current;
              return (
                <Pressable
                  style={[
                    styles.row,
                    { borderBottomColor: colors.grass0 },
                    isSelected && { backgroundColor: colors.surfaceAlt },
                  ]}
                  onPress={() => {
                    onSelect(item.code as LanguageCode);
                    onClose();
                  }}
                >
                  <Text style={styles.flag}>{LANG_FLAGS[item.code as LanguageCode]}</Text>
                  <Text style={[styles.langLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { ...Fonts.heading, fontSize: FontSize.lg },
  closeBtn: { padding: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 28 },
  langLabel: { ...Fonts.body, fontSize: FontSize.md, flex: 1 },
});
