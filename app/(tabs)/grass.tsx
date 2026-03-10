import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { GRASS_CONFIG } from '../../constants/config';
import { useGrassStore, ActivityQuote } from '../../stores/useGrassStore';
import { useUserStore } from '../../stores/useUserStore';
import GrassGrid from '../../components/GrassGrid';
import LoginPromptModal from '../../components/LoginPromptModal';
import { todayString } from '../../utils/dateUtils';

const MIC_ICON = require('../../assets/mic-elem-icon.png');
const WRITING_ICON = require('../../assets/writing-elem-icon.png');
const KEYBOARD_ICON = require('../../assets/keyboard-elem-icon.png');

type ActivityType = 'speak' | 'write' | 'type';

export default function GrassScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { loadGrassData, isLoaded, getGrassDay, getActivityQuotes, grassData } = useGrassStore();
  const currentStreak = useUserStore((s) => s.currentStreak);
  const earnedBadges = useUserStore((s) => s.earnedBadges);
  const earnedBadgeDates = useUserStore((s) => s.earnedBadgeDates);
  const uid = useUserStore((s) => s.uid);
  const isGuest = !uid;

  const BADGE_DISPLAY: Record<string, { emoji: string; titleKey: string }> = {
    streak_7:   { emoji: '\uD83D\uDD25', titleKey: 'badge.streak7Title' },
    streak_30:  { emoji: '\u2B50', titleKey: 'badge.streak30Title' },
    streak_100: { emoji: '\uD83D\uDC51', titleKey: 'badge.streak100Title' },
    streak_365: { emoji: '\uD83C\uDFC6', titleKey: 'badge.streak365Title' },
  };

  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);

  useEffect(() => { if (!isLoaded) loadGrassData(); }, [isLoaded]);

  useEffect(() => {
    if (isGuest) {
      const timer = setTimeout(() => {
        setLoginPromptVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isGuest]);

  const today = todayString();
  const todayData = getGrassDay(today);
  const todayTotal = todayData.speakCount + todayData.writeCount + todayData.typeCount;

  // Calculate this week's total activity count
  const WEEKLY_GOAL = GRASS_CONFIG.weeklyGoal;
  const weeklyTotal = React.useMemo(() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = getGrassDay(key);
      count += day.speakCount + day.writeCount + day.typeCount;
      d.setDate(d.getDate() - 1);
    }
    return Math.min(count, WEEKLY_GOAL * 2); // cap display but show real numbers in text
  }, [grassData, getGrassDay, WEEKLY_GOAL]);
  const weeklyGoalMet = weeklyTotal >= WEEKLY_GOAL;

  const handleActivityPress = (type: ActivityType) => {
    setSelectedActivityType(type);
    setActivityModalVisible(true);
  };

  const getActivityLabel = (type: ActivityType) => {
    switch (type) {
      case 'speak': return t('home.speakAlong');
      case 'write': return t('home.writeAlong');
      case 'type': return t('home.typeAlong');
    }
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'speak': return 'mic-outline';
      case 'write': return 'pencil-outline';
      case 'type': return 'keypad-outline';
    }
  };

  const getActivityImage = (type: ActivityType) => {
    switch (type) {
      case 'speak': return MIC_ICON;
      case 'write': return WRITING_ICON;
      case 'type': return KEYBOARD_ICON;
    }
  };

  const activityQuotes = selectedActivityType ? getActivityQuotes(today, selectedActivityType) : [];

  // Show spinner while data is loading (only for logged-in users)
  if (!isLoaded && !isGuest) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isGuest) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={[styles.header, { color: colors.textPrimary }]}>{t('grass.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('grass.subtitle')}</Text>

          <View style={[styles.guestCard, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.guestIconWrapper, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="lock-closed-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.guestTitle, { color: colors.textPrimary }]}>{t('guest.loginPromptTitle')}</Text>
            <Text style={[styles.guestDesc, { color: colors.textSecondary }]}>
              {t('settings.guestModeDesc')}
            </Text>
            <Pressable
              style={[styles.guestLoginBtn, { backgroundColor: colors.primary }]}
              onPress={() => setLoginPromptVisible(true)}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.guestLoginText}>{t('guest.loginPromptAction')}</Text>
            </Pressable>
          </View>

          <View style={styles.lockedPreview}>
            <View style={[styles.lockedOverlay, { backgroundColor: colors.background + 'E0' }]}>
              <Ionicons name="eye-off-outline" size={24} color={colors.textMuted} />
              <Text style={[styles.lockedText, { color: colors.textMuted }]}>{t('settings.loginRequired')}</Text>
            </View>
            <GrassGrid />
          </View>
        </ScrollView>

        <LoginPromptModal
          visible={loginPromptVisible}
          onClose={() => setLoginPromptVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.header, { color: colors.textPrimary }]}>{t('grass.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('grass.subtitle')}</Text>

        {currentStreak > 1 && (
          <View style={[styles.streakCard, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.streakText, { color: colors.primary }]}>🔥 {currentStreak}{t('grass.streak')}</Text>
            <Text style={[styles.streakSub, { color: colors.textSecondary }]}>{t('grass.streakCongrats')}</Text>
          </View>
        )}

        <GrassGrid />

        {/* Weekly goal progress */}
        <View style={[styles.weeklyCard, { backgroundColor: colors.surface }]}>
          <View style={styles.weeklyHeader}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.weeklyTitle, { color: colors.textPrimary }]}>{t('grass.weeklyGoal')}</Text>
            <Text style={[styles.weeklyCount, { color: weeklyGoalMet ? colors.success : colors.textSecondary }]}>
              {t('grass.weeklyProgress', { count: weeklyTotal, goal: WEEKLY_GOAL })}
            </Text>
          </View>
          <View style={[styles.weeklyBarBg, { backgroundColor: colors.grass0 }]}>
            <View style={[styles.weeklyBarFill, { width: `${Math.min((weeklyTotal / WEEKLY_GOAL) * 100, 100)}%`, backgroundColor: weeklyGoalMet ? colors.success : colors.primary }]} />
          </View>
        </View>

        <View style={[styles.todayCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.todayTitle, { color: colors.textPrimary }]}>{t('grass.todayActivity')}</Text>
          <View style={styles.todayRow}>
            <ActivityItem
              iconSource={getActivityImage('speak')}
              label={t('home.speakAlong')}
              count={todayData.speakCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              iconTint={colors.primary}
              onPress={() => handleActivityPress('speak')}
              hasQuotes={todayData.speakCount > 0}
            />
            <ActivityItem
              iconSource={getActivityImage('write')}
              label={t('home.writeAlong')}
              count={todayData.writeCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              iconTint={colors.secondary}
              onPress={() => handleActivityPress('write')}
              hasQuotes={todayData.writeCount > 0}
            />
            <ActivityItem
              iconSource={getActivityImage('type')}
              label={t('home.typeAlong')}
              count={todayData.typeCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              iconTint={colors.accent}
              onPress={() => handleActivityPress('type')}
              hasQuotes={todayData.typeCount > 0}
            />
          </View>
          {todayTotal === 0 && (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('grass.emptyHint')}</Text>
          )}
        </View>

        {/* Milestone Badges */}
        <View style={[styles.badgesCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.badgesTitle, { color: colors.textPrimary }]}>{t('grass.badges')}</Text>
          {earnedBadges.length === 0 ? (
            <>
              <Text style={[styles.noBadgesText, { color: colors.textSecondary }]}>{t('grass.noBadges')}</Text>
              <Text style={[styles.noBadgesHint, { color: colors.textMuted }]}>{t('grass.noBadgesHint')}</Text>
            </>
          ) : (
            <View style={styles.badgesGrid}>
              {earnedBadges.map((badge) => (
                <View key={badge} style={[styles.badgeChip, { backgroundColor: colors.primaryLight + '22' }]}>
                  <Text style={styles.badgeEmoji}>{BADGE_DISPLAY[badge]?.emoji ?? '\uD83C\uDFC5'}</Text>
                  <View>
                    <Text style={[styles.badgeName, { color: colors.textPrimary }]}>{t(BADGE_DISPLAY[badge]?.titleKey ?? badge)}</Text>
                    {earnedBadgeDates[badge] && (
                      <Text style={[styles.badgeDate, { color: colors.textMuted }]}>{t('grass.badgeEarned', { date: earnedBadgeDates[badge] })}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={activityModalVisible}
        animationType="fade"
        onRequestClose={() => setActivityModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActivityModalVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.grass0 }]}>
              {selectedActivityType && (
                <View style={styles.modalTitleRow}>
                  <Ionicons name={getActivityIcon(selectedActivityType)} size={24} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    {getActivityLabel(selectedActivityType)}
                  </Text>
                </View>
              )}
              <Pressable onPress={() => setActivityModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {activityQuotes.length === 0 ? (
              <View style={styles.emptyModal}>
                <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyModalText, { color: colors.textSecondary }]}>
                  {t('grass.noActivityQuotes')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={activityQuotes}
                keyExtractor={(item, idx) => `${item.id}-${idx}`}
                renderItem={({ item }) => (
                  <View style={[styles.quoteItem, { borderBottomColor: colors.grass0 }]}>
                    <Text style={[styles.quoteItemText, { color: colors.textPrimary }]} numberOfLines={3}>
                      {item.text}
                    </Text>
                    <Text style={[styles.quoteItemTime, { color: colors.textMuted }]}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

interface ActivityItemProps {
  iconSource: any;
  label: string;
  count: number;
  color: string;
  subColor: string;
  iconTint: string;
  onPress: () => void;
  hasQuotes: boolean;
}

function ActivityItem({ iconSource, label, count, color, subColor, iconTint, onPress, hasQuotes }: ActivityItemProps) {
  return (
    <Pressable style={styles.activityItem} onPress={onPress} disabled={!hasQuotes}>
      <Image 
        source={iconSource} 
        style={[styles.activityIcon, { tintColor: iconTint }]}
        resizeMode="contain"
      />
      <Text style={[styles.activityCount, { color }]}>{count}</Text>
      <Text style={[styles.activityLabel, { color: subColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingTop: Spacing.md },
  header: { ...Fonts.heading, fontSize: FontSize.xl, marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
  subtitle: { ...Fonts.body, fontSize: FontSize.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  streakCard: { marginHorizontal: Spacing.md, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.md, alignItems: 'center' },
  streakText: { ...Fonts.heading, fontSize: FontSize.lg },
  streakSub: { ...Fonts.body, fontSize: FontSize.sm, marginTop: 4 },
  todayCard: { margin: Spacing.md, borderRadius: 16, padding: Spacing.lg, ...Shadows.floating },
  todayTitle: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.md, textAlign: 'center' },
  todayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 4, paddingVertical: Spacing.sm },
  activityIcon: { width: 32, height: 32 },
  activityCount: { ...Fonts.heading, fontSize: FontSize.xl },
  activityLabel: { ...Fonts.body, fontSize: FontSize.xs },
  emptyHint: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.md },
  guestCard: {
    margin: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  guestIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  guestTitle: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.sm, textAlign: 'center' },
  guestDesc: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20 },
  guestLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  guestLoginText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
  lockedPreview: {
    position: 'relative',
    marginHorizontal: Spacing.md,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  lockedText: { ...Fonts.body, fontSize: FontSize.sm },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalSheet: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: { ...Fonts.heading, fontSize: FontSize.lg },
  emptyModal: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyModalText: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center' },
  quoteItem: {
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quoteItemText: { ...Fonts.body, fontSize: FontSize.sm, lineHeight: 22 },
  quoteItemTime: { ...Fonts.body, fontSize: FontSize.xs, marginTop: Spacing.xs },
  badgesCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, marginTop: 0, borderRadius: 16, padding: Spacing.lg, ...Shadows.floating },
  badgesTitle: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.md },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  badgeEmoji: { fontSize: 20 },
  badgeName: { ...Fonts.body, fontSize: FontSize.sm },
  badgeDate: { ...Fonts.body, fontSize: FontSize.xs - 1, marginTop: 1 },
  noBadgesText: { ...Fonts.body, fontSize: FontSize.md, marginBottom: Spacing.xs },
  noBadgesHint: { ...Fonts.body, fontSize: FontSize.xs },
  weeklyCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.floating },
  weeklyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  weeklyTitle: { ...Fonts.heading, fontSize: FontSize.sm, flex: 1 },
  weeklyCount: { ...Fonts.body, fontSize: FontSize.sm },
  weeklyBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  weeklyBarFill: { height: '100%', borderRadius: 4 },
});
