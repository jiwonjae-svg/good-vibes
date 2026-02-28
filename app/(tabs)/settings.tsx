import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useUserStore } from '../../stores/useUserStore';
import { LANGUAGES, type LanguageCode } from '../../i18n';
import { useGoogleAuth, signInWithGoogle, logOut, onAuthChange } from '../../services/authService';
import { scheduleDailyReminder, cancelDailyReminder } from '../../services/notificationService';
import LanguagePickerModal from '../../components/LanguagePickerModal';
import CategoryPickerModal from '../../components/CategoryPickerModal';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const {
    isPremium, setPremium, totalQuotesViewed,
    isDarkMode, setDarkMode,
    language, setLanguage,
    selectedCategories, setCategories,
    dailyReminderEnabled, setDailyReminder,
    autoReadEnabled, setAutoRead,
    uid, displayName, email, setAuth,
    currentStreak,
    todayViewedQuoteIds,
  } = useUserStore();

  const { response, promptAsync } = useGoogleAuth();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [viewedModalVisible, setViewedModalVisible] = useState(false);

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

  const handlePremiumToggle = async (value: boolean) => {
    if (value) {
      setPremium(true);
    } else {
      setPremium(false);
    }
  };

  const handleLanguage = () => setLangModalVisible(true);
  const handleCategory = () => setCatModalVisible(true);

  const handleNotification = async (enabled: boolean) => {
    if (enabled) await scheduleDailyReminder();
    else await cancelDailyReminder();
    setDailyReminder(enabled);
  };

  const handleLogout = async () => {
    await logOut();
    setAuth(null);
  };

  const s = makeStyles(colors);
  const currentLangLabel = LANGUAGES.find((l) => l.code === language)?.label ?? '한국어';
  const catCount = selectedCategories.length;
  const catLabel = catCount === 0 ? t('settings.allCategories') : t('settings.categoriesSelected', { count: catCount });

  const viewedQuotes = todayViewedQuoteIds.map((q) => {
    const [id, ...textParts] = q.split('|');
    return { id, text: textParts.join('|') };
  });

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

      {/* Today's Viewed Quotes Modal */}
      <Modal transparent visible={viewedModalVisible} animationType="fade" onRequestClose={() => setViewedModalVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setViewedModalVisible(false)}>
          <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.grass0 }]}>
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{t('settings.todayQuotes')}</Text>
              <Pressable onPress={() => setViewedModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            {viewedQuotes.length === 0 ? (
              <View style={s.emptyView}>
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>{t('settings.noQuotesToday')}</Text>
              </View>
            ) : (
              <FlatList
                data={viewedQuotes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[s.quoteItem, { borderBottomColor: colors.grass0 }]}>
                    <Text style={[s.quoteItemText, { color: colors.textPrimary }]}>"{item.text}"</Text>
                  </View>
                )}
                style={{ maxHeight: 400 }}
              />
            )}
          </View>
        </Pressable>
      </Modal>

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
              <Switch value={autoReadEnabled} onValueChange={setAutoRead} trackColor={{ false: colors.grass0, true: colors.primaryLight }} thumbColor={autoReadEnabled ? colors.primary : '#f4f3f4'} />
            </View>
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
            <Pressable style={s.statRow} onPress={() => setViewedModalVisible(true)}>
              <Text style={s.statLabel}>{t('settings.quotesViewed')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.statValue}>{totalQuotesViewed}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    modalSheet: { width: '100%', borderRadius: BorderRadius.xl, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
    modalTitle: { ...Fonts.heading, fontSize: FontSize.lg },
    emptyView: { padding: Spacing.xxl, alignItems: 'center' },
    emptyText: { ...Fonts.body, fontSize: FontSize.md },
    quoteItem: { padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
    quoteItemText: { ...Fonts.body, fontSize: FontSize.sm, lineHeight: 22 },
  });
}
