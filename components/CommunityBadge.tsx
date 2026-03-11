import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { Fonts, FontSize, BorderRadius, Spacing } from '../constants/theme';

interface CommunityBadgeProps {
  size?: 'sm' | 'md';
}

export default function CommunityBadge({ size = 'sm' }: CommunityBadgeProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isSm = size === 'sm';

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: colors.secondary + '30',
        borderColor: colors.secondary,
        paddingHorizontal: isSm ? Spacing.xs : Spacing.sm,
        paddingVertical: isSm ? 2 : 4,
      },
    ]}>
      <Text style={[
        styles.text,
        {
          color: colors.secondary,
          fontSize: isSm ? FontSize.xs : FontSize.sm,
        },
      ]}>
        {'👥 '}{t('community.badge')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    ...Fonts.body,
    fontWeight: '600',
  },
});
