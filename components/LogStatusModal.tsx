import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { getLogStatus, type LogStatus } from '../services/logger';
import { appLog } from '../services/logger';

interface LogStatusModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogStatusModal({ visible, onClose }: LogStatusModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [status, setStatus] = useState<LogStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      getLogStatus()
        .then(setStatus)
        .catch((e) => {
          appLog.error('[LogStatusModal] getLogStatus failed', e);
          setStatus({
            path: null,
            content: '',
            writeTestOk: false,
            writeTestError: String(e),
            readError: null,
          });
        })
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleCopy = async () => {
    if (!status?.content) return;
    await Clipboard.setStringAsync(status.content);
    Alert.alert(t('settings.logCopied'), t('settings.logCopiedDesc'));
  };

  const handleShare = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('common.ok'), t('settings.logShareWebNotSupported'));
      return;
    }
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert(t('common.ok'), t('settings.logShareNotAvailable'));
      return;
    }
    if (!status?.path || !status.content) {
      Alert.alert(t('common.ok'), t('settings.logShareNoContent'));
      return;
    }
    try {
      await Sharing.shareAsync(status.path, {
        mimeType: 'text/plain',
        dialogTitle: 'DailyGlow',
      });
    } catch (e: any) {
      Alert.alert(t('login.error'), e?.message ?? t('settings.logShareFailed'));
    }
  };

  const s = makeStyles(colors);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={s.header}>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t('settings.logStatus')}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : status ? (
            <>
              <View style={[s.statusBox, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[s.label, { color: colors.textSecondary }]}>{t('settings.logPath')}</Text>
                <Text style={[s.pathText, { color: colors.textPrimary }]} numberOfLines={2} selectable>
                  {status.path ?? t('settings.logPathNone')}
                </Text>
                <Text style={[s.label, { color: colors.textSecondary, marginTop: Spacing.sm }]}>{t('settings.logWriteTest')}</Text>
                <Text style={[s.statusText, { color: status.writeTestOk ? colors.primary : colors.error }]}>
                  {status.writeTestOk ? t('settings.logWriteOk') : `${t('settings.logWriteFail')}: ${status.writeTestError ?? status.readError ?? '-'}`}
                </Text>
              </View>

              <ScrollView
                style={[s.contentBox, { backgroundColor: colors.surfaceAlt }]}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text style={[s.contentText, { color: colors.textPrimary }]} selectable>
                  {status.content || t('settings.logEmpty')}
                </Text>
              </ScrollView>

              <View style={s.actions}>
                <Pressable
                  style={[s.btn, s.btnSecondary, { borderColor: colors.primary }]}
                  onPress={handleCopy}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                  <Text style={[s.btnText, { color: colors.primary }]}>{t('settings.logCopy')}</Text>
                </Pressable>
                {Platform.OS !== 'web' && (
                  <Pressable
                    style={[s.btn, { backgroundColor: colors.primary }]}
                    onPress={handleShare}
                  >
                    <Ionicons name="share-outline" size={20} color="#fff" />
                    <Text style={[s.btnText, { color: '#fff' }]}>{t('settings.logShare')}</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>{t('settings.logLoadFailed')}</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
    sheet: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: BorderRadius.xl, padding: Spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    title: { ...Fonts.heading, fontSize: FontSize.lg },
    loader: { padding: Spacing.xxl, alignItems: 'center' },
    statusBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
    label: { ...Fonts.body, fontSize: FontSize.xs, marginBottom: 4 },
    pathText: { ...Fonts.body, fontSize: FontSize.xs, fontFamily: 'monospace' },
    statusText: { ...Fonts.body, fontSize: FontSize.sm },
    contentBox: { maxHeight: 200, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
    contentText: { ...Fonts.body, fontSize: FontSize.xs, fontFamily: 'monospace' },
    emptyText: { ...Fonts.body, padding: Spacing.lg, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: Spacing.sm },
    btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md },
    btnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
    btnText: { ...Fonts.body, fontSize: FontSize.sm },
  });
}
