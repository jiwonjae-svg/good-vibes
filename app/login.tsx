import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';
import {
  signInWithEmail, signUpWithEmail, sendPasswordResetEmail,
  useGoogleAuth, signInWithGoogle, isEmailVerified, sendEmailVerification,
  reloadUser, getCurrentUser,
} from '../services/authService';

type Mode = 'login' | 'signup' | 'forgot';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const hasSeenOnboarding = useUserStore((s) => s.hasSeenOnboarding);
  const isDarkMode = useUserStore((s) => s.isDarkMode);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const { response, promptAsync } = useGoogleAuth();

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken;
      if (idToken) {
        handleGoogleSignIn(idToken);
      }
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string) => {
    setLoading(true);
    try {
      const user = await signInWithGoogle(idToken);
      if (user) {
        await setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        await setAuthCompleted();
        if (hasSeenOnboarding) {
          router.replace('/(tabs)');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (emailToCheck: string): boolean => {
    if (!emailToCheck.trim()) {
      Alert.alert(t('login.error'), t('login.enterEmail'));
      return false;
    }
    if (!EMAIL_REGEX.test(emailToCheck.trim())) {
      Alert.alert(t('login.error'), t('login.invalidEmail'));
      return false;
    }
    return true;
  };

  const handleEmailLogin = async () => {
    if (!validateEmail(email)) return;
    if (!password.trim()) {
      Alert.alert(t('login.error'), t('login.enterPassword'));
      return;
    }

    setLoading(true);
    try {
      const user = await signInWithEmail(email.trim(), password);
      if (!user) return;

      await reloadUser();
      if (!isEmailVerified()) {
        setVerifyModalVisible(true);
        return;
      }

      await setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
      await setAuthCompleted();
      if (hasSeenOnboarding) {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert(t('login.loginFailed'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!displayName.trim()) {
      Alert.alert(t('login.error'), t('login.enterName'));
      return;
    }
    if (!validateEmail(email)) return;
    if (!password) {
      Alert.alert(t('login.error'), t('login.enterPassword'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('login.error'), t('login.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('login.error'), t('login.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim());
      setVerifyModalVisible(true);
    } catch (e: any) {
      Alert.alert(t('login.signupFailed'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(email.trim());
      Alert.alert(t('login.emailSent'), t('login.resetInstructions'), [
        { text: 'OK', onPress: () => setMode('login') },
      ]);
    } catch (e: any) {
      Alert.alert(t('login.error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const user = getCurrentUser();
      if (user) {
        await sendEmailVerification(user);
        Alert.alert(t('login.emailSent'), t('login.verificationResent'));
      }
    } catch (e: any) {
      Alert.alert(t('login.error'), e.message);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleVerifyModalClose = () => {
    setVerifyModalVisible(false);
    setMode('login');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSkip = async () => {
    await setAuthCompleted();
    if (hasSeenOnboarding) {
      router.replace('/(tabs)');
    }
  };

  const s = makeStyles(colors);

  return (
    <LinearGradient colors={[colors.background, colors.surfaceAlt]} style={s.container}>
      {/* Email Verification Modal */}
      <Modal transparent visible={verifyModalVisible} animationType="fade" onRequestClose={handleVerifyModalClose}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <View style={s.modalIconWrapper}>
              <Ionicons name="mail-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{t('login.verifyEmail')}</Text>
            <Text style={[s.modalDesc, { color: colors.textSecondary }]}>
              {t('login.verifyEmailDesc')}
            </Text>
            <Text style={[s.modalEmail, { color: colors.primary }]}>{email}</Text>

            <Pressable
              style={[s.modalResendBtn, { borderColor: colors.primary }]}
              onPress={handleResendVerification}
              disabled={resendingEmail}
            >
              {resendingEmail ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[s.modalResendText, { color: colors.primary }]}>{t('login.resendEmail')}</Text>
              )}
            </Pressable>

            <Pressable
              style={[s.modalConfirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleVerifyModalClose}
            >
              <Text style={s.modalConfirmText}>{t('login.understood')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <Text style={s.appIcon}>✨</Text>
            <Text style={s.appName}>DailyGlow</Text>
            <Text style={s.appTagline}>
              {mode === 'login' ? t('login.welcomeBack') : mode === 'signup' ? t('login.createAccount') : t('login.resetPassword')}
            </Text>
          </View>

          {/* Card */}
          <View style={[s.card, { backgroundColor: colors.surface }]}>

            {/* Google Sign In */}
            {mode !== 'forgot' && (
              <>
                <Pressable
                  style={[
                    s.googleBtn,
                    {
                      backgroundColor: isDarkMode ? colors.surfaceAlt : '#fff',
                      borderColor: isDarkMode ? colors.grass0 : '#dadce0',
                    },
                  ]}
                  onPress={() => promptAsync()}
                  disabled={loading}
                >
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={[s.googleBtnText, { color: colors.textPrimary }]}>{t('login.continueWithGoogle')}</Text>
                </Pressable>

                <View style={s.dividerRow}>
                  <View style={[s.dividerLine, { backgroundColor: colors.grass0 }]} />
                  <Text style={[s.dividerText, { color: colors.textMuted }]}>{t('login.or')}</Text>
                  <View style={[s.dividerLine, { backgroundColor: colors.grass0 }]} />
                </View>
              </>
            )}

            {/* Display Name (sign up only) */}
            {mode === 'signup' && (
              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('login.name')}</Text>
                <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t('login.namePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>{t('login.email')}</Text>
              <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('login.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password */}
            {mode !== 'forgot' && (
              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('login.password')}</Text>
                <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPw}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <Pressable onPress={() => setShowPw(!showPw)}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Confirm Password (sign up only) */}
            {mode === 'signup' && (
              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('login.confirmPassword')}</Text>
                <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPw}
                    autoComplete="new-password"
                  />
                </View>
              </View>
            )}

            {/* Forgot password link (login mode only) */}
            {mode === 'login' && (
              <Pressable style={s.forgotBtn} onPress={() => setMode('forgot')}>
                <Text style={[s.forgotText, { color: colors.primary }]}>{t('login.forgotPassword')}</Text>
              </Pressable>
            )}

            {/* Primary Action Button */}
            <Pressable
              style={[s.primaryBtn, { backgroundColor: colors.primary }, loading && s.disabledBtn]}
              onPress={mode === 'login' ? handleEmailLogin : mode === 'signup' ? handleSignUp : handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>
                  {mode === 'login' ? t('login.signIn') : mode === 'signup' ? t('login.createAccountBtn') : t('login.sendResetEmail')}
                </Text>
              )}
            </Pressable>

            {/* Mode Switch */}
            <View style={s.switchRow}>
              {mode === 'login' ? (
                <>
                  <Text style={[s.switchText, { color: colors.textSecondary }]}>{t('login.noAccount')} </Text>
                  <Pressable onPress={() => setMode('signup')}>
                    <Text style={[s.switchLink, { color: colors.primary }]}>{t('login.signUp')}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setMode('login')}>
                  <Text style={[s.switchLink, { color: colors.primary }]}>← {t('login.backToSignIn')}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Skip Button */}
          <Pressable style={s.skipBtn} onPress={handleSkip}>
            <Text style={[s.skipText, { color: colors.textMuted }]}>{t('login.continueWithoutAccount')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    kav: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xxl },
    header: { alignItems: 'center', marginBottom: Spacing.xl },
    appIcon: { fontSize: 56, marginBottom: Spacing.sm },
    appName: { ...Fonts.heading, fontSize: FontSize.hero, color: colors.primary },
    appTagline: { ...Fonts.body, fontSize: FontSize.md, color: colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
    card: { borderRadius: BorderRadius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, marginBottom: Spacing.md },
    googleBtnText: { ...Fonts.body, fontSize: FontSize.md },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { ...Fonts.body, fontSize: FontSize.sm },
    inputGroup: { marginBottom: Spacing.md },
    label: { ...Fonts.body, fontSize: FontSize.sm, marginBottom: Spacing.xs },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
    input: { flex: 1, ...Fonts.body, fontSize: FontSize.md, paddingVertical: Spacing.md },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.md },
    forgotText: { ...Fonts.body, fontSize: FontSize.sm },
    primaryBtn: { padding: Spacing.md + 2, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.md },
    disabledBtn: { opacity: 0.6 },
    primaryBtnText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
    switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    switchText: { ...Fonts.body, fontSize: FontSize.sm },
    switchLink: { ...Fonts.heading, fontSize: FontSize.sm },
    skipBtn: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.md },
    skipText: { ...Fonts.body, fontSize: FontSize.sm },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
    modalContent: { width: '100%', borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center' },
    modalIconWrapper: { marginBottom: Spacing.md },
    modalTitle: { ...Fonts.heading, fontSize: FontSize.xl, marginBottom: Spacing.sm, textAlign: 'center' },
    modalDesc: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', marginBottom: Spacing.sm, lineHeight: 22 },
    modalEmail: { ...Fonts.heading, fontSize: FontSize.md, marginBottom: Spacing.lg },
    modalResendBtn: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    modalResendText: { ...Fonts.body, fontSize: FontSize.sm },
    modalConfirmBtn: { width: '100%', padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
    modalConfirmText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  });
}
