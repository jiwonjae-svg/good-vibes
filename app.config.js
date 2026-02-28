export default {
  expo: {
    name: "DailyGlow",
    slug: "dailyglow",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "com.jiwonjae.dailyglow",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FFF8F0",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.jiwonjae.dailyglow",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSSpeechRecognitionUsageDescription:
          "Speech recognition is used for the speak-along feature.",
        NSMicrophoneUsageDescription:
          "Microphone is used for the speak-along feature.",
        NSCameraUsageDescription: "Camera is used for the write-along feature.",
      },
    },
    android: {
      package: "com.jiwonjae.dailyglow",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFF8F0",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
      ],
    },
    plugins: [
      "expo-router",
      "expo-localization",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#FF9F7E",
        },
      ],
      [
        "expo-speech-recognition",
        {
          microphonePermission: "Microphone is needed for speak-along.",
          speechRecognitionPermission:
            "Speech recognition is used for speak-along.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Camera is needed for write-along.",
        },
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          iosAppId: "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
        },
      ],
      [
        "@sentry/react-native/expo",
        {
          organization: "YOUR_ORG",
          project: "dailyglow",
        },
      ],
      "expo-web-browser",
      "@react-native-firebase/app",
    ],
    extra: {
      eas: {
        "projectId": "ec12b53d-6403-4d94-a4af-f950c64e8892"
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      grokModel: process.env.EXPO_PUBLIC_GROK_MODEL,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
  },
};
