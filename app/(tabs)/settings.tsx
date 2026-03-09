import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { LANGUAGES, type LanguageCode } from '../../i18n';
import { useGoogleAuth, signInWithGoogle, logOut, onAuthChange } from '../../services/authService';
import { logActivity } from '../../services/firestoreUserService';
import { scheduleDailyReminder, cancelDailyReminder } from '../../services/notificationService';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const clientQuotes: Array<{ quote: string }> = require('../../data/quotesClient.json');
import LanguagePickerModal from '../../components/LanguagePickerModal';
import CategoryPickerModal from '../../components/CategoryPickerModal';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const {
    isPremium, setPremium,
    isDarkMode, setDarkMode,
    language, setLanguage,
    selectedCategories, setCategories,
    dailyReminderEnabled, setDailyReminder,
    autoReadEnabled, setAutoRead,
    uid, displayName, email, setAuth,
    currentStreak,
    setShowOnboardingFlag,
  } = useUserStore();

  const isGuest = !uid;
  const { response, promptAsync } = useGoogleAuth();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken;
      if (idToken) {
        signInWithGoogle(idToken).then((user) => {
          if (user) setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        });
      }
    }
  }, [response]);

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) setAuth({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
    });
    return unsub;
  }, []);

  const handlePremiumPurchase = () => {
    setPremium(true);
    setPremiumModalVisible(false);
  };

  const handleLanguage = () => setLangModalVisible(true);
  const handleCategory = () => {
    if (isGuest) return;
    setCatModalVisible(true);
  };

  const handleNotification = async (enabled: boolean) => {
    if (isGuest) return;
    if (enabled) {
      const randomQuote = clientQuotes[Math.floor(Math.random() * clientQuotes.length)];
      const granted = await scheduleDailyReminder(randomQuote?.quote);
      setDailyReminder(granted);
    } else {
      await cancelDailyReminder();
      setDailyReminder(false);
    }
  };

  const handleLogout = async () => {
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

      {/* Premium Modal */}}
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
                    <Ionicons name="logo-google" size={22} color="#EA4335" />
                    <View>
                      <Text style={s.rowTitle}>{displayName ?? email ?? t('settings.googleUser')}</Text>
                      <Text style={s.rowSubtitle}>{t('settings.loggedInWith')} Google</Text>
                    </View>
                  </View>
                </View>
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
                  onPress={() => promptAsync()}
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
                    <Text style={s.premiumBadgeText}>PRO</Text>
                  </View>
                </View>
              ) : (
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
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="moon-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.darkMode')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.darkModeDesc')}</Text>
                </View>
              </View>
              <Switch value={isDarkMode} onValueChange={setDarkMode} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={isDarkMode ? colors.primary : '#f4f3f4'} />
            </View>
            <View style={s.divider} />
            <Pressable style={[s.row, isGuest && s.disabledRow]} onPress={handleCategory} disabled={isGuest}>
              <View style={s.rowLeft}>
                <Ionicons name="pricetag-outline" size={22} color={isGuest ? colors.textMuted : colors.textSecondary} />
                <View>
                  <Text style={[s.rowTitle, isGuest && { color: colors.textMuted }]}>{t('settings.category')}</Text>
                  {isGuest && <Text style={[s.rowSubtitle, { color: colors.textMuted }]}>{t('settings.loginRequired')}</Text>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {!isGuest && <Text style={s.rowValue}>{catLabel}</Text>}
                {isGuest && <Ionicons name="lock-closed" size={16} color={colors.textMuted} />}
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
              <Switch value={autoReadEnabled} onValueChange={setAutoRead} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={autoReadEnabled ? colors.primary : '#f4f3f4'} />
            </View>
          </View>
        </View>

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
  });
}
