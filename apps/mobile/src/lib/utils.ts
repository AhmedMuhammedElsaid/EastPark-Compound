import { Linking } from "react-native";

export function openLinkInBrowser(url: string) {
  Linking.canOpenURL(url).then(canOpen => canOpen && Linking.openURL(url));
}

/** Opens a document/link; reports failure instead of leaving a rejected promise. */
export async function openDocument(url: string, onError: () => void): Promise<void> {
  try {
    await Linking.openURL(url);
  }
  catch {
    onError();
  }
}

/** Empty optional fields are sent as null so the backend clears them. */
export function toNullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}
