import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, Image, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { isUsernameAvailable, isValidUsername } from '../services/firestoreUserService';
import { BADGE_CONFIG } from '../constants/badges';
import ProfileAvatar from './ProfileAvatar';
import { useUserStore } from '../stores/useUserStore';

// Filter username: only a-z A-Z 0-9 - _
function filterUsername(text: string): string {
  return text.replace(/[^a-zA-Z0-9\-_]/g, '');
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  username: string;
  photoURL?: string | null;
  onSave: (displayName: string, username: string, photoURL?: string) => Promise<void>;
}

export default function EditProfileModal({
  visible,
  onClose,
  displayName,
  username,
  photoURL,
  onSave,
}: EditProfileModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const earnedBadges = useUserStore((s) => s.earnedBadges);
  const [editName, setEditName] = useState(displayName);
  const [editUsername, setEditUsername] = useState(username);
  const [editPhotoURL, setEditPhotoURL] = useState<string | undefined>(photoURL ?? undefined);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when modal opens with new props
  React.useEffect(() => {
    if (visible) {
      setEditName(displayName);
      setEditUsername(username);
      setEditPhotoURL(photoURL ?? undefined);
      setUsernameAvailable(null);
      setUsernameError(null);
      setChecking(false);
    }
  }, [visible, displayName, username, photoURL]);


  const handleUsernameChange = (text: string) => {
    const filtered = filterUsername(text);
    setEditUsername(filtered);
    setUsernameError(null);
    setUsernameAvailable(null);

    // If user typed back to the original username, no check needed
    if (filtered.trim().toLowerCase() === username.trim().toLowerCase()) {
      setChecking(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (filtered.length >= 3 && isValidUsername(filtered)) {
      setChecking(true);
      debounceRef.current = setTimeout(async () => {
        const available = await isUsernameAvailable(filtered.toLowerCase());
        setChecking(false);
        setUsernameAvailable(available);
        if (!available) setUsernameError(t('profile.usernameTaken'));
      }, 600);
    } else if (filtered.length > 0) {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert(t('profile.nameRequired'));
      return;
    }
    const trimmedUsername = editUsername.trim().toLowerCase();
    const isUnchanged = trimmedUsername === username.trim().toLowerCase();
    if (!isUnchanged && usernameAvailable === false) {
      setUsernameError(t('profile.usernameTaken'));
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmedName, trimmedUsername, editPhotoURL);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={[s.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t('settings.editProfile')}</Text>

          {/* Avatar preview */}
          <ProfileAvatar
            photoURL={editPhotoURL}
            displayName={editName || editUsername}
            size={80}
            backgroundColor={colors.primary + '40'}
            textColor={colors.primary}
          />

          {/* Badge picker */}
          <View style={s.badgeSection}>
            <Text style={[s.label, { color: colors.textSecondary }]}>{t('settings.profileBadgeLabel')}</Text>
            {earnedBadges.length === 0 ? (
              <Text style={[s.noBadgesText, { color: colors.textMuted }]}>{t('settings.noBadgesYet')}</Text>
            ) : (
              <FlatList
                horizontal
                data={['__none__', ...earnedBadges]}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                renderItem={({ item }) => {
                  if (item === '__none__') {
                    const isSelected = !editPhotoURL;
                    return (
                      <Pressable
                        onPress={() => setEditPhotoURL(undefined)}
                        style={[s.badgeOption, { borderColor: isSelected ? colors.primary : colors.textMuted, backgroundColor: colors.surfaceAlt }]}
                      >
                        <Ionicons name="person" size={22} color={isSelected ? colors.primary : colors.textMuted} />
                      </Pressable>
                    );
                  }
                  const badge = BADGE_CONFIG[item];
                  if (!badge) return null;
                  const isSelected = editPhotoURL === `badge:${item}`;
                  return (
                    <Pressable
                      onPress={() => setEditPhotoURL(`badge:${item}`)}
                      style={[s.badgeOption, { borderColor: isSelected ? colors.primary : 'transparent', backgroundColor: colors.surfaceAlt }]}
                    >
                      <Image source={badge.image} style={{ width: 34, height: 34 }} resizeMode="contain" />
                    </Pressable>
                  );
                }}
              />
            )}
          </View>

            <View style={s.fields}>
              <View>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('settings.editProfileName')}</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('profile.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[s.input, { color: colors.textPrimary, borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}
                />
              </View>
              <View>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('settings.editProfileUsername')}</Text>
                <View style={s.usernameRow}>
                  <TextInput
                    value={editUsername}
                    onChangeText={handleUsernameChange}
                    placeholder={t('profile.usernamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    style={[s.input, s.usernameInput, {
                      color: colors.textPrimary,
                      backgroundColor: colors.surfaceAlt,
                      borderColor: usernameError
                        ? colors.error
                        : usernameAvailable === true
                        ? colors.success
                        : colors.grass0,
                    }]}
                  />
                  <View style={s.statusIcon}>
                    {checking && <ActivityIndicator size="small" color={colors.textMuted} />}
                    {!checking && usernameAvailable === true && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    )}
                    {!checking && usernameAvailable === false && (
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    )}
                  </View>
                </View>
                {usernameError ? (
                  <Text style={[s.statusText, { color: colors.error }]}>{usernameError}</Text>
                ) : usernameAvailable === true ? (
                  <Text style={[s.statusText, { color: colors.success }]}>{t('profile.usernameAvailable')}</Text>
                ) : null}
              </View>
            </View>

            <Pressable
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>{t('settings.editProfileSave')}</Text>
              )}
            </Pressable>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.cancelBtnText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    sheet: { width: '100%', maxWidth: 400, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, alignItems: 'center' },
    title: { ...Fonts.heading, fontSize: FontSize.lg, marginBottom: Spacing.sm },
    badgeSection: { width: '100%', gap: 4 },
    noBadgesText: { ...Fonts.body, fontSize: FontSize.xs, paddingVertical: Spacing.xs },
    badgeOption: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, overflow: 'hidden' },
    fields: { width: '100%', gap: Spacing.md },
    label: { ...Fonts.body, fontSize: FontSize.sm, marginBottom: 4 },
    input: { width: '100%', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, ...Fonts.body, fontSize: FontSize.md },
    usernameRow: { flexDirection: 'row', alignItems: 'center' },
    usernameInput: { flex: 1 },
    statusIcon: { position: 'absolute', right: Spacing.sm },
    statusText: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 4 },
    saveBtn: { width: '100%', paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, alignItems: 'center', marginTop: Spacing.md },
    saveBtnText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
    cancelBtn: { paddingVertical: Spacing.sm },
    cancelBtnText: { ...Fonts.body, fontSize: FontSize.sm },
  });
}
