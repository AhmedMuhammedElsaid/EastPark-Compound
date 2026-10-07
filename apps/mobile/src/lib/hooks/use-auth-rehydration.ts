import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { getSecureItem } from "@/lib/secure-storage";

import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/client";
import { usersApi } from "@/services/api/users";
import { store, useAppDispatch } from "@/store";
import { login, logout } from "@/store/slices/auth-slice";

/**
 * Reads persisted tokens from SecureStore on cold launch.
 * If valid tokens are found, fetches the user profile and rehydrates Redux auth state;
 * if they are missing, clears a stale persisted "signed in" state.
 * The splash is hidden as soon as the tokens are read: the persisted user already renders
 * the signed-in UI, so a cold backend (Render free tier: up to ~60 s) never blocks launch.
 */
export function useAuthRehydration(): void {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    async function rehydrate() {
      try {
        const accessToken = await getSecureItem(SECURE_KEY_ACCESS);
        const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
        SplashScreen.hideAsync();
        if (accessToken && refreshToken) {
          const { data } = await usersApi.getProfile();
          dispatch(login({ user: data.data, accessToken, refreshToken }));
        }
        else if (store.getState().auth.isAuthenticated) {
          // `user`/`isAuthenticated` are persisted in AsyncStorage, tokens in
          // SecureStore. If the tokens are gone (keychain reset, interrupted
          // logout) the UI must not keep looking signed in while every
          // request goes out as a guest. Secure items are left untouched so a
          // kept biometric refresh token still works.
          dispatch(logout());
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
