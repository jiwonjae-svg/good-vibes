import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useCommunityStore } from '../stores/useCommunityStore';
import { useUserStore } from '../stores/useUserStore';
import { CATEGORY_THEMES } from '../data/categories';

// Subset of categories shown during submission (first 3 themes × first 8 each)
const SUBMIT_CATEGORIES = CATEGORY_THEMES.slice(0, 3).flatMap((theme) =>
  theme.categories.slice(0, 8),
);

interface SubmitQuoteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function SubmitQuoteSheet({ visible, onClose }: SubmitQuoteSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const uid = useUserStore((s) => s.uid);
  const displayName = useUserStore((s) => s.displayName);
  const language = useUserStore((s) => s.language);
  const { submitQuote, canSubmit } = useCommunityStore();

  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setAuthor('');
      setSelectedCats([]);
      setSubmitted(false);
      setError(null);
    }
  }, [visible]);

  const toggleCat = (key: string) => {
    setSelectedCats((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < 3
        ? [...prev, key]
        : prev,
    );
  };

  const handleSubmit = async () => {
    if (!uid) return;

    if (!canSubmit()) {
      setError(t('community.rateLimit'));
      return;
    }

    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError(t('community.tooShort'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitQuote(
        uid,
        displayName ?? t('common.anonymous'),
        trimmed,
        author.trim(),
        language,
        selectedCats,
      );
      if (result.success) {
        setSubmitted(true);
      } else if (result.error === 'xssBlocked') {
        setError(t('community.xssBlocked'));
      } else if (result.error === 'tooShort') {
        setError(t('community.tooShort'));
      } else if (result.error === 'tooLong') {
        setError(t('community.tooLong'));
      } else if (result.error === 'noUrls') {
        setError(t('community.noUrls'));
      } else {
        setError(t('community.submitError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = text.length;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrapper}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('community.submit')}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {submitted ? (
              <View style={styles.successContainer}>
                <Text style={styles.successEmoji}>✅</Text>
                <Text style={[styles.successText, { color: colors.textPrimary }]}>
                  {t('community.submitSuccess')}
                </Text>
                <Pressable
                  style={[styles.closeBtn, { backgroundColor: colors.primary }]}
                  onPress={onClose}
                >
                  <Text style={styles.closeBtnText}>{t('common.ok')}</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Quote text */}
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('community.textLabel')} *
                </Text>
                <View style={[styles.inputWrapper, { borderColor: charCount > 0 && charCount < 10 ? colors.error : colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <TextInput
                    style={[styles.textArea, { color: colors.textPrimary }]}
                    value={text}
                    onChangeText={setText}
                    placeholder={t('community.textPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={[styles.charCount, { color: charCount > 450 ? colors.warning : colors.textMuted }]}>
                    {charCount}/500
                  </Text>
                </View>

                {/* Author */}
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                  {t('community.author')}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}
                  value={author}
                  onChangeText={setAuthor}
                  placeholder={t('community.authorPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                />

                {/* Category chips */}
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                  {t('community.categories')}
                </Text>
                <View style={styles.chips}>
                  {SUBMIT_CATEGORIES.map((cat) => {
                    const selected = selectedCats.includes(cat.key);
                    return (
                      <Pressable
                        key={cat.key}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                            borderColor: selected ? colors.primary : colors.grass0,
                          },
                        ]}
                        onPress={() => toggleCat(cat.key)}
                      >
                        <Text style={[styles.chipText, { color: selected ? '#fff' : colors.textSecondary }]}>
                          {t(cat.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Error */}
                {error && (
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                )}

                {/* Submit button */}
                <Pressable
                  style={[
                    styles.submitBtn,
                    { backgroundColor: charCount >= 10 ? colors.primary : colors.grass0 },
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting || charCount < 10}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('community.submitBtn')}</Text>
                  )}
                </Pressable>

                <View style={{ height: Spacing.xl }} />
              </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  kavWrapper: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.lg,
  },
  label: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.sm,
  },
  textArea: {
    ...Fonts.body,
    fontSize: FontSize.md,
    minHeight: 100,
  },
  charCount: {
    ...Fonts.body,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: 4,
  },
  input: {
    ...Fonts.body,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
  },
  errorText: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  submitBtn: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    ...Fonts.heading,
    fontSize: FontSize.md,
    color: '#fff',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  successEmoji: {
    fontSize: 48,
  },
  successText: {
    ...Fonts.body,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  closeBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  closeBtnText: {
    ...Fonts.heading,
    fontSize: FontSize.md,
    color: '#fff',
  },
});
