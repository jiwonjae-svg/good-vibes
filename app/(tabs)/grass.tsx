import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useGrassStore, ActivityQuote } from '../../stores/useGrassStore';
import { useUserStore } from '../../stores/useUserStore';
import GrassGrid from '../../components/GrassGrid';
import LoginPromptModal from '../../components/LoginPromptModal';
import { todayString } from '../../utils/dateUtils';

type ActivityType = 'speak' | 'write' | 'type';

export default function GrassScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { loadGrassData, isLoaded, getGrassDay, getActivityQuotes } = useGrassStore();
  const currentStreak = useUserStore((s) => s.currentStreak);
  const uid = useUserStore((s) => s.uid);
  const isGuest = !uid;

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

  const activityQuotes = selectedActivityType ? getActivityQuotes(today, selectedActivityType) : [];

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

        <View style={[styles.todayCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.todayTitle, { color: colors.textPrimary }]}>{t('grass.todayActivity')}</Text>
          <View style={styles.todayRow}>
            <ActivityItem
              icon="🎤"
              label={t('home.speakAlong')}
              count={todayData.speakCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              onPress={() => handleActivityPress('speak')}
              hasQuotes={todayData.speakCount > 0}
            />
            <ActivityItem
              icon="✍️"
              label={t('home.writeAlong')}
              count={todayData.writeCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              onPress={() => handleActivityPress('write')}
              hasQuotes={todayData.writeCount > 0}
            />
            <ActivityItem
              icon="⌨️"
              label={t('home.typeAlong')}
              count={todayData.typeCount}
              color={colors.textPrimary}
              subColor={colors.textSecondary}
              onPress={() => handleActivityPress('type')}
              hasQuotes={todayData.typeCount > 0}
            />
          </View>
          {todayTotal === 0 && (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('grass.emptyHint')}</Text>
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
  icon: string;
  label: string;
  count: number;
  color: string;
  subColor: string;
  onPress: () => void;
  hasQuotes: boolean;
}

function ActivityItem({ icon, label, count, color, subColor, onPress, hasQuotes }: ActivityItemProps) {
  return (
    <Pressable style={styles.activityItem} onPress={onPress} disabled={!hasQuotes}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <Text style={[styles.activityCount, { color }]}>{count}</Text>
      <Text style={[styles.activityLabel, { color: subColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  activityIcon: { fontSize: 28 },
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
});
