import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Image, Alert,
} from 'react-native';
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
import MySubmissionsModal from '../../components/MySubmissionsModal';
import LoginPromptModal from '../../components/LoginPromptModal';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useUserStore((s) => s.uid);
  const displayName = useUserStore((s) => s.displayName);
  const username = useUserStore((s) => s.username);
  const photoURL = useUserStore((s) => s.photoURL);

  const { deleteQuote, updateQuote } = useCommunityStore();

  const [socialStats, setSocialStats] = useState({ followerCount: 0, followingCount: 0 });
  const [quotes, setQuotes] = useState<CommunityQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);

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
          <Pressable
            style={[s.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => setLoginPromptVisible(true)}
          >
            <Ionicons name="logo-google" size={18} color="#fff" style={{ marginRight: Spacing.sm }} />
            <Text style={s.loginBtnText}>{t('login.signInWithGoogle')}</Text>
          </Pressable>
        </View>
        <LoginPromptModal visible={loginPromptVisible} onClose={() => setLoginPromptVisible(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={s.profileSection}>
          <View style={[s.avatar, { backgroundColor: colors.primary + '40' }]}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={s.avatarImg} />
            ) : (
              <Text style={[s.avatarInitial, { color: colors.primary }]}>{initial}</Text>
            )}
          </View>
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
              <View key={q.id} style={[s.quoteCard, { backgroundColor: colors.surface }]}>
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
                    <Pressable onPress={() => handleDelete(q.id)} hitSlop={8} style={s.actionBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
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
    profileSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarImg: { width: 80, height: 80, borderRadius: 40 },
    avatarInitial: { ...Fonts.heading, fontSize: 32 },
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
  });
}
