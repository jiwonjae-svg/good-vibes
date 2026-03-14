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
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.jiwonjae.dailyglow",
      allowBackup: false,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFF8F0",
      },
      edgeToEdgeEnabled: true,
      navigationBar: {
        backgroundColor: "#FFF8F0",
      },
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
      ],
    },
    plugins: [
      "expo-router",
      "expo-font",
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
      "expo-web-browser",
      "@react-native-google-signin/google-signin",
      ["expo-navigation-bar", { visibility: "visible" }],
      "@react-native-firebase/app",
      './plugins/withWidget',
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-3940256099942544~3347511713",
          iosAppId: "ca-app-pub-3940256099942544~1458002511",
        },
      ],
    ],
    extra: {
      "eas": {
        "projectId": "69609514-3e81-487d-8804-c52500f5d001"
      },
      grokApiKey: process.env.EXPO_PUBLIC_GROK_API_KEY,
      grokModel: process.env.EXPO_PUBLIC_GROK_MODEL,
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppIdIos: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS,
      firebaseAppIdAndroid: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
  },
};
