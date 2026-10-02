/**
 * Platform-aware secure storage.
 * Native: expo-secure-store (Keychain / Android Keystore)
 * Web: in-memory Map only — tokens are never written to localStorage (XSS-readable),
 *       so web preview sessions do not survive a reload.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Web fallback store: deliberately non-persistent.
const webMemory = new Map<string, string>();

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return webMemory.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemory.set(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webMemory.delete(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
