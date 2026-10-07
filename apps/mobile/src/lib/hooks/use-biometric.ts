/**
 * Biometric login hook.
 *
 * Wraps expo-local-authentication and exposes preference state stored in
 * SecureStore (`eastpark_biometric_enabled` + `eastpark_biometric_email`).
 *
 * Standard mode: when enabled, the refresh token survives logout so the
 * login screen can offer a one-tap "Sign in with Face ID/Fingerprint"
 * button that exchanges it for a fresh access token via /auth/refresh.
 */
import * as LocalAuthentication from "expo-local-authentication";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from "@/lib/secure-storage";
import {
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/client";

export type BiometricKind = "face" | "fingerprint" | "iris" | "generic";

type BiometricState = {
  ready: boolean;
  isAvailable: boolean;
  kind: BiometricKind;
  enabled: boolean;
  email: string | null;
};

const initialState: BiometricState = {
  ready: false,
  isAvailable: false,
  kind: "generic",
  enabled: false,
  email: null,
};

function pickKind(types: LocalAuthentication.AuthenticationType[]): BiometricKind {
  // Android phones with both sensors (e.g. Samsung) report face first, but the
  // fingerprint is what BiometricPrompt actually uses for app sign-in there.
  if (Platform.OS === "android" && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "face";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris";
  }
  return "generic";
}

async function loadBiometricState(): Promise<BiometricState> {
  try {
    const [hasHardware, isEnrolled, types, enabledRaw, email] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      getSecureItem(SECURE_KEY_BIOMETRIC_ENABLED),
      getSecureItem(SECURE_KEY_BIOMETRIC_EMAIL),
    ]);
    return {
      ready: true,
      isAvailable: hasHardware && isEnrolled,
      kind: pickKind(types),
      enabled: enabledRaw === "1",
      email,
    };
  }
  catch (err) {
    if (__DEV__) {
      console.warn("[biometric] refresh failed", err);
    }
    return { ...initialState, ready: true };
  }
}

export function useBiometric() {
  const { t } = useTranslation();
  const [state, setState] = React.useState<BiometricState>(initialState);

  const refresh = React.useCallback(async () => {
    setState(await loadBiometricState());
  }, []);

  React.useEffect(() => {
    let active = true;
    loadBiometricState().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const authenticate = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t("auth.biometric.prompt"),
        cancelLabel: t("common.cancel"),
        disableDeviceFallback: false,
      });
      return res.success;
    }
    catch (err) {
      if (__DEV__) {
        console.warn("[biometric] authenticate failed", err);
      }
      return false;
    }
  }, [t]);

  const enable = React.useCallback(async (email: string): Promise<boolean> => {
    const ok = await authenticate();
    if (!ok) {
      return false;
    }
    await setSecureItem(SECURE_KEY_BIOMETRIC_ENABLED, "1");
    await setSecureItem(SECURE_KEY_BIOMETRIC_EMAIL, email);
    setState(s => ({ ...s, enabled: true, email }));
    return true;
  }, [authenticate]);

  const disable = React.useCallback(async () => {
    await Promise.all([
      deleteSecureItem(SECURE_KEY_BIOMETRIC_ENABLED),
      deleteSecureItem(SECURE_KEY_BIOMETRIC_EMAIL),
      deleteSecureItem(SECURE_KEY_REFRESH),
    ]);
    setState(s => ({ ...s, enabled: false, email: null }));
  }, []);

  return { ...state, authenticate, enable, disable, refresh };
}
