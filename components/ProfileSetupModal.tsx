import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { isUsernameAvailable, isValidUsername, isValidDisplayName } from '../services/firestoreUserService';

// XSS-safe: strip any HTML/script tags from text
function sanitize(text: string): string {
  return text.replace(/[<>"'&]/g, '');
}

// Filter display name: allow letters (any script), digits, spaces, hyphens, underscores
function filterDisplayName(text: string): string {
  // Remove special chars except - and _ (and all Unicode letters/digits/spaces allowed)
  return sanitize(text).replace(/[!@#$%^&*()+={}\[\]|\\:;"<>,.?/~`]/g, '');
}

// Filter username: only a-z A-Z 0-9 - _
function filterUsername(text: string): string {
  return text.replace(/[^a-zA-Z0-9\-_]/g, '');
}

type Step = 'name' | 'username';

interface Props {
  visible: boolean;
  initialDisplayName?: string | null;
  onComplete: (displayName: string, username: string) => Promise<void>;
  onSkip?: () => void;
}

/**
 * Two-step profile setup modal shown after first Google Sign-In.
 * Step 1: Display name (non-unique)
 * Step 2: @username (unique, validated against Firestore)
 */
export default function ProfileSetupModal({ visible, initialDisplayName, onComplete, onSkip }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState(initialDisplayName ? filterDisplayName(initialDisplayName) : '');
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setStep('name');
      setDisplayName(initialDisplayName ? filterDisplayName(initialDisplayName) : '');
      setUsername('');
      setNameError(null);
      setUsernameError(null);
      setUsernameAvailable(null);
      setChecking(false);
      setSubmitting(false);
    }
  }, [visible]);

  const handleDisplayNameChange = (text: string) => {
    const filtered = filterDisplayName(text);
    setDisplayName(filtered);
    setNameError(null);
  };

  const handleUsernameChange = (text: string) => {
    const filtered = filterUsername(text);
    setUsername(filtered);
    setUsernameError(null);
    setUsernameAvailable(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (filtered.length >= 3 && isValidUsername(filtered)) {
      setChecking(true);
      debounceRef.current = setTimeout(async () => {
        const available = await isUsernameAvailable(filtered.toLowerCase());
        setChecking(false);
        setUsernameAvailable(available);
        if (!available) setUsernameError(t('profile.usernameTaken'));
      }, 600);
    } else if (filtered.length > 0) {
      setChecking(false);
    }
  };

  const handleNameNext = () => {
    const trimmed = displayName.trim();
    if (!trimmed) { setNameError(t('profile.nameRequired')); return; }
    if (!isValidDisplayName(trimmed)) { setNameError(t('profile.nameInvalid')); return; }
    setDisplayName(trimmed);
    setStep('username');
  };

  const handleUsernameSubmit = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setUsernameError(t('profile.usernameRequired')); return; }
    if (!isValidUsername(trimmed)) { setUsernameError(t('profile.usernameInvalid')); return; }
    if (usernameAvailable === false) { setUsernameError(t('profile.usernameTaken')); return; }

    setSubmitting(true);
    try {
      await onComplete(displayName.trim(), trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Progress dots */}
          <View style={styles.progress}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: step === 'username' ? colors.primary : colors.grass0 }]} />
          </View>

          {step === 'name' ? (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('profile.nameTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('profile.nameSubtitle')}</Text>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlt,
                    color: colors.textPrimary,
                    borderColor: nameError ? colors.error : colors.grass0,
                  },
                ]}
                placeholder={t('profile.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={displayName}
                onChangeText={handleDisplayNameChange}
                maxLength={30}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={handleNameNext}
              />
              {nameError && <Text style={[styles.errorText, { color: colors.error }]}>{nameError}</Text>}
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('profile.nameHint')}</Text>

              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={handleNameNext}
              >
                <Text style={styles.btnText}>{t('profile.next')}</Text>
              </Pressable>

              {onSkip && (
                <Pressable style={styles.skipBtn} onPress={onSkip}>
                  <Text style={[styles.skipText, { color: colors.textMuted }]}>{t('profile.skip')}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Pressable style={styles.backBtn} onPress={() => setStep('name')}>
                <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
              </Pressable>

              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('profile.usernameTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('profile.usernameSubtitle')}</Text>

              <View style={styles.usernameRow}>
                <View style={[styles.atBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.atText, { color: colors.textSecondary }]}>@</Text>
                </View>
                <TextInput
                  style={[
                    styles.usernameInput,
                    {
                      backgroundColor: colors.surfaceAlt,
                      color: colors.textPrimary,
                      borderColor: usernameError
                        ? colors.error
                        : usernameAvailable === true
                        ? colors.success
                        : colors.grass0,
                    },
                  ]}
                  placeholder={t('profile.usernamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={handleUsernameChange}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleUsernameSubmit}
                />
                <View style={styles.statusIcon}>
                  {checking && <ActivityIndicator size="small" color={colors.textMuted} />}
                  {!checking && usernameAvailable === true && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  )}
                  {!checking && usernameAvailable === false && (
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  )}
                </View>
              </View>

              {usernameError && <Text style={[styles.errorText, { color: colors.error }]}>{usernameError}</Text>}
              {!usernameError && usernameAvailable === true && (
                <Text style={[styles.errorText, { color: colors.success }]}>{t('profile.usernameAvailable')}</Text>
              )}
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t('profile.usernameHint')}</Text>

              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: submitting || checking ? colors.textMuted : colors.primary },
                ]}
                onPress={handleUsernameSubmit}
                disabled={submitting || checking}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>{t('profile.complete')}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl + Spacing.lg,
    minHeight: 380,
  },
  progress: {
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    ...Fonts.heading,
    fontSize: FontSize.xl,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Fonts.body,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  input: {
    ...Fonts.body,
    fontSize: FontSize.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.xs,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: 0,
  },
  atBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderColor: 'transparent',
  },
  atText: { ...Fonts.body, fontSize: FontSize.md },
  usernameInput: {
    ...Fonts.body,
    fontSize: FontSize.md,
    flex: 1,
    padding: Spacing.md,
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  statusIcon: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    ...Fonts.body,
    fontSize: FontSize.xs,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  hint: {
    ...Fonts.body,
    fontSize: FontSize.xs,
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },
  btn: {
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  btnText: { ...Fonts.body, fontSize: FontSize.md, color: '#fff' },
  skipBtn: { alignItems: 'center', padding: Spacing.sm },
  skipText: { ...Fonts.body, fontSize: FontSize.sm },
  backBtn: { position: 'absolute', top: Spacing.lg, left: Spacing.lg, padding: Spacing.xs },
});

function makeStyles(colors: any) { return {}; }
