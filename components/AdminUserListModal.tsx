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
  adminFetchUsers,
  adminSetUserDisabled,
  type AdminUser,
} from '../services/firestoreUserService';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onViewUserPosts: (uid: string) => void;
}

export default function AdminUserListModal({ visible, onClose, onViewUserPosts }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadUsers = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }
    try {
      const { users: fetched, lastDoc } = await adminFetchUsers(
        20,
        reset ? null : cursorRef.current,
      );
      cursorRef.current = lastDoc;
      setHasMore(fetched.length === 20);
      setUsers((prev) => reset ? fetched : [...prev, ...fetched]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (visible) loadUsers(true);
  }, [visible]);

  const toggleDisabled = async (uid: string, current: boolean) => {
    await adminSetUserDisabled(uid, !current);
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, isDisabled: !current } : u)),
    );
  };

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          (u.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
          u.uid.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const renderItem = ({ item }: { item: AdminUser }) => (
    <View style={[styles.userRow, { borderBottomColor: colors.grass0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.userName, { color: colors.textPrimary }]}>
          {item.displayName ?? t('admin.noName')}
        </Text>
        <Text style={[styles.userId, { color: colors.textMuted }]}>
          {item.username ? `@${item.username}` : item.uid}
        </Text>
      </View>
      <Pressable
        style={[styles.postsBtn, { backgroundColor: colors.surfaceAlt }]}
        onPress={() => onViewUserPosts(item.uid)}
      >
        <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
      </Pressable>
      <Switch
        value={!item.isDisabled}
        onValueChange={() => toggleDisabled(item.uid, item.isDisabled)}
        trackColor={{ false: colors.error + '50', true: colors.primaryLight }}
        thumbColor={item.isDisabled ? colors.error : colors.primary}
      />
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('admin.userList')}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.grass0 }]}
            placeholder={t('admin.searchUsers')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.uid}
              renderItem={renderItem}
              showsVerticalScrollIndicator={true}
              onEndReached={() => !search.trim() && loadUsers(false)}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>{t('admin.noUsers')}</Text>
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
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  userName: { ...Fonts.body, fontSize: FontSize.md },
  userId: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 2 },
  postsBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl },
});
