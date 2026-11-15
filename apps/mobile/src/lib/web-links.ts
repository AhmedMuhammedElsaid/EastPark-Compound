import { openDocument } from "@/lib/utils";

/** The public EastPark web app (Vercel). */
export const WEB_APP_URL = "https://eastpark-web-app.vercel.app";
/** The single public privacy policy (web `/privacy`); the app stores link to the same URL. */
export const PRIVACY_POLICY_URL = `${WEB_APP_URL}/privacy`;

/** Opens the web privacy policy in the system browser. */
export function openPrivacyPolicy(onError: () => void): Promise<void> {
  return openDocument(PRIVACY_POLICY_URL, onError);
}
