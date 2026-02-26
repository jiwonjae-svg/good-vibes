import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useUserStore, type QuoteCategory } from '../../stores/useUserStore';
import { LANGUAGES, type LanguageCode } from '../../i18n';
import { useGoogleAuth, signInWithGoogle, logOut, onAuthChange } from '../../services/authService';
import { scheduleDailyReminder, cancelDailyReminder } from '../../services/notificationService';
import LanguagePickerModal from '../../components/LanguagePickerModal';

const CATEGORIES: { key: QuoteCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'categories.all' },
  { key: 'love', labelKey: 'categories.love' },
  { key: 'growth', labelKey: 'categories.growth' },
  { key: 'life', labelKey: 'categories.life' },
  { key: 'morning', labelKey: 'categories.morning' },
  { key: 'courage', labelKey: 'categories.courage' },
  { key: 'happiness', labelKey: 'categories.happiness' },
  { key: 'patience', labelKey: 'categories.patience' },
  { key: 'wisdom', labelKey: 'categories.wisdom' },
  { key: 'friendship', labelKey: 'categories.friendship' },
  { key: 'success', labelKey: 'categories.success' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const {
    isPremium, setPremium, totalQuotesViewed,
    isDarkMode, setDarkMode,
    language, setLanguage,
    category, setCategory,
    dailyReminderEnabled, setDailyReminder,
    uid, displayName, email, setAuth,
    currentStreak,
  } = useUserStore();

  const { response, promptAsync } = useGoogleAuth();
  const [langModalVisible, setLangModalVisible] = useState(false);

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

  const handlePremiumToggle = (value: boolean) => {
    if (value) {
      Alert.alert(t('settings.premium'), t('settings.premiumAlert'), [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.activate'), onPress: () => setPremium(true) },
      ]);
    } else { setPremium(false); }
  };

  const handleLanguage = () => setLangModalVisible(true);

  const handleCategory = () => {
    Alert.alert(t('settings.selectCategory'), '', [
      ...CATEGORIES.map((c) => ({
        text: t(c.labelKey) + (category === c.key ? ' ✓' : ''),
        onPress: () => setCategory(c.key),
      })),
      { text: t('settings.cancel'), style: 'cancel' as const },
    ]);
  };

  const handleNotification = async (enabled: boolean) => {
    if (enabled) { await scheduleDailyReminder(); }
    else { await cancelDailyReminder(); }
    setDailyReminder(enabled);
  };

  const handleLogout = async () => {
    await logOut();
    setAuth(null);
  };

  const s = makeStyles(colors);
  const currentLangLabel = LANGUAGES.find((l) => l.code === language)?.label ?? '한국어';
  const currentCatLabel = t(CATEGORIES.find((c) => c.key === category)?.labelKey ?? 'categories.all');

  return (
    <SafeAreaView style={[s.safe]} edges={['top']}>
      <LanguagePickerModal
        visible={langModalVisible}
        current={language}
        onSelect={(lang) => setLanguage(lang)}
        onClose={() => setLangModalVisible(false)}
      />
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        <Text style={s.header}>{t('settings.title')}</Text>

        {currentStreak > 1 && (
          <View style={s.streakBanner}>
            <Text style={s.streakText}>🔥 {currentStreak}{t('grass.streak')}</Text>
          </View>
        )}

        {/* Account */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.account')}</Text>
          <View style={s.card}>
            {uid ? (
              <>
                <View style={s.row}>
                  <View style={s.rowLeft}>
                    <Ionicons name="person-circle" size={22} color={colors.primary} />
                    <View>
                      <Text style={s.rowTitle}>{displayName ?? email ?? 'User'}</Text>
                      <Text style={s.rowSubtitle}>{t('settings.loggedInAs')} {email}</Text>
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
              <Pressable style={s.row} onPress={() => promptAsync()}>
                <View style={s.rowLeft}>
                  <Ionicons name="logo-google" size={22} color={colors.textSecondary} />
                  <View>
                    <Text style={s.rowTitle}>{t('settings.login')}</Text>
                    <Text style={s.rowSubtitle}>{t('settings.loginDesc')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Subscription */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.subscription')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="diamond-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.premium')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.premiumDesc')}</Text>
                </View>
              </View>
              <Switch value={isPremium} onValueChange={handlePremiumToggle} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={isPremium ? colors.primary : '#f4f3f4'} />
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.language')}</Text>
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
            <Pressable style={s.row} onPress={handleCategory}>
              <View style={s.rowLeft}>
                <Ionicons name="pricetag-outline" size={22} color={colors.textSecondary} />
                <Text style={s.rowTitle}>{t('settings.category')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.rowValue}>{currentCatLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Notifications */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.notifications')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                <View>
                  <Text style={s.rowTitle}>{t('settings.dailyReminder')}</Text>
                  <Text style={s.rowSubtitle}>{t('settings.dailyReminderDesc')}</Text>
                </View>
              </View>
              <Switch value={dailyReminderEnabled} onValueChange={handleNotification} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={dailyReminderEnabled ? colors.primary : '#f4f3f4'} />
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.stats')}</Text>
          <View style={s.card}>
            <View style={s.statRow}>
              <Text style={s.statLabel}>{t('settings.quotesViewed')}</Text>
              <Text style={s.statValue}>{totalQuotesViewed}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.info')}</Text>
          <View style={s.card}>
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
              <Text style={s.rowValue}>Good Vibe Team</Text>
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.primaryLight }]}>Good Vibe</Text>
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
    card: { backgroundColor: colors.surface, marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    rowTitle: { ...Fonts.body, fontSize: FontSize.md, color: colors.textPrimary },
    rowSubtitle: { ...Fonts.body, fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },
    rowValue: { ...Fonts.body, fontSize: FontSize.sm, color: colors.textSecondary },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
    statLabel: { ...Fonts.body, fontSize: FontSize.md, color: colors.textPrimary },
    statValue: { ...Fonts.heading, fontSize: FontSize.md, color: colors.primary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.grass0, marginLeft: Spacing.xxl + Spacing.sm },
    footer: { alignItems: 'center', paddingVertical: Spacing.xxl },
    footerText: { ...Fonts.heading, fontSize: FontSize.lg },
  });
}
