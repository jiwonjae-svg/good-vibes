<div align="center">

# ✨ DailyGlow

**Your AI-Powered Daily Quote Companion**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/jiwonjae-svg/dailyglow)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-blue.svg?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue.svg?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

*AI-generated quotes every day — speak, write, or type along to grow.*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [Contributing](#-contributing)

---

</div>

## 🎯 What is DailyGlow?

DailyGlow is a **mobile app for daily positive habits** powered by AI-generated quotes. Each day, the app delivers fresh, inspirational quotes in your language, and challenges you to engage with them — by speaking, handwriting, or typing — turning passive reading into active learning.

Perfect for:
- 📖 **Learners** building a daily reading or writing habit
- 🧘 **Mindfulness seekers** looking for daily positive reinforcement
- 🌏 **Language learners** practicing in Korean, English, Japanese, or Chinese
- 💪 **Self-improvement enthusiasts** who love streaks and progress tracking

## ✨ Features

### 🤖 AI-Powered Quotes
- **Daily Generation**: Grok 4.1 Fast (xAI) generates fresh, warm quotes
- **150+ Categories**: Organized into 5 themes (Life/Growth, Emotion/Relationship, Work/Business, Nature/Philosophy, Special)
- **Multi-Select**: Choose up to 10 categories to personalize your feed
- **Multi-language**: Quotes generated in your selected language (Korean, English, Japanese, Chinese)
- **Offline Fallback**: 100+ seed quotes when no internet connection

### 📱 Engaging Activities
- **Speak Along** 🎤: Read quotes aloud with speech recognition & similarity matching
- **Write Along** ✍️: Handwrite quotes, capture with camera, verify via OCR
- **Type Along** ⌨️: Real-time character-by-character typing with visual highlights
- **AI Praise**: Personalized encouragement after every completed activity

### 📊 Progress & Gamification
- **Grass Field**: GitHub-style 365-day activity contribution graph with touch-to-view details
- **Daily Streak**: Consecutive day tracking with special milestone rewards
- **Bookmark**: Save your favorite quotes for later
- **Statistics**: Total quotes viewed, today's viewed quotes list, and active days tracked
- **Auto-Read**: Optional automatic TTS when viewing new quotes

### 🔐 Account & Sync
- **Google OAuth**: One-tap sign-in with Google
- **Email Auth**: Traditional email/password with password reset
- **Guest Mode**: Continue without account
- **Firebase Sync**: Data synced across devices when logged in

### 🌍 Personalization
- **4 Languages**: Korean 🇰🇷, English 🇺🇸, Japanese 🇯🇵, Chinese 🇨🇳
- **Dark Mode**: Full dark theme, toggleable in settings
- **Notification**: Daily 9 AM reminder (configurable)
- **Premium**: Ad-free experience upgrade

### 📣 Sharing & Widgets
- **SNS Share**: Share quotes to any social platform
- **Home Screen Widget**: Today's quote on your home screen (iOS)
- **Ads**: AdMob interstitial every 5 quotes (premium-exempt)

## 📦 Installation

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- iOS Simulator / Android Emulator **or** Expo Go app

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jiwonjae-svg/dailyglow.git
cd dailyglow

# Install dependencies
npm install

# Start with Expo Go (limited features)
npx expo start --clear
```

### Development Build (Recommended — Full Features)

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

> **Note**: Features like Speech Recognition, AdMob, and Push Notifications require a development build. They are not supported in Expo Go.

### Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your API keys in `.env`:
```env
# xAI Grok API
EXPO_PUBLIC_GROK_API_KEY=xai-...

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...

# Google OAuth (required for Google Sign-In)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
```

See `.env.example` for detailed instructions on obtaining each key.

> The app runs fully offline without any API keys — seed quotes and local storage handle everything.

## 🚀 Usage

### First Launch Flow

1. **Login Screen**: Sign in with Google, email, or skip
2. **Onboarding**: 4-slide tutorial of key features
3. **Home Feed**: Vertical snap-scroll quote cards

### Quote Activities

| Activity | How to Use |
|----------|-----------|
| **Speak Along** 🎤 | Tap mic button → Read the quote aloud → See match percentage |
| **Write Along** ✍️ | Tap pencil button → Handwrite on paper → Take photo → Verify |
| **Type Along** ⌨️ | Tap keyboard button → Type quote character by character → Watch highlights |

### Settings

| Option | Description |
|--------|-------------|
| **Language** | Tap → Language picker modal → Select language → Quotes reload automatically |
| **Dark Mode** | Toggle for full dark theme |
| **Category** | Filter quote themes |
| **Daily Reminder** | Push notification at 9 AM |
| **Premium** | Remove all ads |
| **Account** | Google / email login, logout |

### Keyboard Shortcuts (TypeAlong)

| Input | Effect |
|-------|--------|
| Type correct char | Turns green |
| Type wrong char | Turns red |
| Complete quote | Triggers praise & grass fill |

## 📁 Project Structure

```
dailyglow/
│
├── 📄 app.json                    # Expo config (plugins, permissions)
├── 📄 package.json                # Dependencies
├── 📄 tsconfig.json               # TypeScript config
│
├── 📁 app/                        # File-based routing (expo-router)
│   ├── _layout.tsx                # Root layout: Login → Onboarding → App
│   ├── login.tsx                  # Login / Sign up / Forgot password
│   └── (tabs)/
│       ├── _layout.tsx            # Tab bar (Quotes, Grass, Settings)
│       ├── index.tsx              # Home — snap-scroll quote cards
│       ├── grass.tsx              # Activity grass field + streak
│       └── settings.tsx           # All user settings
│
├── 📁 components/                 # Reusable UI
│   ├── QuoteCard.tsx              # Quote card with bookmark, share, activities
│   ├── OnboardingScreen.tsx       # 4-slide first-run tutorial
│   ├── SpeakAlongSheet.tsx        # Speech recognition bottom sheet
│   ├── WriteAlongSheet.tsx        # Camera + OCR bottom sheet
│   ├── TypeAlongSheet.tsx         # Typing challenge with highlights
│   ├── PraiseModal.tsx            # Celebration modal with TTS
│   ├── GrassGrid.tsx              # 365-day contribution grid with touch details
│   ├── LanguagePickerModal.tsx    # Language selection modal
│   ├── CategoryPickerModal.tsx    # Hierarchical category selection (150+ categories)
│   └── AdInterstitial.tsx         # AdMob interstitial manager
│
├── 📁 services/                   # Business logic & API
│   ├── grokApi.ts                 # xAI Grok API (multi-lang + category)
│   ├── authService.ts             # Firebase Auth: Google, Email, Password Reset
│   ├── firebaseConfig.ts          # Firestore + offline persistence
│   ├── quoteService.ts            # Quote generation, caching, offline
│   ├── praiseService.ts           # AI praise generation
│   ├── notificationService.ts     # Push notifications (Expo Go safe)
│   ├── shareService.ts            # SNS sharing
│   ├── sentryService.ts           # Error monitoring (production only)
│   ├── adService.ts               # AdMob logic
│   └── widgetService.ts           # Home screen widget data
│
├── 📁 stores/                     # Zustand state management
│   ├── useQuoteStore.ts           # Quote list state
│   ├── useGrassStore.ts           # Daily activity data
│   └── useUserStore.ts            # Auth, prefs, bookmarks, streak
│
├── 📁 hooks/                      # Custom React hooks
│   ├── useTTS.ts                  # Text-to-speech (expo-speech)
│   ├── useSpeechRecognition.ts    # Speech recognition (Expo Go safe)
│   ├── useTextRecognition.ts      # OCR placeholder
│   └── useThemeColors.ts          # Dark/light theme colors
│
├── 📁 i18n/                       # Internationalization
│   ├── index.ts                   # i18next config + language detection
│   └── locales/
│       ├── ko.ts                  # Korean
│       ├── en.ts                  # English
│       ├── ja.ts                  # Japanese
│       └── zh.ts                  # Chinese
│
├── 📁 constants/                  # Configuration
│   ├── theme.ts                   # LightColors + DarkColors
│   └── config.ts                  # API keys & app settings
│
├── 📁 data/                       # Seed data
│   ├── quotes.ts                  # Client quotes (from crawl)
│   ├── quotesClient.json          # 800 crawled quotes (Quotable, Wikiquote, Gutenberg)
│   ├── quotes_merged.json         # Full merged crawl output
│   ├── seedPraises.ts             # 20 offline praise messages
│   └── categories.ts              # 150+ hierarchical categories
│
└── 📁 utils/                      # Utilities
    ├── similarity.ts              # Levenshtein text similarity
    └── dateUtils.ts               # Date helpers
```

## 🏗️ Architecture

DailyGlow follows a **layered architecture** with clean separation of concerns:

```
┌──────────────────────────────────────────────┐
│           Presentation Layer                  │  ← app/, components/
│     (expo-router, React Native screens)       │
├──────────────────────────────────────────────┤
│           State Layer (Zustand)               │  ← stores/
│   (quotes, grass, user prefs, auth, streak)   │
├──────────────────────────────────────────────┤
│           Service Layer                       │  ← services/
│   (Grok API, Firebase, Notifications, Ads)    │
├──────────────────────────────────────────────┤
│           Data Layer                          │  ← AsyncStorage + Firestore
│   (offline-first: local cache → cloud sync)   │
└──────────────────────────────────────────────┘
```

### Offline-First Strategy

```
Online:  Grok API → Firestore → AsyncStorage cache → Display
Offline: AsyncStorage cache → Seed quotes (100+)   → Display
```

### Expo Go Compatibility

Modules incompatible with Expo Go are conditionally loaded:

| Module | Strategy |
|--------|----------|
| `expo-notifications` | `require()` inside function, guarded by `isExpoGo` |
| `expo-speech-recognition` | `try/catch` dynamic require with `isAvailable` flag |
| `react-native-google-mobile-ads` | `Constants.executionEnvironment` guard |
| `@sentry/react-native` | Production-only, skipped in `__DEV__` |

## 🔧 Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | Expo SDK 54 + React Native 0.81 | Mobile app (iOS + Android) |
| **Language** | TypeScript 5.9 | Type-safe development |
| **Navigation** | expo-router 6 | File-based routing |
| **AI** | xAI Grok 4.1 Fast | Quote & praise generation |
| **Auth** | Firebase Auth + expo-auth-session | Google OAuth + Email |
| **Database** | Firebase Firestore + AsyncStorage | Cloud + offline storage |
| **State** | Zustand 5 | Lightweight state management |
| **TTS** | expo-speech | Text-to-speech output |
| **Speech** | expo-speech-recognition | Voice recognition input |
| **i18n** | i18next + react-i18next | Multi-language support |
| **Animations** | react-native-reanimated 4 | Smooth UI animations |
| **Ads** | react-native-google-mobile-ads | AdMob interstitials |
| **Monitoring** | @sentry/react-native | Production crash reporting |
| **Notifications** | expo-notifications | Daily reminders |

## ⚡ Performance

- **New Architecture**: Fabric + TurboModules enabled (`newArchEnabled: true`)
- **Snap Scrolling**: Native `pagingEnabled` FlatList for 60fps transitions
- **Quote Prefetch**: Fetches next batch 3 quotes before the end of the list
- **Offline-First**: Seed quotes load instantly, API runs in background
- **Conditional Loading**: Native modules loaded lazily to prevent Expo Go crashes

## 🛡️ Privacy & Security

- ✅ **No tracking** — zero analytics or telemetry
- ✅ **Local-first** — all data stored on device by default
- ✅ **Optional cloud sync** — only when logged in to Firebase
- ✅ **Open source** — audit the code yourself

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT © [DailyGlow Team](https://github.com/jiwonjae-svg/dailyglow)
