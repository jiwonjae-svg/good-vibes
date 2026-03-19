import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, View, Text, FlatList, Pressable, TextInput, Switch, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';
import {
  adminFetchReports,
  adminSetReportResolved,
  type AdminReport,
} from '../services/firestoreUserService';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminReportsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadReports = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }
    try {
      const { reports: fetched, lastDoc } = await adminFetchReports(
        20,
        reset ? null : cursorRef.current,
      );
      cursorRef.current = lastDoc;
      setHasMore(fetched.length === 20);
      setReports((prev) => reset ? fetched : [...prev, ...fetched]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (visible) loadReports(true);
  }, [visible]);

  const toggleResolved = async (reportId: string, current: boolean) => {
    await adminSetReportResolved(reportId, !current);
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, resolved: !current } : r)),
    );
  };

  const filtered = search.trim()
    ? reports.filter(
        (r) =>
          r.reason.toLowerCase().includes(search.toLowerCase()) ||
          r.quoteId.toLowerCase().includes(search.toLowerCase()) ||
          r.userId.toLowerCase().includes(search.toLowerCase()),
      )
    : reports;

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: AdminReport }) => (
    <View style={[styles.row, { borderBottomColor: colors.grass0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reason, { color: colors.textPrimary }]}>
          {item.reason}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('admin.reporter')}: {item.userId}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('admin.reportedQuote')}: {item.quoteId}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.statusText, { color: item.resolved ? colors.success : colors.error }]}>
          {item.resolved ? t('admin.resolved') : t('admin.unresolved')}
        </Text>
        <Switch
          value={item.resolved}
          onValueChange={() => toggleResolved(item.id, item.resolved)}
          trackColor={{ false: colors.error + '50', true: colors.primaryLight }}
          thumbColor={item.resolved ? colors.success : colors.error}
        />
      </View>
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('admin.reports')}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.grass0 }]}
            placeholder={t('admin.searchReports')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={true}
              onEndReached={() => !search.trim() && loadReports(false)}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>{t('admin.noReports')}</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { height: '85%', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { ...Fonts.heading, fontSize: FontSize.xl },
  searchInput: { ...Fonts.body, fontSize: FontSize.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  row: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reason: { ...Fonts.body, fontSize: FontSize.sm },
  meta: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 2 },
  statusText: { ...Fonts.body, fontSize: FontSize.xs, marginBottom: 4 },
  empty: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl },
});
