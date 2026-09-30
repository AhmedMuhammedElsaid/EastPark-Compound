/**
 * Platform-aware secure storage.
 * Native: expo-secure-store (Keychain / Android Keystore)
 * Web: localStorage (not encrypted — acceptable for dev/web preview only)
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
