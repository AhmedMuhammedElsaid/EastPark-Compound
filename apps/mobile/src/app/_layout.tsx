import type { Href } from "expo-router";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider } from "@react-navigation/native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { StyleSheet } from "react-native";
import FlashMessage from "react-native-flash-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { AuthWallSheet } from "@/components/auth/auth-wall-sheet";
import { CartConflictSheet } from "@/components/cart/cart-conflict-sheet";

import { useThemeConfig } from "@/components/ui/use-theme-config";
import { useAuthRehydration } from "@/lib/hooks/use-auth-rehydration";
import { usePushTokenRefresh } from "@/lib/hooks/use-push-token-refresh";
import { loadSelectedTheme } from "@/lib/hooks/use-selected-theme";
import i18n from "@/lib/i18n";
import { ensureLayoutDirection } from "@/lib/i18n/layout-direction";
import { injectStore, setSessionExpiredHandler, warmUpServer } from "@/services/api/client";
import { teardownSession } from "@/services/auth/session";
import { getNotificationHref } from "@/services/notifications/routing";
import { invalidateRedactedQueries, queryClient, queryPersistOptions } from "@/services/query/client";
import { persistor, store, useAppSelector } from "@/store";
// Global CSS must be imported before other app modules
import "../global.css";

// Inject Redux store into the Axios client for 401 token refresh + logout dispatch
injectStore(store);
// A definitively rejected refresh token ends the session everywhere
// (tokens, Redux, query cache, socket) and returns to login.
setSessionExpiredHandler(() => teardownSession({ redirectToLogin: true }));

// Render free tier cold-starts in 25-50 s — start waking it immediately.
warmUpServer();

// Show pushes received while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
          persistOptions={queryPersistOptions}
          onSuccess={invalidateRedactedQueries}
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

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  usePushTokenRefresh(isAuthenticated);

  // After redux-persist rehydrates (Providers renders inside PersistGate), apply
  // the saved language to i18n and make the NATIVE layout direction match it.
  // On first launch that needs one reload (guarded against loops).
  React.useEffect(() => {
    if (!savedLanguage)
      return;
    if (i18n.language !== savedLanguage)
      i18n.changeLanguage(savedLanguage);
    ensureLayoutDirection(savedLanguage);
  }, [savedLanguage]);

  // Navigate to the relevant screen when user taps a push notification.
  React.useEffect(() => {
    function openNotification(response: Notifications.NotificationResponse) {
      // Consume it so a remount never routes the same tap twice.
      Notifications.clearLastNotificationResponse();
      const data = response.notification.request.content.data as Record<string, unknown> | null;
      const href = getNotificationHref(data?.type, data);
      if (href)
        router.push(href as Href);
    }
    // A tap that cold-starts the app arrives before this listener exists.
    const launchResponse = Notifications.getLastNotificationResponse();
    if (launchResponse)
      openNotification(launchResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
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
