import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Image, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { useCommunityStore } from '../../stores/useCommunityStore';
import { fetchMySubmissions, type CommunityQuote } from '../../services/communityService';
import { fetchPublicUserProfile } from '../../services/firestoreUserService';
import { signInWithGoogleNative } from '../../services/authService';
import { appLog } from '../../services/logger';
import GoogleSignInConfirmModal from '../../components/GoogleSignInConfirmModal';
import ProfileSetupModal from '../../components/ProfileSetupModal';
import EditProfileModal from '../../components/EditProfileModal';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useUserStore((s) => s.uid);
  const displayName = useUserStore((s) => s.displayName);
  const username = useUserStore((s) => s.username);
  const photoURL = useUserStore((s) => s.photoURL);
  const isDark = useUserStore((s) => s.isDarkMode);

  const setAuth = useUserStore((s) => s.setAuth);
  const setAuthCompleted = useUserStore((s) => s.setAuthCompleted);
  const setProfile = useUserStore((s) => s.setProfile);

  const { deleteQuote, updateQuote } = useCommunityStore();

  const [socialStats, setSocialStats] = useState({ followerCount: 0, followingCount: 0 });
  const [quotes, setQuotes] = useState<CommunityQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Guest sign-in state
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [profileSetupVisible, setProfileSetupVisible] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null>(null);
  // Edit profile state
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  // Quote detail modal
  const [selectedQuote, setSelectedQuote] = useState<CommunityQuote | null>(null);

  const initial = (displayName || username || '?').charAt(0).toUpperCase();

  const loadQuotes = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [results, profile] = await Promise.all([
        fetchMySubmissions(uid, 50),
        fetchPublicUserProfile(uid),
      ]);
      setQuotes(results);
      if (profile) setSocialStats({ followerCount: profile.followerCount, followingCount: profile.followingCount });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Reload when the tab is focused (e.g. after submitting a new quote)
  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [loadQuotes]),
  );

  const handleGuestSignIn = async () => {
    setSignInError(null);
    setSigningIn(true);
    appLog.log('[profile] guest sign-in pressed');
    try {
      const user = await signInWithGoogleNative();
      if (user) {
        appLog.log('[profile] signed in', { uid: user.uid });
        await setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        const currentUsername = useUserStore.getState().username;
        if (!currentUsername) {
          // New user — show info/consent modal first
          setPendingUser({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
          setConfirmVisible(true);
        } else {
          await setAuthCompleted();
        }
      }
    } catch (err: any) {
      appLog.error('[profile] sign-in failed', { err: err?.message });
      setSignInError(t('login.signInFailed'));
    } finally {
      setSigningIn(false);
    }
  };

  const handleConfirmAgree = () => {
    setConfirmVisible(false);
    setProfileSetupVisible(true);
  };

  const handleProfileComplete = async (displayName: string, username: string) => {
    await setProfile(displayName, username);
    await setAuthCompleted();
    setProfileSetupVisible(false);
  };

  const handleProfileSkip = async () => {
    const randomSuffix = Date.now().toString(36).slice(-6);
    const randomUsername = `user_${randomSuffix}`;
    const name = pendingUser?.displayName ?? 'User';
    try { await setProfile(name, randomUsername); } catch { }
    await setAuthCompleted();
    setProfileSetupVisible(false);
  };

  const handleOpenEditProfile = () => {
    setEditProfileVisible(true);
  };

  const handleSaveProfile = async (name: string, uname: string, photo?: string) => {
    await setProfile(name, uname, photo);
  };

  const handleDelete = (quoteId: string) => {
    Alert.alert(
      t('community.delete'),
      t('community.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('community.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!uid) return;
            try {
              await deleteQuote(uid, quoteId);
              setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
            } catch {
              Alert.alert(t('common.error'), t('common.errorMessage'));
            }
          },
        },
      ],
    );
  };

  const s = makeStyles(colors);

  if (!uid) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.centered}>
          <Ionicons name="person-circle-outline" size={80} color={colors.textMuted} />
          <Text style={[s.guestTitle, { color: colors.textPrimary }]}>{t('profile.guestTitle')}</Text>
          <Text style={[s.guestText, { color: colors.textSecondary }]}>{t('profile.guestDesc')}</Text>
          {signInError && (
            <Text style={[s.errorText, { color: colors.error }]}>{signInError}</Text>
          )}
          <Pressable
            style={[s.loginBtn, { backgroundColor: colors.primary, opacity: signingIn ? 0.7 : 1 }]}
            onPress={handleGuestSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#fff" style={{ marginRight: Spacing.sm }} />
                <Text style={s.loginBtnText}>{t('login.signInWithGoogle')}</Text>
              </>
            )}
          </Pressable>
        </View>
        <GoogleSignInConfirmModal
          visible={confirmVisible}
          email={pendingUser?.email ?? null}
          onConfirm={handleConfirmAgree}
          onCancel={() => setConfirmVisible(false)}
        />
        <ProfileSetupModal
          visible={profileSetupVisible}
          initialDisplayName={pendingUser?.displayName}
          onComplete={handleProfileComplete}
          onSkip={handleProfileSkip}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        displayName={displayName ?? ''}
        username={username ?? ''}
        photoURL={photoURL}
        onSave={handleSaveProfile}
      />

      {/* Quote detail modal — DailyQuoteModal style */}
      <Modal
        transparent
        visible={!!selectedQuote}
        animationType="fade"
        onRequestClose={() => setSelectedQuote(null)}
      >
        <Pressable style={s.qModalOverlay} onPress={() => setSelectedQuote(null)}>
          <Pressable style={[s.qModalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={s.qModalHeader}>
              <View style={s.qModalTitleRow}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[s.qModalTitle, { color: colors.textPrimary }]}>{t('community.myQuotes')}</Text>
              </View>
              <Pressable onPress={() => setSelectedQuote(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            {/* Gradient quote card */}
            <LinearGradient
              colors={isDark ? ['#1a1a3a', '#2d1b69'] : ['#FFE5D9', '#E8D4FF']}
              style={s.qModalCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[s.qModalText, { color: colors.textPrimary }]}>{selectedQuote?.text}</Text>
              {selectedQuote?.author ? (
                <Text style={[s.qModalAuthor, { color: colors.textSecondary }]}>— {selectedQuote.author}</Text>
              ) : null}
            </LinearGradient>
            {/* Likes */}
            <View style={s.qModalLikesRow}>
              <Ionicons name="heart" size={16} color={colors.error} />
              <Text style={[s.qModalLikesText, { color: colors.textMuted }]}>{selectedQuote?.likeCount ?? 0}</Text>
            </View>
            {/* Close */}
            <Pressable onPress={() => setSelectedQuote(null)} style={s.qModalCloseBtn}>
              <Text style={[s.qModalCloseBtnText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={s.profileSection}>
          <Pressable onPress={handleOpenEditProfile} style={s.avatarWrapper}>
            <View style={[s.avatar, { backgroundColor: colors.primary + '40' }]}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={s.avatarImg} />
              ) : (
                <Text style={[s.avatarInitial, { color: colors.primary }]}>{initial}</Text>
              )}
            </View>
            <View style={[s.editBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          </Pressable>
          <Text style={[s.displayName, { color: colors.textPrimary }]}>{displayName || username}</Text>
          {username ? (
            <Text style={[s.username, { color: colors.textSecondary }]}>@{username}</Text>
          ) : null}

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statCount, { color: colors.textPrimary }]}>{socialStats.followerCount}</Text>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.followers')}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.grass0 }]} />
            <View style={s.statItem}>
              <Text style={[s.statCount, { color: colors.textPrimary }]}>{socialStats.followingCount}</Text>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.following')}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.grass0 }]} />
            <View style={s.statItem}>
              <Text style={[s.statCount, { color: colors.textPrimary }]}>{quotes.length}</Text>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.myQuotes')}</Text>
            </View>
          </View>
        </View>

        {/* My quotes section */}
        <View style={s.quotesSection}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t('community.myQuotes')}</Text>
          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : quotes.length === 0 ? (
            <View style={s.emptyQuotes}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text style={[s.emptyText, { color: colors.textMuted }]}>{t('profile.noQuotes')}</Text>
            </View>
          ) : (
            quotes.map((q) => (
              <Pressable key={q.id} style={[s.quoteCard, { backgroundColor: colors.surface }]} onPress={() => setSelectedQuote(q)}>
                <Text style={[s.quoteText, { color: colors.textPrimary }]} numberOfLines={4}>
                  "{q.text}"
                </Text>
                {q.author ? (
                  <Text style={[s.quoteAuthor, { color: colors.textSecondary }]}>— {q.author}</Text>
                ) : null}
                <View style={s.quoteFooter}>
                  <View style={s.likesRow}>
                    <Ionicons name="heart" size={12} color={colors.error} />
                    <Text style={[s.footerText, { color: colors.textMuted }]}>{q.likeCount}</Text>
                  </View>
                  <View style={s.cardActions}>
                    <Pressable onPress={(e) => { e.stopPropagation(); handleDelete(q.id); }} hitSlop={8} style={s.actionBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
    guestTitle: { ...Fonts.heading, fontSize: FontSize.xl, textAlign: 'center', marginTop: Spacing.sm },
    guestText: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.sm },
    loginBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
    loginBtnText: { ...Fonts.heading, fontSize: FontSize.sm, color: '#fff' },
    errorText: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center' },
    profileSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarImg: { width: 80, height: 80, borderRadius: 40 },
    avatarInitial: { ...Fonts.heading, fontSize: 32 },
    editBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    displayName: { ...Fonts.heading, fontSize: FontSize.xl, marginTop: Spacing.sm },
    username: { ...Fonts.body, fontSize: FontSize.sm },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.lg },
    statItem: { alignItems: 'center', gap: 2 },
    statCount: { ...Fonts.heading, fontSize: FontSize.lg },
    statLabel: { ...Fonts.body, fontSize: FontSize.xs },
    statDivider: { width: 1, height: 28 },
    quotesSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
    sectionTitle: { ...Fonts.heading, fontSize: FontSize.md, marginBottom: Spacing.xs },
    emptyQuotes: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    emptyText: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center' },
    quoteCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.xs, ...Shadows.card },
    quoteText: { ...Fonts.quote, fontSize: FontSize.md, lineHeight: 22 },
    quoteAuthor: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic' },
    quoteFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    likesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: { ...Fonts.body, fontSize: FontSize.xs },
    cardActions: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: { padding: 4 },
    // Quote detail modal (DailyQuoteModal style)
    qModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    qModalSheet: { width: '100%', maxWidth: 360, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.card },
    qModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    qModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    qModalTitle: { ...Fonts.heading, fontSize: FontSize.lg },
    qModalCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.lg },
    qModalText: { ...Fonts.quote, fontSize: FontSize.md, lineHeight: 26, letterSpacing: 0.2 },
    qModalAuthor: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'right', marginTop: 4 },
    qModalLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginBottom: Spacing.md },
    qModalLikesText: { ...Fonts.body, fontSize: FontSize.sm },
    qModalCloseBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
    qModalCloseBtnText: { ...Fonts.body, fontSize: FontSize.sm },
  });
}
