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
  adminFetchCommunityQuotes,
  adminFetchUserQuotes,
  adminSetQuoteDisabled,
  type AdminCommunityQuote,
} from '../services/firestoreUserService';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

type SearchMode = 'content' | 'author';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pre-fill author search when navigating from user list */
  initialAuthorId?: string | null;
}

export default function AdminUserPostsModal({ visible, onClose, initialAuthorId }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [quotes, setQuotes] = useState<AdminCommunityQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('content');
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const authorIdRef = useRef<string | null>(null);

  const loadQuotes = useCallback(async (reset = false, authorFilter?: string | null) => {
    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }
    try {
      const fetchAuthor = authorFilter !== undefined ? authorFilter : authorIdRef.current;
      let fetched: AdminCommunityQuote[];
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null;

      if (fetchAuthor) {
        const res = await adminFetchUserQuotes(fetchAuthor, 20, reset ? null : cursorRef.current);
        fetched = res.quotes;
        lastDoc = res.lastDoc;
      } else {
        const res = await adminFetchCommunityQuotes(20, reset ? null : cursorRef.current);
        fetched = res.quotes;
        lastDoc = res.lastDoc;
      }

      cursorRef.current = lastDoc;
      setHasMore(fetched.length === 20);
      setQuotes((prev) => reset ? fetched : [...prev, ...fetched]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (visible) {
      if (initialAuthorId) {
        authorIdRef.current = initialAuthorId;
        setSearchMode('author');
        setSearch(initialAuthorId);
        loadQuotes(true, initialAuthorId);
      } else {
        authorIdRef.current = null;
        setSearch('');
        setSearchMode('content');
        loadQuotes(true, null);
      }
    }
  }, [visible, initialAuthorId]);

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearch('');
    authorIdRef.current = null;
    loadQuotes(true, null);
  };

  const handleSearchSubmit = () => {
    if (searchMode === 'author' && search.trim()) {
      authorIdRef.current = search.trim();
      loadQuotes(true, search.trim());
    } else {
      authorIdRef.current = null;
      loadQuotes(true, null);
    }
  };

  const toggleDisabled = async (quoteId: string, current: boolean) => {
    await adminSetQuoteDisabled(quoteId, !current);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, isDisabled: !current } : q)),
    );
  };

  const filtered = searchMode === 'content' && search.trim()
    ? quotes.filter(
        (q) =>
          q.text.toLowerCase().includes(search.toLowerCase()) ||
          q.author.toLowerCase().includes(search.toLowerCase()),
      )
    : quotes;

  const renderItem = ({ item }: { item: AdminCommunityQuote }) => (
    <View style={[styles.row, { borderBottomColor: colors.grass0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.quoteText, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.text}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {item.submitterName} · ❤️ {item.likeCount} · 🚩 {item.reportCount}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {item.submitterId}
        </Text>
      </View>
      <Switch
        value={!item.isDisabled}
        onValueChange={() => toggleDisabled(item.id, item.isDisabled)}
        trackColor={{ false: colors.error + '50', true: colors.primaryLight }}
        thumbColor={item.isDisabled ? colors.error : colors.primary}
      />
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('admin.userPosts')}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Search mode toggle */}
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, { backgroundColor: searchMode === 'content' ? colors.primary : colors.surfaceAlt }]}
              onPress={() => handleSearchModeChange('content')}
            >
              <Text style={[styles.modeBtnText, { color: searchMode === 'content' ? '#fff' : colors.textSecondary }]}>
                {t('admin.searchContent')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, { backgroundColor: searchMode === 'author' ? colors.primary : colors.surfaceAlt }]}
              onPress={() => handleSearchModeChange('author')}
            >
              <Text style={[styles.modeBtnText, { color: searchMode === 'author' ? '#fff' : colors.textSecondary }]}>
                {t('admin.searchAuthorId')}
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.grass0 }]}
            placeholder={searchMode === 'content' ? t('admin.searchContentPlaceholder') : t('admin.searchAuthorPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={true}
              onEndReached={() => !search.trim() || searchMode === 'author' ? loadQuotes(false) : undefined}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>{t('admin.noPosts')}</Text>
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
  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  modeBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  modeBtnText: { ...Fonts.body, fontSize: FontSize.sm },
  searchInput: { ...Fonts.body, fontSize: FontSize.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  row: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quoteText: { ...Fonts.body, fontSize: FontSize.sm, lineHeight: 20 },
  meta: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 2 },
  empty: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl },
});
