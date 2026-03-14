import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useCommunityStore } from '../stores/useCommunityStore';
import { useUserStore } from '../stores/useUserStore';
import { CATEGORY_THEMES } from '../data/categories';

// Fireworks particle colors
const PARTICLE_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FC8', '#B983FF'];
const FIREWORKS_ICON = require('../assets/fireworks-elem-icon.png');

interface ParticleProps {
  color: string;
  startX: number;
  startY: number;
  angle: number;
}

function FireworkParticle({ color, startX, startY, angle }: ParticleProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const dist = 70 + Math.random() * 40;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [startX, startX + dx] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [startY, startY + dy] });
  const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.5] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
      }}
    />
  );
}

function FireworksDisplay() {
  const bounce = useRef(new Animated.Value(0)).current;
  const colors = useThemeColors();

  useEffect(() => {
    Animated.sequence([
      Animated.spring(bounce, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 0.9, friction: 6, tension: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const scale = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  const particles: React.ReactNode[] = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
    particles.push(
      <FireworkParticle key={i} color={color} startX={0} startY={0} angle={angle} />,
    );
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 100 }}>
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        {particles}
        <Animated.Image
          source={FIREWORKS_ICON}
          style={{ width: 80, height: 80, tintColor: colors.primary, transform: [{ scale }] }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

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
  const photoURL = useUserStore((s) => s.photoURL);
  const { submitQuote, canSubmit } = useCommunityStore();

  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textTouched, setTextTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setText('');
      setAuthor('');
      setSelectedCats([]);
      setSubmitted(false);
      setError(null);
      setTextTouched(false);
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
        photoURL,
      );
      if (result.success) {
        setSubmitted(true);
        // Award first-community-quote badge
        const store = useUserStore.getState();
        if (!store.earnedBadges.includes('community_1')) {
          const todayStr = new Date().toISOString().split('T')[0];
          const newBadges = [...store.earnedBadges, 'community_1'];
          const newDates = { ...store.earnedBadgeDates, community_1: todayStr };
          useUserStore.setState({ earnedBadges: newBadges, newBadgeEarned: 'community_1', earnedBadgeDates: newDates });
        }
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
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.kavWrapper}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
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
              <View style={[styles.successContainer, { paddingBottom: Spacing.lg }]}>
                <FireworksDisplay />
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
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
              >
                {/* Quote text */}
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('community.textLabel')} *
                </Text>
                <View style={[styles.inputWrapper, { borderColor: textTouched && charCount > 0 && charCount < 10 ? colors.error : colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <TextInput
                    style={[styles.textArea, { color: colors.textPrimary }]}
                    value={text}
                    onChangeText={(val) => setText(val.length > 500 ? val.slice(0, 500) : val)}
                    onBlur={() => setTextTouched(true)}
                    placeholder={t('community.textPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    autoCorrect={false}
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
                {CATEGORY_THEMES.map((theme) => (
                  <View key={theme.themeKey}>
                    <Text style={[styles.submitThemeHeader, { color: colors.textMuted }]}>
                      {t(theme.themeKey)}
                    </Text>
                    <View style={styles.chips}>
                      {theme.categories.map((cat) => {
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
                  </View>
                ))}

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

              </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = require('react-native').Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  kavWrapper: {
    width: '100%',
  },
  sheet: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.85,
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
  submitThemeHeader: {
    ...Fonts.body,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
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
    paddingTop: Spacing.lg,
    gap: Spacing.md,
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
