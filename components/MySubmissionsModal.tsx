import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { fetchMySubmissions, type CommunityQuote } from '../services/communityService';
import { useCommunityStore } from '../stores/useCommunityStore';

interface MySubmissionsModalProps {
  visible: boolean;
  onClose: () => void;
  uid: string;
}

export default function MySubmissionsModal({ visible, onClose, uid }: MySubmissionsModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { deleteQuote, updateQuote } = useCommunityStore();
  const [quotes, setQuotes] = useState<CommunityQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      setEditingId(null);
      load();
    }
  }, [visible, load]);

  const handleEdit = (q: CommunityQuote) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await updateQuote(uid, editingId, editText.trim(), editAuthor.trim());
      setQuotes((prev) =>
        prev.map((q) => (q.id === editingId ? { ...q, text: editText.trim(), author: editAuthor.trim() } : q)),
      );
      setEditingId(null);
    } catch {
      Alert.alert(t('common.error'), t('common.errorMessage'));
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.grass0 }]}>
          <Text style={[s.title, { color: colors.textPrimary }]}>{t('community.myQuotes')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Content */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : quotes.length === 0 ? (
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
            {quotes.map((q) => (
              <View key={q.id} style={[s.card, { backgroundColor: colors.surface }]}>
                {editingId === q.id ? (
                  /* ── Edit mode ── */
                  <View style={s.editContainer}>
                    <TextInput
                      style={[s.editInput, { color: colors.textPrimary, borderColor: colors.primary }]}
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      placeholder={t('community.quotePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                    <TextInput
                      style={[s.editInput, s.editInputSingle, { color: colors.textPrimary, borderColor: colors.grass0 }]}
                      value={editAuthor}
                      onChangeText={setEditAuthor}
                      placeholder={t('community.authorPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                    />
                    <View style={s.editActions}>
                      <Pressable
                        style={[s.editBtn, { borderColor: colors.grass0 }]}
                        onPress={() => setEditingId(null)}
                      >
                        <Text style={[s.editBtnText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                      </Pressable>
                      <Pressable
                        style={[s.editBtn, s.editBtnPrimary, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                        onPress={handleSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[s.editBtnText, { color: '#fff' }]}>{t('common.save')}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  /* ── View mode ── */
                  <>
                    <Text style={[s.quoteText, { color: colors.textPrimary }]} numberOfLines={4}>
                      "{q.text}"
                    </Text>
                    {q.author ? (
                      <Text style={[s.author, { color: colors.textSecondary }]}>— {q.author}</Text>
                    ) : null}
                    <View style={s.cardBottom}>
                      <View style={s.likesRow}>
                        <Ionicons name="heart" size={13} color={colors.error} />
                        <Text style={[s.likesCount, { color: colors.textMuted }]}>{q.likeCount}</Text>
                      </View>
                      <View style={s.cardActions}>
                        <Pressable style={s.actionBtn} onPress={() => handleEdit(q)} hitSlop={8}>
                          <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={s.actionBtn} onPress={() => handleDelete(q.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyText: { ...Fonts.body, fontSize: FontSize.md, textAlign: 'center' },
    list: { flex: 1 },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
    card: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.card },
    quoteText: { ...Fonts.quote, fontSize: FontSize.md, lineHeight: 22 },
    author: { ...Fonts.body, fontSize: FontSize.sm, fontStyle: 'italic' },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    likesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    likesCount: { ...Fonts.body, fontSize: FontSize.xs },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    actionBtn: { padding: 4 },
    editContainer: { gap: Spacing.sm },
    editInput: {
      ...Fonts.body,
      fontSize: FontSize.md,
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    editInputSingle: { minHeight: 0, height: 44 },
    editActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
    editBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
    },
    editBtnPrimary: { borderWidth: 0 },
    editBtnText: { ...Fonts.heading, fontSize: FontSize.sm },
  });
}
