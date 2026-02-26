import { useUserStore } from '../stores/useUserStore';
import { LightColors, DarkColors } from '../constants/theme';

export type AppColors = typeof LightColors | typeof DarkColors;

export function useThemeColors() {
  const isDark = useUserStore((s) => s.isDarkMode);
  return isDark ? DarkColors : LightColors;
}
