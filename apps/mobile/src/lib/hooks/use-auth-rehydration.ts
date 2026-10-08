import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { deleteSecureItem, getSecureItem } from "@/lib/secure-storage";

import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/client";
import { usersApi } from "@/services/api/users";
import { store, useAppDispatch } from "@/store";
import { login, logout } from "@/store/slices/auth-slice";

type Dispatch = (action: ReturnType<typeof login> | ReturnType<typeof logout>) => unknown;

/**
 * Cold-launch session restore. Only a stored access + refresh PAIR is a
 * session: a lone refresh token is the signed-out biometric state (kept, not
 * restored), and a lone access token can never be renewed, so it is deleted
 * instead of being attached to guest requests.
 */
export async function rehydrateSession(dispatch: Dispatch, onTokensRead?: () => void): Promise<void> {
  const accessToken = await getSecureItem(SECURE_KEY_ACCESS);
  const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
  onTokensRead?.();
  if (accessToken && refreshToken) {
    const { data } = await usersApi.getProfile();
    dispatch(login({ user: data.data, accessToken, refreshToken }));
    return;
  }
  if (accessToken)
    await deleteSecureItem(SECURE_KEY_ACCESS);
  if (store.getState().auth.isAuthenticated) {
    // `user`/`isAuthenticated` are persisted in AsyncStorage, tokens in
    // SecureStore. If the tokens are gone (keychain reset, interrupted
    // logout) the UI must not keep looking signed in while every
    // request goes out as a guest. A kept biometric refresh token is left
    // untouched so it still works.
    dispatch(logout());
  }
}

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
        await rehydrateSession(dispatch, () => SplashScreen.hideAsync());
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
