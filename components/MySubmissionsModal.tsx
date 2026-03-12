import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { fetchMySubmissions, type CommunityQuote } from '../services/communityService';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface MySubmissionsModalProps {
  visible: boolean;
  onClose: () => void;
  uid: string;
}

export default function MySubmissionsModal({ visible, onClose, uid }: MySubmissionsModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [quotes, setQuotes] = useState<CommunityQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const results = await fetchMySubmissions(uid);
      setQuotes(results);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (visible) {
      setFilter('all');
      load();
    }
  }, [visible, load]);

  const filtered = filter === 'all' ? quotes : quotes.filter((q) => q.status === filter);

  const statusColor = (status: CommunityQuote['status']) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      default:         return colors.warning;
    }
  };

  const statusLabel = (status: CommunityQuote['status']) => {
    switch (status) {
      case 'approved': return t('community.approved');
      case 'rejected': return t('community.rejected');
      default:         return t('community.pending');
    }
  };

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: t('community.filterAll') },
    { key: 'pending',  label: t('community.pending') },
    { key: 'approved', label: t('community.approved') },
    { key: 'rejected', label: t('community.rejected') },
  ];

  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.grass0 }]}>
          <Text style={[s.title, { color: colors.textPrimary }]}>{t('settings.mySubmissions')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[
                s.filterChip,
                { borderColor: colors.primary },
                filter === f.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[
                s.filterChipText,
                { color: filter === f.key ? '#fff' : colors.textSecondary },
              ]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={[s.emptyText, { color: colors.textMuted }]}>
              {t('community.mySubmissionsEmpty')}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((q) => (
              <View key={q.id} style={[s.card, { backgroundColor: colors.surface }]}>
                <View style={s.cardTop}>
                  <Text style={[s.quoteText, { color: colors.textPrimary }]} numberOfLines={3}>
                    "{q.text}"
                  </Text>
                  <View style={[s.statusBadge, { backgroundColor: statusColor(q.status) + '20' }]}>
                    <Text style={[s.statusText, { color: statusColor(q.status) }]}>
                      {statusLabel(q.status)}
                    </Text>
                  </View>
                </View>
                {q.author ? (
                  <Text style={[s.author, { color: colors.textSecondary }]}>— {q.author}</Text>
                ) : null}
                <View style={s.cardBottom}>
                  <View style={s.likesRow}>
                    <Ionicons name="heart" size={13} color={colors.error} />
                    <Text style={[s.likesCount, { color: colors.textMuted }]}>{q.likeCount}</Text>
                  </View>
                  <Text style={[s.dateText, { color: colors.textMuted }]}>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
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
    title: { ...Fonts.heading, fontSize: FontSize.lg },
    filtersRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    filterChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      borderWidth: 1.5,
    },
    filterChipText: { ...Fonts.body, fontSize: FontSize.sm },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyText: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center' },
    list: { flex: 1 },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
    card: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.card },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    quoteText: { ...Fonts.quote, fontSize: FontSize.md, flex: 1, lineHeight: 22 },
    statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
    statusText: { ...Fonts.heading, fontSize: FontSize.xs },
    author: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic' },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    likesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    likesCount: { ...Fonts.body, fontSize: FontSize.xs },
    dateText: { ...Fonts.body, fontSize: FontSize.xs },
  });
}
