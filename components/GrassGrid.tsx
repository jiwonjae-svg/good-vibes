import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Spacing, BorderRadius, FontSize, Fonts } from '../constants/theme';
import { useGrassStore } from '../stores/useGrassStore';
import { getPastDays, getDayOfWeek } from '../utils/dateUtils';

const CELL_SIZE = 14;
const GAP = 3;
const DAYS_TO_SHOW = 365;

export default function GrassGrid() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { getLevel, grassData, getTotalForDay } = useGrassStore();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const LEVEL_COLORS = [colors.grass0, colors.grass1, colors.grass2, colors.grass3, colors.grass4];

  const days = useMemo(() => getPastDays(DAYS_TO_SHOW), []);
  const weeks = useMemo(() => {
    const result: string[][] = [];
    let currentWeek: string[] = [];
    const firstDayOfWeek = getDayOfWeek(days[0]);
    for (let i = 0; i < firstDayOfWeek; i++) currentWeek.push('');
    for (const day of days) {
      currentWeek.push(day);
      if (currentWeek.length === 7) { result.push(currentWeek); currentWeek = []; }
    }
    if (currentWeek.length > 0) result.push(currentWeek);
    return result;
  }, [days]);

  const totalActivities = useMemo(() =>
    Object.values(grassData).reduce((sum, day) => sum + day.speakCount + day.writeCount + day.typeCount, 0),
    [grassData]);

  const activeDays = useMemo(() =>
    Object.values(grassData).filter((day) => day.speakCount + day.writeCount + day.typeCount > 0).length,
    [grassData]);

  const handleCellPress = (day: string) => {
    if (day) setSelectedDay(day);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, dayNum] = dateStr.split('-');
    return `${year}. ${month}. ${dayNum}`;
  };

  const selectedDayData = selectedDay ? grassData[selectedDay] : null;
  const selectedTotal = selectedDay ? getTotalForDay(selectedDay) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Tooltip Modal */}
      <Modal transparent visible={!!selectedDay} animationType="fade" onRequestClose={() => setSelectedDay(null)}>
        <Pressable style={styles.tooltipOverlay} onPress={() => setSelectedDay(null)}>
          <View style={[styles.tooltip, { backgroundColor: colors.surface }]}>
            <Text style={[styles.tooltipDate, { color: colors.textPrimary }]}>
              {selectedDay && formatDate(selectedDay)}
            </Text>
            <Text style={[styles.tooltipValue, { color: colors.primary }]}>
              {selectedTotal}{t('grass.activities')}
            </Text>
            {selectedDayData && (
              <View style={styles.tooltipDetails}>
                {selectedDayData.speakCount > 0 && (
                  <Text style={[styles.tooltipDetail, { color: colors.textSecondary }]}>
                    🎤 {selectedDayData.speakCount}
                  </Text>
                )}
                {selectedDayData.writeCount > 0 && (
                  <Text style={[styles.tooltipDetail, { color: colors.textSecondary }]}>
                    ✍️ {selectedDayData.writeCount}
                  </Text>
                )}
                {selectedDayData.typeCount > 0 && (
                  <Text style={[styles.tooltipDetail, { color: colors.textSecondary }]}>
                    ⌨️ {selectedDayData.typeCount}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{totalActivities}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('grass.totalActivities')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{activeDays}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('grass.activeDays')}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekColumn}>
              {week.map((day, di) => (
                <Pressable
                  key={`${wi}-${di}`}
                  onPress={() => handleCellPress(day)}
                  disabled={!day}
                >
                  <View style={[styles.cell, { backgroundColor: day ? LEVEL_COLORS[getLevel(day)] : 'transparent' }]} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{t('grass.less')}</Text>
        {LEVEL_COLORS.map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{t('grass.more')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginHorizontal: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, marginBottom: Spacing.lg },
  statItem: { alignItems: 'center' },
  statValue: { ...Fonts.heading, fontSize: FontSize.xxl },
  statLabel: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 2 },
  gridScroll: { marginLeft: 4 },
  grid: { flexDirection: 'row', gap: GAP },
  weekColumn: { gap: GAP },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.md },
  legendCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 },
  legendLabel: { ...Fonts.body, fontSize: 10 },
  tooltipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  tooltip: { padding: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', minWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  tooltipDate: { ...Fonts.heading, fontSize: FontSize.md, marginBottom: Spacing.xs },
  tooltipValue: { ...Fonts.heading, fontSize: FontSize.xl },
  tooltipDetails: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  tooltipDetail: { ...Fonts.body, fontSize: FontSize.sm },
});
