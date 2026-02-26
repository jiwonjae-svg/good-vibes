import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing } from '../../constants/theme';
import { useGrassStore } from '../../stores/useGrassStore';
import { useUserStore } from '../../stores/useUserStore';
import GrassGrid from '../../components/GrassGrid';
import { todayString } from '../../utils/dateUtils';

export default function GrassScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { loadGrassData, isLoaded, getGrassDay } = useGrassStore();
  const currentStreak = useUserStore((s) => s.currentStreak);

  useEffect(() => { if (!isLoaded) loadGrassData(); }, [isLoaded]);

  const today = todayString();
  const todayData = getGrassDay(today);
  const todayTotal = todayData.speakCount + todayData.writeCount + todayData.typeCount;

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
            <ActivityItem icon="🎤" label={t('home.speakAlong')} count={todayData.speakCount} color={colors.textPrimary} subColor={colors.textSecondary} />
            <ActivityItem icon="✍️" label={t('home.writeAlong')} count={todayData.writeCount} color={colors.textPrimary} subColor={colors.textSecondary} />
            <ActivityItem icon="⌨️" label={t('home.typeAlong')} count={todayData.typeCount} color={colors.textPrimary} subColor={colors.textSecondary} />
          </View>
          {todayTotal === 0 && (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('grass.emptyHint')}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityItem({ icon, label, count, color, subColor }: { icon: string; label: string; count: number; color: string; subColor: string }) {
  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <Text style={[styles.activityCount, { color }]}>{count}</Text>
      <Text style={[styles.activityLabel, { color: subColor }]}>{label}</Text>
    </View>
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
  todayCard: { margin: Spacing.md, borderRadius: 16, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  todayTitle: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.md, textAlign: 'center' },
  todayRow: { flexDirection: 'row', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 4 },
  activityIcon: { fontSize: 28 },
  activityCount: { ...Fonts.heading, fontSize: FontSize.xl },
  activityLabel: { ...Fonts.body, fontSize: FontSize.xs },
  emptyHint: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.md },
});
