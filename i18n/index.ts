import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import ko from './locales/ko';
import en from './locales/en';
import ja from './locales/ja';
import zh from './locales/zh';

export const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const deviceLang = Localization.getLocales()?.[0]?.languageCode ?? 'ko';
const defaultLang = LANGUAGES.find((l) => l.code === deviceLang) ? deviceLang : 'ko';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
    zh: { translation: zh },
  },
  lng: defaultLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export default i18n;
