import type { ConfigContext, ExpoConfig } from "@expo/config";

import type { AppIconBadgeConfig } from "app-icon-badge/types";

import "tsx/cjs";

// adding lint exception as we need to import tsx/cjs before env.ts is imported
// eslint-disable-next-line perfectionist/sort-imports
import Env from "./env";

// EAS project under the volunteering-apps account (relinked 2026-10-07)
const EAS_PROJECT_ID = "7c09d58b-c103-461c-ad6f-7fc77a279133";

const appIconBadgeConfig: AppIconBadgeConfig = {
  // Only local development builds get the env/version ribbon; preview APKs
  // installed by the owner show the real brand icon.
  enabled: Env.EXPO_PUBLIC_APP_ENV === "development",
  badges: [
    {
      text: Env.EXPO_PUBLIC_APP_ENV,
      type: "banner",
      color: "white",
    },
    {
      text: Env.EXPO_PUBLIC_VERSION.toString(),
      type: "ribbon",
      color: "white",
    },
  ],
};

// eslint-disable-next-line max-lines-per-function -- one declarative Expo config object
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "volunteering-apps",
  name: Env.EXPO_PUBLIC_NAME,
  description: "EastPark — Residential Compound Super-App",
  scheme: Env.EXPO_PUBLIC_SCHEME,
  slug: "eastpark-app",
  version: Env.EXPO_PUBLIC_VERSION.toString(),
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: Env.EXPO_PUBLIC_BUNDLE_ID,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0d0c0b",
    },
    package: Env.EXPO_PUBLIC_PACKAGE,
    permissions: [
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: Env.EXPO_PUBLIC_SCHEME }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        // EastPark brand dark background
        backgroundColor: "#0d0c0b",
        image: "./assets/splash-icon.png",
        imageWidth: 240,
      },
    ],
    [
      "expo-font",
      {
        ios: {
          fonts: [
            // Alexandria — primary UI font (same as the web app), vendored in assets/fonts
            "./assets/fonts/Alexandria_400Regular.ttf",
            "./assets/fonts/Alexandria_500Medium.ttf",
            "./assets/fonts/Alexandria_600SemiBold.ttf",
            "./assets/fonts/Alexandria_700Bold.ttf",
            // Cormorant Garamond — display/hero only, English only
            "node_modules/@expo-google-fonts/cormorant-garamond/400Regular/CormorantGaramond_400Regular.ttf",
            "node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf",
            "node_modules/@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf",
          ],
        },
        android: {
          fonts: [
            {
              fontFamily: "Alexandria",
              fontDefinitions: [
                {
                  path: "./assets/fonts/Alexandria_400Regular.ttf",
                  weight: 400,
                },
                {
                  path: "./assets/fonts/Alexandria_500Medium.ttf",
                  weight: 500,
                },
                {
                  path: "./assets/fonts/Alexandria_600SemiBold.ttf",
                  weight: 600,
                },
                {
                  path: "./assets/fonts/Alexandria_700Bold.ttf",
                  weight: 700,
                },
              ],
            },
            {
              fontFamily: "CormorantGaramond",
              fontDefinitions: [
                {
                  path: "node_modules/@expo-google-fonts/cormorant-garamond/400Regular/CormorantGaramond_400Regular.ttf",
                  weight: 400,
                },
                {
                  path: "node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf",
                  weight: 600,
                },
                {
                  path: "node_modules/@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf",
                  weight: 700,
                },
              ],
            },
          ],
        },
      },
    ],
    "expo-localization",
    "expo-router",
    "expo-notifications",
    [
      "expo-image-picker",
      {
        photosPermission: "Allow EastPark to access your photos so you can attach them to feedback.",
        cameraPermission: "Allow EastPark to use the camera so you can attach a photo to feedback.",
        microphonePermission: false,
      },
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Allow EastPark to use Face ID to sign you in faster.",
      },
    ],
    ["app-icon-badge", appIconBadgeConfig],
    // Fully transparent button-navigation bar: the tab bar paints its own
    // background under it instead of Android's light contrast scrim.
    ["react-native-edge-to-edge", { android: { enforceNavigationBarContrast: false } }],
  ],
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
    apiUrl: Env.EXPO_PUBLIC_API_URL,
    socketUrl: Env.EXPO_PUBLIC_SOCKET_URL,
    posthogKey: Env.EXPO_PUBLIC_POSTHOG_KEY,
  },
});
