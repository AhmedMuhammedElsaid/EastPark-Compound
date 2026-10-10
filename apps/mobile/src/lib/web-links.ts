import { openDocument } from "@/lib/utils";

/** The public EastPark web app (Vercel). Unit registration only exists there. */
export const WEB_APP_URL = "https://eastpark-web-app.vercel.app";
export const REGISTER_UNIT_URL = `${WEB_APP_URL}/register-unit`;

/** Opens the web unit-registration form in the system browser. */
export function openRegisterUnit(onError: () => void): Promise<void> {
  return openDocument(REGISTER_UNIT_URL, onError);
}
