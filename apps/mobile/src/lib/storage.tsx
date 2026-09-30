import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem<T>(key: string): Promise<T | null> {
  const value = await AsyncStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setItem<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string) {
  await AsyncStorage.removeItem(key);
}
