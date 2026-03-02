import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../hooks/useThemeColors';
import { FontSize, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { CATEGORY_THEMES, type Category } from '../data/categories';

const MAX_CATEGORIES = 10;

interface CategoryPickerModalProps {
  visible: boolean;
  selected: string[];
  onSelect: (categories: string[]) => void;
  onClose: () => void;
}

export default function CategoryPickerModal({
  visible, selected, onSelect, onClose,
}: CategoryPickerModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setLocalSelected(selected);
      setExpandedThemes(new Set());
    }
  }, [visible, selected]);

  const toggleTheme = (themeKey: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeKey)) next.delete(themeKey);
      else next.add(themeKey);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setLocalSelected((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= MAX_CATEGORIES) {
        Alert.alert(
          t('categoryPicker.limitTitle'),
          t('categoryPicker.limitMessage', { max: MAX_CATEGORIES }),
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  const handleConfirm = () => {
    onSelect(localSelected);
    onClose();
  };

  const handleSelectAll = () => {
    const allKeys = CATEGORY_THEMES.flatMap((theme) =>
      theme.categories.map((c) => c.key),
    );
    setLocalSelected([]);
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  const renderCategory = (cat: Category) => {
    const isSelected = localSelected.includes(cat.key);
    return (
      <Pressable
        key={cat.key}
        style={[
          styles.categoryChip,
          { backgroundColor: isSelected ? colors.primary : colors.surfaceAlt },
        ]}
        onPress={() => toggleCategory(cat.key)}
      >
        <Text
          style={[
            styles.categoryLabel,
            { color: isSelected ? '#fff' : colors.textPrimary },
          ]}
        >
          {t(cat.labelKey)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.grass0 }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('categoryPicker.title')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.countRow}>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {t('categoryPicker.selected', { count: localSelected.length, max: MAX_CATEGORIES })}
            </Text>
            <Pressable onPress={handleClearAll}>
              <Text style={[styles.clearText, { color: colors.primary }]}>
                {t('categoryPicker.clearAll')}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {CATEGORY_THEMES.map((theme) => {
              const isExpanded = expandedThemes.has(theme.themeKey);
              const selectedInTheme = theme.categories.filter((c) =>
                localSelected.includes(c.key),
              ).length;

              return (
                <View key={theme.themeKey} style={styles.themeSection}>
                  <Pressable
                    style={[styles.themeHeader, { backgroundColor: colors.surfaceAlt }]}
                    onPress={() => toggleTheme(theme.themeKey)}
                  >
                    <View style={styles.themeHeaderLeft}>
                      <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>
                        {t(theme.themeKey)}
                      </Text>
                    </View>
                    {selectedInTheme > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{selectedInTheme}</Text>
                      </View>
                    )}
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.categoriesGrid}>
                      {theme.categories.map(renderCategory)}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.grass0 }]}>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>{t('categoryPicker.confirm')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '85%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { ...Fonts.heading, fontSize: FontSize.lg },
  closeBtn: { padding: Spacing.xs },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  countText: { ...Fonts.body, fontSize: FontSize.sm },
  clearText: { ...Fonts.body, fontSize: FontSize.sm },
  scrollArea: { flex: 1, minHeight: 200 },
  themeSection: { marginBottom: Spacing.xs },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  themeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  themeTitle: { ...Fonts.heading, fontSize: FontSize.md },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { ...Fonts.body, fontSize: FontSize.xs, color: '#fff' },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  categoryLabel: { ...Fonts.body, fontSize: FontSize.sm },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  confirmText: { ...Fonts.heading, fontSize: FontSize.md, color: '#fff' },
});
