import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useUserStore } from '../stores/useUserStore';
import {
  signInWithEmail, signUpWithEmail, sendPasswordResetEmail,
  useGoogleAuth, signInWithGoogle,
} from '../services/authService';

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginScreen() {
  const colors = useThemeColors();
  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const user = await signInWithEmail(email.trim(), password);
      await setAuth({ uid: user!.uid, displayName: user!.displayName, email: user!.email, photoURL: user!.photoURL });
      await setAuthCompleted();
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password || !displayName.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const user = await signUpWithEmail(email.trim(), password, displayName.trim());
      await setAuth({ uid: user!.uid, displayName: user!.displayName, email: user!.email, photoURL: user!.photoURL });
      await setAuthCompleted();
    } catch (e: any) {
      Alert.alert('Sign Up Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(email.trim());
      Alert.alert('Email Sent', 'Password reset instructions have been sent to your email.', [
        { text: 'OK', onPress: () => setMode('login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await setAuthCompleted();
  };

  const s = makeStyles(colors);

  return (
    <LinearGradient colors={[colors.background, colors.surfaceAlt]} style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <Text style={s.appIcon}>✨</Text>
            <Text style={s.appName}>Good Vibe</Text>
            <Text style={s.appTagline}>
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
            </Text>
          </View>

          {/* Card */}
          <View style={[s.card, { backgroundColor: colors.surface }]}>

            {/* Google Sign In */}
            {mode !== 'forgot' && (
              <>
                <Pressable style={[s.googleBtn, { borderColor: colors.grass0 }]} onPress={() => promptAsync()} disabled={loading}>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={[s.googleBtnText, { color: colors.textPrimary }]}>Continue with Google</Text>
                </Pressable>

                <View style={s.dividerRow}>
                  <View style={[s.dividerLine, { backgroundColor: colors.grass0 }]} />
                  <Text style={[s.dividerText, { color: colors.textMuted }]}>or</Text>
                  <View style={[s.dividerLine, { backgroundColor: colors.grass0 }]} />
                </View>
              </>
            )}

            {/* Display Name (sign up only) */}
            {mode === 'signup' && (
              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.textSecondary }]}>Name</Text>
                <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Email */}
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Email</Text>
              <View style={[s.inputRow, { borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
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
                <Text style={[s.label, { color: colors.textSecondary }]}>Password</Text>
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
                <Text style={[s.label, { color: colors.textSecondary }]}>Confirm Password</Text>
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
                <Text style={[s.forgotText, { color: colors.primary }]}>Forgot password?</Text>
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
                  {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
                </Text>
              )}
            </Pressable>

            {/* Mode Switch */}
            <View style={s.switchRow}>
              {mode === 'login' ? (
                <>
                  <Text style={[s.switchText, { color: colors.textSecondary }]}>Don't have an account? </Text>
                  <Pressable onPress={() => setMode('signup')}>
                    <Text style={[s.switchLink, { color: colors.primary }]}>Sign up</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setMode('login')}>
                  <Text style={[s.switchLink, { color: colors.primary }]}>← Back to Sign In</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Skip Button */}
          <Pressable style={s.skipBtn} onPress={handleSkip}>
            <Text style={[s.skipText, { color: colors.textMuted }]}>Continue without account</Text>
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
    appTagline: { ...Fonts.body, fontSize: FontSize.md, color: colors.textSecondary, marginTop: Spacing.xs },
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
  });
}
