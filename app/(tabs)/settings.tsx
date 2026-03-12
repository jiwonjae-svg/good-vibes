import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { LANGUAGES, type LanguageCode } from '../../i18n';
import { signInWithGoogleNative, logOut, onAuthChange } from '../../services/authService';
import { logActivity } from '../../services/firestoreUserService';
import { scheduleDailyReminder, cancelDailyReminder, saveFCMToken } from '../../services/notificationService';
import { appLog } from '../../services/logger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const clientQuotes: Array<{ quote: string }> = require('../../data/quotesClient.json');
import LanguagePickerModal from '../../components/LanguagePickerModal';
import CategoryPickerModal from '../../components/CategoryPickerModal';
import LogStatusModal from '../../components/LogStatusModal';
import MySubmissionsModal from '../../components/MySubmissionsModal';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const {
    isPremium, setPremium,
    isDarkMode, setDarkMode,
    followSystemDarkMode, setFollowSystemDarkMode,
    language, setLanguage,
    selectedCategories, setCategories,
    dailyReminderEnabled, setDailyReminder,
    autoReadEnabled, setAutoRead,
    uid, displayName, email, setAuth,
    username, setProfile,
    currentStreak,
    setShowOnboardingFlag,
    streakFreezeCount,
    quoteFontSizeMultiplier, setFontSizeMultiplier,
    isEffectivelyPremium,
    startPremiumTrial,
    premiumTrialUsed,
    notificationHour, setNotificationHour,
    ttsSpeed, setTtsSpeed,
  } = useUserStore();

  const FONT_SIZE_OPTIONS = [
    { label: 'A-', value: 0.85 },
    { label: 'A', value: 1.0 },
    { label: 'A+', value: 1.15 },
    { label: 'A++', value: 1.3 },
  ];

  const isGuest = !uid;
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [mySubmissionsVisible, setMySubmissionsVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
    });
    return unsub;
  }, []);

  const handlePremiumPurchase = () => {
    // TODO: Replace with real IAP via RevenueCat or Google Play Billing.
    // This currently starts a free trial as a placeholder — no payment is collected.
    // SECURITY: server-side receipt validation must be added before going live.
    appLog.log('[settings] premium trial started (IAP not yet integrated)', { uid });
    startPremiumTrial();
    setPremiumModalVisible(false);
  };

  const handleOpenEditProfile = () => {
    setEditName(displayName ?? '');
    setEditUsername(username ?? '');
    setEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedUsername = editUsername.trim();
    if (!trimmedName) {
      Alert.alert(t('profile.nameRequired'));
      return;
    }
    await setProfile(trimmedName, trimmedUsername);
    setEditProfileVisible(false);
  };

  const handleLanguage = () => setLangModalVisible(true);
  const handleCategory = () => {
    setCatModalVisible(true);
  };

  const handleNotification = async (enabled: boolean) => {
    if (isGuest) return;
    appLog.log('[settings] notification toggle', { enabled, uid });
    if (enabled) {
      const randomQuote = clientQuotes[Math.floor(Math.random() * clientQuotes.length)];
      const granted = await scheduleDailyReminder(randomQuote?.quote, notificationHour);
      appLog.log('[settings] notification scheduling result', { granted });
      setDailyReminder(granted);
      if (granted && uid) saveFCMToken(uid).catch(() => {});
    } else {
      await cancelDailyReminder();
      setDailyReminder(false);
    }
  };

  const handleNotificationHour = async (hour: number) => {
    await setNotificationHour(hour);
    if (dailyReminderEnabled) {
      const randomQuote = clientQuotes[Math.floor(Math.random() * clientQuotes.length)];
      scheduleDailyReminder(randomQuote?.quote, hour).catch(() => {});
    }
  };

  const handleLogout = async () => {
    appLog.log('[settings] logout', { uid });
    if (uid) await logActivity(uid, 'logout');
    await logOut();
    setAuth(null);
  };

  const handleReplayOnboarding = () => {
    setShowOnboardingFlag(true);
  };

  const s = makeStyles(colors);
  const currentLangLabel = LANGUAGES.find((l) => l.code === language)?.label ?? '한국어';
  const catCount = selectedCategories.length;
  const catLabel = catCount === 0 ? t('settings.allCategories') : t('settings.categoriesSelected', { count: catCount });

  return (
    <SafeAreaView style={[s.safe]} edges={['top']}>
      <LanguagePickerModal
        visible={langModalVisible}
        current={language}
        onSelect={(lang) => setLanguage(lang)}
        onClose={() => setLangModalVisible(false)}
      />
      <CategoryPickerModal
        visible={catModalVisible}
        selected={selectedCategories}
        onSelect={setCategories}
        onClose={() => setCatModalVisible(false)}
      />
      <LogStatusModal visible={logModalVisible} onClose={() => setLogModalVisible(false)} />
      <MySubmissionsModal
        visible={mySubmissionsVisible}
        onClose={() => setMySubmissionsVisible(false)}
        uid={uid!}
      />

      {/* Profile Edit Modal */}
      <Modal
        transparent
        visible={editProfileVisible}
        animationType="slide"
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setEditProfileVisible(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[s.premiumModalTitle, { color: colors.textPrimary, marginBottom: Spacing.lg }]}>
              {t('settings.editProfile')}
            </Text>
            <View style={{ width: '100%', gap: Spacing.md }}>
              <View>
                <Text style={[s.rowSubtitle, { color: colors.textSecondary, marginBottom: 6 }]}>
                  {t('settings.editProfileName')}
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('profile.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[s.textInput, { color: colors.textPrimary, borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}
                />
              </View>
              <View>
                <Text style={[s.rowSubtitle, { color: colors.textSecondary, marginBottom: 6 }]}>
                  {t('settings.editProfileUsername')}
                </Text>
                <TextInput
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder={t('profile.usernamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={[s.textInput, { color: colors.textPrimary, borderColor: colors.grass0, backgroundColor: colors.surfaceAlt }]}
                />
              </View>
            </View>
            <Pressable
              style={[s.purchaseBtn, { backgroundColor: colors.primary, marginTop: Spacing.xl }]}
              onPress={handleSaveProfile}
            >
              <Text style={s.purchaseBtnText}>{t('settings.editProfileSave')}</Text>
            </Pressable>
            <Pressable style={s.laterBtn} onPress={() => setEditProfileVisible(false)}>
              <Text style={[s.laterBtnText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Premium Modal */}
      <Modal
        transparent
        visible={premiumModalVisible}
        animationType="fade"
        onRequestClose={() => setPremiumModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setPremiumModalVisible(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.premiumIconWrapper, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="diamond" size={48} color={colors.primary} />
            </View>
            <Text style={[s.premiumModalTitle, { color: colors.textPrimary }]}>{t('premium.title')}</Text>
            <Text style={[s.premiumModalDesc, { color: colors.textSecondary }]}>{t('premium.description')}</Text>

            <View style={s.benefitList}>
              <View style={s.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Text style={[s.benefitText, { color: colors.textPrimary }]}>{t('premium.benefit1')}</Text>
              </View>
              <View style={s.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Text style={[s.benefitText, { color: colors.textPrimary }]}>{t('premium.benefit2')}</Text>
              </View>
              <View style={s.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Text style={[s.benefitText, { color: colors.textPrimary }]}>{t('premium.benefit4')}</Text>
              </View>
            </View>

            <Pressable
              style={[s.purchaseBtn, { backgroundColor: colors.primary }]}
              onPress={handlePremiumPurchase}
            >
              <Text style={s.purchaseBtnText}>{t('premium.purchase')}</Text>
            </Pressable>
            <Pressable style={s.laterBtn} onPress={() => setPremiumModalVisible(false)}>
              <Text style={[s.laterBtnText, { color: colors.textMuted }]}>{t('premium.later')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        <Text style={s.header}>{t('settings.title')}</Text>

        {currentStreak > 1 && !isGuest && (
          <View style={s.streakBanner}>
            <Text style={s.streakText}>🔥 {currentStreak}{t('grass.streak')}</Text>
          </View>
        )}

        {/* Account Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.account')}</Text>
          <View style={s.card}>
            {uid ? (
              <>
                <View style={s.row}>
                  <View style={s.rowLeft}>
                    <View style={[s.avatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={[s.avatarText, { color: colors.primary }]}>
                        {(displayName ?? email ?? 'G').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.rowTitle}>{displayName ?? email ?? t('settings.googleUser')}</Text>
                      {(username || email) && (
                        <Text style={[s.rowSubtitle, { color: colors.textMuted, fontSize: FontSize.xs }]}>
                          {username ? `@${username}` : email}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={s.divider} />
                <Pressable style={s.row} onPress={handleOpenEditProfile}>
                  <View style={s.rowLeft}>
                    <Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />
                    <Text style={s.rowTitle}>{t('settings.editProfile')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={s.divider} />
                <Pressable style={s.row} onPress={() => setMySubmissionsVisible(true)}>
                  <View style={s.rowLeft}>
                    <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
                    <View>
                      <Text style={s.rowTitle}>{t('settings.mySubmissions')}</Text>
                      <Text style={s.rowSubtitle}>{t('settings.mySubmissionsDesc')}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={s.divider} />
                <Pressable style={s.row} onPress={handleLogout}>
                  <View style={s.rowLeft}>
                    <Ionicons name="log-out-outline" size={22} color={colors.error} />
                    <Text style={[s.rowTitle, { color: colors.error }]}>{t('settings.logout')}</Text>
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                <View style={[s.guestBanner, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="person-outline" size={32} color={colors.primary} />
                  <View style={s.guestBannerText}>
                    <Text style={[s.guestTitle, { color: colors.textPrimary }]}>{t('settings.guestMode')}</Text>
                    <Text style={[s.guestDesc, { color: colors.textSecondary }]}>{t('settings.guestModeDesc')}</Text>
                  </View>
                </View>

                <Pressable
                  style={[
                    s.loginBtn,
                    {
                      backgroundColor: isDarkMode ? colors.surfaceAlt : '#fff',
                      borderColor: isDarkMode ? colors.grass0 : '#dadce0',
                    },
                  ]}
                  onPress={() => {
                    signInWithGoogleNative()
                      .then((user) => {
                        if (user) setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
                      })
                      .catch((err) => console.error('[settings] Google sign-in failed:', err));
                  }}
                >
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={[s.loginBtnText, { color: colors.textPrimary }]}>{t('settings.loginWithGoogle')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Premium Section - Show for logged in users */}
        {!isGuest && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.subscription')}</Text>
            <View style={s.card}>
              {isPremium ? (
                <View style={s.row}>
                  <View style={s.rowLeft}>
                    <Ionicons name="diamond" size={22} color={colors.primary} />
                    <View>
                      <Text style={s.rowTitle}>{t('premium.active')}</Text>
                      <Text style={s.rowSubtitle}>{t('premium.activeDesc')}</Text>
                    </View>
                  </View>
                  <View style={[s.premiumBadge, { backgroundColor: colors.primary }]}>
                    <Text style={s.premiumBadgeText}>Glow+</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable style={s.row} onPress={() => setPremiumModalVisible(true)}>
                    <View style={s.rowLeft}>
                      <Ionicons name="diamond-outline" size={22} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle}>{t('premium.upgrade')}</Text>
                        <Text style={[s.rowSubtitle, { color: colors.textSecondary }]}>{t('premium.upgradeDesc')}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.preferences')}</Text>
          <View style={s.card}>
            <Pressable style={s.row} onPress={handleLanguage}>
              <View style={s.rowLeft}>
                <Ionicons name="globe-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.language')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.rowValue}>{currentLangLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
            <View style={s.divider} />

            {/* Theme selector – radio group */}
            <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.sm }]}>
              <View style={s.rowLeft}>
                <Ionicons name="color-palette-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.theme')}</Text>
              </View>
              <View style={{ paddingLeft: Spacing.xxl + Spacing.xs, gap: Spacing.sm, width: '100%' }}>
                {[
                  { label: t('settings.themeLight'), value: 'light' },
                  { label: t('settings.themeDark'), value: 'dark' },
                  { label: t('settings.themeSystem'), value: 'system' },
                ].map((opt) => {
                  const isSelected =
                    opt.value === 'system'
                      ? followSystemDarkMode
                      : opt.value === 'dark'
                      ? !followSystemDarkMode && isDarkMode
                      : !followSystemDarkMode && !isDarkMode;
                  return (
                    <Pressable
                      key={opt.value}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}
                      onPress={() => {
                        if (opt.value === 'system') {
                          appLog.log('[settings] theme → system');
                          setFollowSystemDarkMode(true);
                        } else if (opt.value === 'dark') {
                          appLog.log('[settings] theme → dark');
                          setFollowSystemDarkMode(false);
                          setDarkMode(true);
                        } else {
                          appLog.log('[settings] theme → light');
                          setFollowSystemDarkMode(false);
                          setDarkMode(false);
                        }
                      }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        borderWidth: 2, borderColor: isSelected ? colors.primary : colors.textMuted,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                        )}
                      </View>
                      <Text style={[s.rowTitle, { fontWeight: isSelected ? '600' : '400' }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={s.divider} />
            <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.sm }]}>
              <View style={s.rowLeft}>
                <Ionicons name="text-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.fontSize')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.fontSizeDesc')}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingLeft: Spacing.xl + Spacing.xs }}>
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      s.fontSizeBtn,
                      { borderColor: colors.primary, backgroundColor: quoteFontSizeMultiplier === opt.value ? colors.primary : 'transparent' },
                    ]}
                    onPress={() => { appLog.log('[settings] fontSize changed', { value: opt.value }); setFontSizeMultiplier(opt.value); }}
                  >
                    <Text style={[s.fontSizeBtnText, { color: quoteFontSizeMultiplier === opt.value ? '#fff' : colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Live preview */}
              <View style={[s.fontPreviewBox, { backgroundColor: colors.surfaceAlt, marginLeft: Spacing.xl + Spacing.xs }]}>
                <Text style={[s.fontPreviewText, { color: colors.textPrimary, fontSize: 16 * quoteFontSizeMultiplier }]}>{t('settings.fontSizePreviewSample')}</Text>
              </View>
            </View>
            <View style={s.divider} />
            <Pressable style={s.row} onPress={handleCategory}>
              <View style={s.rowLeft}>
                <Ionicons name="pricetag-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.category')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.rowValue}>{catLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="volume-high-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.autoRead')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.autoReadDesc')}</Text>
                </View>
              </View>
                      <Switch value={autoReadEnabled} onValueChange={(val) => { appLog.log('[settings] autoRead toggle', { val }); setAutoRead(val); }} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={autoReadEnabled ? colors.primary : '#f4f3f4'} />
            </View>
            <View style={s.divider} />
            {/* TTS Speed */}
            <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.sm }]}>
              <View style={s.rowLeft}>
                <Ionicons name="speedometer-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.ttsSpeed')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.ttsSpeedDesc')}</Text>
                </View>
              </View>
              <View style={{ paddingLeft: Spacing.xxl + Spacing.xs, gap: Spacing.sm, width: '100%' }}>
                {[
                  { label: t('settings.ttsSpeedSlow'),   value: 0.6 },
                  { label: t('settings.ttsSpeedNormal'), value: 0.9 },
                  { label: t('settings.ttsSpeedFast'),   value: 1.2 },
                ].map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}
                    onPress={() => setTtsSpeed(opt.value)}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ttsSpeed === opt.value ? colors.primary : colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
                      {ttsSpeed === opt.value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                    </View>
                    <Text style={[s.rowTitle, { fontWeight: ttsSpeed === opt.value ? '600' : '400' }]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Streak Freeze */}
        {!isGuest && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('settings.streakFreeze')}</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.rowLeft}>
                  <Ionicons name="snow-outline" size={22} color="#64b5f6" />
                  <View>
                    <Text style={s.rowTitle}>{t('settings.streakFreezeCount', { count: streakFreezeCount })}</Text>
                    <Text style={s.rowSubtitle}>{t('settings.streakFreezeDesc')}</Text>
                  </View>
                </View>
                <Text style={[s.rowValue, { fontSize: FontSize.lg, color: '#64b5f6' }]}>{'❄️'.repeat(Math.min(streakFreezeCount, 3))}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Notifications */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.notifications')}</Text>
          <View style={s.card}>
            <View style={[s.row, isGuest && s.disabledRow]}>
              <View style={s.rowLeft}>
                <Ionicons name="notifications-outline" size={22} color={isGuest ? colors.textMuted : colors.textSecondary} />
                <View>
                  <Text style={[s.rowTitle, isGuest && { color: colors.textMuted }]}>{t('settings.dailyReminder')}</Text>
                  <Text style={[s.rowSubtitle, { color: isGuest ? colors.textMuted : colors.textSecondary }]}>
                    {isGuest ? t('settings.loginRequired') : t('settings.dailyReminderDesc')}
                  </Text>
                </View>
              </View>
              {isGuest ? (
                <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
              ) : (
                <Switch value={dailyReminderEnabled} onValueChange={handleNotification} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={dailyReminderEnabled ? colors.primary : '#f4f3f4'} />
              )}
            </View>
            {/* Notification time picker — shown only when enabled and logged in */}
            {dailyReminderEnabled && !isGuest && (
              <>
                <View style={s.divider} />
                <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.sm }]}>
                  <View style={s.rowLeft}>
                    <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
                    <Text style={s.rowTitle}>{t('settings.notificationTime')}</Text>
                  </View>
                  <View style={{ paddingLeft: Spacing.xxl + Spacing.xs, gap: Spacing.sm, width: '100%' }}>
                    {[
                      { label: t('settings.notificationMorning'), hour: 8 },
                      { label: t('settings.notificationNoon'),    hour: 12 },
                      { label: t('settings.notificationEvening'), hour: 21 },
                    ].map((opt) => (
                      <Pressable
                        key={opt.hour}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 }}
                        onPress={() => handleNotificationHour(opt.hour)}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: notificationHour === opt.hour ? colors.primary : colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
                          {notificationHour === opt.hour && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                        </View>
                        <Text style={[s.rowTitle, { fontWeight: notificationHour === opt.hour ? '600' : '400' }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.info')}</Text>
          <View style={s.card}>
            <Pressable style={s.row} onPress={handleReplayOnboarding}>
              <View style={s.rowLeft}>
                <Ionicons name="play-circle-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.replayOnboarding')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.replayOnboardingDesc')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.appVersion')}</Text>
              </View>
              <Text style={s.rowValue}>1.0.0</Text>
            </View>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="heart-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.madeBy')}</Text>
              </View>
              <Text style={s.rowValue}>DailyGlow Team</Text>
            </View>
            <View style={s.divider} />
            <Pressable style={s.row} onPress={() => setLogModalVisible(true)}>
              <View style={s.rowLeft}>
                <Ionicons name="terminal-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.logStatus')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.logStatusDesc')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.primaryLight }]}>DailyGlow</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, paddingTop: Spacing.md },
    header: { ...Fonts.heading, fontSize: FontSize.xl, color: colors.textPrimary, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    streakBanner: { backgroundColor: colors.surfaceAlt, marginHorizontal: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, alignItems: 'center' },
    streakText: { ...Fonts.heading, fontSize: FontSize.lg, color: colors.primary },
    section: { marginBottom: Spacing.lg },
    sectionTitle: { ...Fonts.heading, fontSize: FontSize.sm, color: colors.textMuted, textTransform: 'uppercase', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, letterSpacing: 1 },
    card: { backgroundColor: colors.surface, marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.floating },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    disabledRow: { opacity: 0.6 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { ...Fonts.heading, fontSize: FontSize.lg },
    rowTitle: { ...Fonts.body, fontSize: FontSize.md, color: colors.textPrimary },
    rowSubtitle: { ...Fonts.body, fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },
    rowValue: { ...Fonts.body, fontSize: FontSize.sm, color: colors.textSecondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.grass0, marginLeft: Spacing.xxl + Spacing.sm },
    footer: { alignItems: 'center', paddingVertical: Spacing.xxl },
    footerText: { ...Fonts.heading, fontSize: FontSize.lg },
    guestBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, margin: Spacing.sm, borderRadius: BorderRadius.md },
    guestBannerText: { flex: 1 },
    guestTitle: { ...Fonts.heading, fontSize: FontSize.md },
    guestDesc: { ...Fonts.body, fontSize: FontSize.xs, marginTop: 2 },
    loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, marginHorizontal: Spacing.sm, marginBottom: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5 },
    fontSizeBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5, minWidth: 44, alignItems: 'center' },
    fontSizeBtnText: { ...Fonts.body, fontSize: FontSize.sm },
    fontPreviewBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.xs, marginRight: Spacing.md },
    fontPreviewText: { ...Fonts.quote, textAlign: 'center', lineHeight: 28 },
    loginBtnText: { ...Fonts.body, fontSize: FontSize.md },
    premiumBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
    premiumBadgeText: { ...Fonts.heading, fontSize: FontSize.xs, color: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
    modalSheet: { width: '100%', maxWidth: 340, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center' },
    premiumIconWrapper: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    premiumModalTitle: { ...Fonts.heading, fontSize: FontSize.xl, marginBottom: Spacing.sm, textAlign: 'center' },
    premiumModalDesc: { ...Fonts.body, fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20 },
    benefitList: { width: '100%', marginBottom: Spacing.lg },
    benefitItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    benefitText: { ...Fonts.body, fontSize: FontSize.sm },
    purchaseBtn: { width: '100%', padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.sm },
    purchaseBtnText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
    laterBtn: { padding: Spacing.sm },
    laterBtnText: { ...Fonts.body, fontSize: FontSize.sm },
    textInput: { width: '100%', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, fontSize: FontSize.md, ...Fonts.body },
  });
}
