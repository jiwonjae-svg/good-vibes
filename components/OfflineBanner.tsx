import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { useUserStore } from '../stores/useUserStore';

interface Props {
  onDismiss?: () => void;
}

export default function OfflineBanner({ onDismiss }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useUserStore((s) => s.isDarkMode);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#2c1f1f' : '#fff0f0', transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#FF6B6B" />
      <View style={styles.textWrapper}>
        <Text style={[styles.title, { color: '#FF6B6B' }]}>{t('home.offline')}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{t('home.offlineDesc')}</Text>
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,107,107,0.2)',
  },
  textWrapper: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700' },
  desc: { fontSize: 11, marginTop: 1 },
});
