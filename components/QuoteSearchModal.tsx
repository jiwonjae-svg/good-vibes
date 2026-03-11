import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';
import type { Quote } from '../stores/useQuoteStore';

interface Props {
  visible: boolean;
  quotes: Quote[];
  onClose: () => void;
  onSelect: (quote: Quote) => void;
}

export default function QuoteSearchModal({ visible, quotes, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return quotes.filter(
      (quote) =>
        quote.text.toLowerCase().includes(q) ||
        (quote.author && quote.author.toLowerCase().includes(q)),
    ).slice(0, 50);
  }, [query, quotes]);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    (quote: Quote) => {
      setQuery('');
      onSelect(quote);
    },
    [onSelect],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.surfaceAlt }]}>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={[styles.closeText, { color: colors.primary }]}>{t('common.cancel')}</Text>
            </Pressable>
          </View>

          {/* Results */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              query.trim().length > 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('home.searchEmpty')}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.resultItem, { borderBottomColor: colors.surfaceAlt }]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.resultText, { color: colors.textPrimary }]} numberOfLines={3}>
                  {item.text}
                </Text>
                {item.author ? (
                  <Text style={[styles.resultAuthor, { color: colors.textSecondary }]}>
                    — {item.author}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  input: {
    flex: 1,
    ...Fonts.body,
    fontSize: FontSize.md,
    padding: 0,
  },
  closeBtn: { paddingHorizontal: 4 },
  closeText: { ...Fonts.body, fontSize: FontSize.md, fontWeight: '600' },
  listContent: { paddingBottom: 40 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: { ...Fonts.body, fontSize: FontSize.md },
  resultItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: 4,
  },
  resultText: { ...Fonts.body, fontSize: FontSize.md, lineHeight: 22 },
  resultAuthor: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic' },
});
