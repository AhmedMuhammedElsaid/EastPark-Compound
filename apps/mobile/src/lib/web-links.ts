import { openDocument } from "@/lib/utils";

/** The public EastPark web app (Vercel). Unit registration only exists there. */
export const WEB_APP_URL = "https://eastpark-web-app.vercel.app";
export const REGISTER_UNIT_URL = `${WEB_APP_URL}/register-unit`;
/** The single public privacy policy (web `/privacy`); the app stores link to the same URL. */
export const PRIVACY_POLICY_URL = `${WEB_APP_URL}/privacy`;

/** Opens the web unit-registration form in the system browser. */
export function openRegisterUnit(onError: () => void): Promise<void> {
  return openDocument(REGISTER_UNIT_URL, onError);
}

/** Opens the web privacy policy in the system browser. */
export function openPrivacyPolicy(onError: () => void): Promise<void> {
  return openDocument(PRIVACY_POLICY_URL, onError);
}
