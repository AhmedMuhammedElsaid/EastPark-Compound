import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { ThemeProvider } from "@react-navigation/native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { I18nManager, StyleSheet } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { AuthWallSheet } from "@/components/auth/auth-wall-sheet";
import { CartConflictSheet } from "@/components/cart/cart-conflict-sheet";

import { useThemeConfig } from "@/components/ui/use-theme-config";
import { useAuthRehydration } from "@/lib/hooks/use-auth-rehydration";
import { loadSelectedTheme } from "@/lib/hooks/use-selected-theme";
import i18n from "@/lib/i18n";
import { injectStore } from "@/services/api/client";
import { asyncStoragePersister, queryClient } from "@/services/query/client";
import { persistor, store, useAppSelector } from "@/store";
// Global CSS must be imported before other app modules
import "../global.css";

// Inject Redux store into the Axios client for 401 token refresh + logout dispatch
injectStore(store);

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
        >
          <Providers>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(merchant)" options={{ headerShown: false }} />
              <Stack.Screen name="(admin)" options={{ headerShown: false }} />
              <Stack.Screen name="checkout" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
            </Stack>
          </Providers>
        </PersistQueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  useAuthRehydration();
  const theme = useThemeConfig();
  const savedLanguage = useAppSelector(s => s.preferences.language);
  const router = useRouter();

  // Restore theme from AsyncStorage on mount
  React.useEffect(() => {
    loadSelectedTheme();
  }, []);

  // After redux-persist rehydrates, apply the saved language to i18n and RTL.
  // This runs on first mount (initial state 'ar') and again after rehydration with persisted value.
  React.useEffect(() => {
    if (savedLanguage && i18n.language !== savedLanguage) {
      i18n.changeLanguage(savedLanguage);
      I18nManager.allowRTL(savedLanguage === "ar");
      I18nManager.forceRTL(savedLanguage === "ar");
    }
  }, [savedLanguage]);

  // Navigate to the relevant screen when user taps a push notification.
  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        referenceId?: string;
      };
      if (!data?.type || !data?.referenceId)
        return;

      switch (data.type) {
        case "ORDER_UPDATE":
          router.push(`/(tabs)/orders/${data.referenceId}` as any);
          break;
        case "ANNOUNCEMENT":
          router.push(`/(tabs)/community/${data.referenceId}` as any);
          break;
        case "FEEDBACK_REPLY":
          router.push(`/(tabs)/community/feedback/${data.referenceId}` as any);
          break;
        case "POLL":
          router.push(`/(tabs)/community/governance/polls/${data.referenceId}` as any);
          break;
        case "ELECTION":
          router.push(`/(tabs)/community/governance/elections/${data.referenceId}` as any);
          break;
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <GestureHandlerRootView
      style={styles.container}
      // eslint-disable-next-line better-tailwindcss/no-unknown-classes
      className={theme.dark ? "dark" : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <BottomSheetModalProvider>
            {children}
            <AuthWallSheet />
            <CartConflictSheet />
            <FlashMessage position="top" />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
