import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { getSecureItem } from "@/lib/secure-storage";

import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/client";
import { usersApi } from "@/services/api/users";
import { useAppDispatch } from "@/store";
import { login } from "@/store/slices/auth-slice";

/**
 * Reads persisted tokens from SecureStore on cold launch.
 * If valid tokens are found, fetches the user profile and rehydrates Redux auth state.
 * Always calls SplashScreen.hideAsync() in the finally block so the splash is dismissed.
 */
export function useAuthRehydration(): void {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    async function rehydrate() {
      try {
        const accessToken = await getSecureItem(SECURE_KEY_ACCESS);
        const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
        if (accessToken && refreshToken) {
          const { data } = await usersApi.getProfile();
          dispatch(login({ user: data.data, accessToken, refreshToken }));
        }
      }
      catch (err: any) {
        if (err?.response?.status === 401) {
          // legitimate expiry — tokens already cleared by 401 interceptor
        }
        else {
          // network error — don't clear tokens, let user retry
          if (__DEV__)
            console.warn("[auth-rehydration] network error on startup", err);
        }
      }
      finally {
        SplashScreen.hideAsync();
      }
    }
    rehydrate();
  }, [dispatch]);
}
