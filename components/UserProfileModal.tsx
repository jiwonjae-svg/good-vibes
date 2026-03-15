import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import ProfileAvatar from './ProfileAvatar';
import {
  fetchPublicUserProfile,
  checkIsFollowing,
  followUser,
  unfollowUser,
  fetchFollowerList,
  fetchFollowingList,
  type PublicUserProfile,
  type FollowUser,
} from '../services/firestoreUserService';
import { fetchCommunityQuotesByUser, type CommunityQuote } from '../services/communityService';
import { useUserStore } from '../stores/useUserStore';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  targetUid: string;
  targetName: string;
  targetPhotoURL?: string | null;
}

export default function UserProfileModal({
  visible, onClose, targetUid, targetName, targetPhotoURL,
}: UserProfileModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const myUid = useUserStore((s) => s.uid);
  const myDisplayName = useUserStore((s) => s.displayName);
  const myUsername = useUserStore((s) => s.username);
  const myStorePhotoURL = useUserStore((s) => s.photoURL);
  const myFollowerCount = useUserStore((s) => s.followerCount);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [quotes, setQuotes] = useState<CommunityQuote[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Follow list modal state
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const isOwnProfile = myUid === targetUid;

  useEffect(() => {
    if (!visible || !targetUid) return;
    setLoading(true);
    setLoadError(false);
    const loadAll = async () => {
      try {
        const [prof, qs, following] = await Promise.all([
          fetchPublicUserProfile(targetUid),
          fetchCommunityQuotesByUser(targetUid, 20),
          myUid && !isOwnProfile ? checkIsFollowing(myUid, targetUid) : Promise.resolve(false),
        ]);
        // For own profile: don't require Firestore doc — use local store as fallback
        if (myUid && !prof && !isOwnProfile) {
          setLoadError(true);
          return;
        }
        // Use Firestore data if available; otherwise fall back to local store for own profile
        setProfile(prof ?? (isOwnProfile ? {
          uid: myUid,
          displayName: myDisplayName,
          username: myUsername,
          photoURL: myStorePhotoURL,
          followerCount: myFollowerCount ?? 0,
          followingCount: 0,
        } : null));
        setQuotes(qs);
        setIsFollowing(following);
      } catch {
        if (!isOwnProfile) {
          setLoadError(true);
        } else {
          // Own profile: show local data even if Firestore fails
          setProfile({
            uid: myUid!,
            displayName: myDisplayName,
            username: myUsername,
            photoURL: myStorePhotoURL,
            followerCount: myFollowerCount ?? 0,
            followingCount: 0,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [visible, targetUid]);

  const handleFollowToggle = async () => {
    if (!myUid || isOwnProfile) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setProfile((p) => p ? {
      ...p,
      followerCount: wasFollowing ? Math.max(0, p.followerCount - 1) : p.followerCount + 1,
    } : p);
    try {
      if (wasFollowing) {
        await unfollowUser(myUid, targetUid);
      } else {
        await followUser(myUid, targetUid, myDisplayName, myStorePhotoURL);
      }
    } catch {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setProfile((p) => p ? {
        ...p,
        followerCount: wasFollowing ? p.followerCount + 1 : Math.max(0, p.followerCount - 1),
      } : p);
      Alert.alert(t('common.error'), t('common.errorMessage'));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenFollowList = async (type: 'followers' | 'following') => {
    setFollowListType(type);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      const list = type === 'followers'
        ? await fetchFollowerList(targetUid)
        : await fetchFollowingList(isOwnProfile ? myUid! : targetUid);
      setFollowList(list);
    } catch { /* silently fail */ } finally {
      setFollowListLoading(false);
    }
  };

  const s = makeStyles(colors);
  const displayName = profile?.displayName ?? targetName;
  const username = profile?.username;
  const photoURL = profile?.photoURL ?? targetPhotoURL;
  const initial = (displayName || '?').charAt(0).toUpperCase();

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.grass0 }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t('profile.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={s.centered}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[s.errorText, { color: colors.textMuted }]}>{t('common.errorMessage')}</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Profile section */}
            <View style={s.profileSection}>
              <View style={{ position: 'relative' }}>
                <ProfileAvatar
                  photoURL={photoURL}
                  displayName={displayName}
                  size={72}
                  backgroundColor={colors.primary + '40'}
                  textColor={colors.primary}
                  style={s.avatar}
                />
                {isOwnProfile && (
                  <Pressable
                    style={[s.editAvatarBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { onClose(); router.push('/(tabs)/settings'); }}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil" size={12} color="#fff" />
                  </Pressable>
                )}
              </View>
              <Text style={[s.displayName, { color: colors.textPrimary }]}>{displayName}</Text>
              {username ? (
                <Text style={[s.username, { color: colors.textSecondary }]}>@{username}</Text>
              ) : null}

              {/* Follower / Following counts — tappable */}
              <View style={s.statsRow}>
                <Pressable style={s.statItem} onPress={() => handleOpenFollowList('followers')} hitSlop={8}>
                  <Text style={[s.statCount, { color: colors.textPrimary }]}>
                    {profile?.followerCount ?? 0}
                  </Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.followers')}</Text>
                </Pressable>
                <View style={s.statDivider} />
                <Pressable style={s.statItem} onPress={() => handleOpenFollowList('following')} hitSlop={8}>
                  <Text style={[s.statCount, { color: colors.textPrimary }]}>
                    {profile?.followingCount ?? 0}
                  </Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.following')}</Text>
                </Pressable>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statCount, { color: colors.textPrimary }]}>{quotes.length}</Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('profile.myQuotes')}</Text>
                </View>
              </View>

              {/* Follow button */}
              {myUid && !isOwnProfile && (
                <Pressable
                  style={[
                    s.followBtn,
                    { backgroundColor: isFollowing ? colors.surface : colors.primary, borderColor: isFollowing ? colors.grass0 : colors.primary },
                  ]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={isFollowing ? colors.textSecondary : '#fff'} />
                  ) : (
                    <Text style={[s.followBtnText, { color: isFollowing ? colors.textSecondary : '#fff' }]}>
                      {isFollowing ? t('profile.unfollow') : t('profile.follow')}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* Quotes list */}
            <View style={s.quotesSection}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t('profile.myQuotes')}</Text>
              {quotes.length === 0 ? (
                <View style={s.emptyQuotes}>
                  <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
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
                      <Ionicons name="heart" size={12} color={colors.error} />
                      <Text style={[s.quoteFooterText, { color: colors.textMuted }]}>{q.likeCount}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>

    {/* Follow list bottom sheet (followers / following) */}
    <Modal
      visible={followListType !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setFollowListType(null)}
    >
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[s.header, { borderBottomColor: colors.grass0 }]}>
          <Pressable onPress={() => setFollowListType(null)} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
            {followListType === 'followers' ? t('profile.followerList') : t('profile.followingList')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        {followListLoading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : followList.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[s.errorText, { color: colors.textMuted }]}>
              {followListType === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingVertical: Spacing.sm }}>
            {followList.map((user) => (
              <Pressable
                key={user.uid}
                style={[s.followUserRow, { borderBottomColor: colors.grass0 }]}
                onPress={() => {
                  setFollowListType(null);
                  // Open this user's profile after a short delay (modal close animation)
                  setTimeout(() => {
                    onClose(); // close outer modal first
                  }, 200);
                }}
              >
                <ProfileAvatar
                  photoURL={user.photoURL}
                  displayName={user.displayName}
                  size={40}
                  backgroundColor={colors.primary + '40'}
                  textColor={colors.primary}
                />
                <View style={s.followUserInfo}>
                  <Text style={[s.followUserName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {user.displayName ?? user.uid}
                  </Text>
                  {user.username ? (
                    <Text style={[s.followUserHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                      @{user.username}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
    </>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { ...Fonts.heading, fontSize: FontSize.md },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    errorText: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
    profileSection: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 80, height: 80, borderRadius: 40 },
    avatarInitial: { ...Fonts.heading, fontSize: 32 },
    editAvatarBtn: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    displayName: { ...Fonts.heading, fontSize: FontSize.xl, marginTop: Spacing.sm },
    username: { ...Fonts.body, fontSize: FontSize.sm },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.md,
      gap: Spacing.lg,
    },
    statItem: { alignItems: 'center', gap: 2 },
    statCount: { ...Fonts.heading, fontSize: FontSize.lg },
    statLabel: { ...Fonts.body, fontSize: FontSize.xs },
    statDivider: { width: 1, height: 28, backgroundColor: 'rgba(128,128,128,0.2)' },
    followBtn: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1.5,
      minWidth: 120,
      alignItems: 'center',
    },
    followBtnText: { ...Fonts.heading, fontSize: FontSize.sm },
    quotesSection: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    sectionTitle: { ...Fonts.heading, fontSize: FontSize.md, marginBottom: Spacing.xs },
    emptyQuotes: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    emptyText: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center' },
    quoteCard: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.xs,
      ...Shadows.card,
    },
    quoteText: { ...Fonts.quote, fontSize: FontSize.md, lineHeight: 22 },
    quoteAuthor: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic' },
    quoteFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    quoteFooterText: { ...Fonts.body, fontSize: FontSize.xs },
    followUserRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    followUserInfo: { flex: 1, gap: 2 },
    followUserName: { ...Fonts.heading, fontSize: FontSize.sm },
    followUserHandle: { ...Fonts.body, fontSize: FontSize.xs },
  });
}
