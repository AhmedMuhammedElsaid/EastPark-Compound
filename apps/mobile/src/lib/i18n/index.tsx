/* eslint-disable react-refresh/only-export-components */
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";

import { installPluralRulesFallback } from "./plural-rules";
import { resources } from "./resources";
import { getLanguage } from "./utils";

export * from "./utils";

// Must run before init(): i18next reads Intl.PluralRules while resolving plural keys.
installPluralRulesFallback();

i18n.use(initReactI18next).init({
  resources,
  lng: getLanguage() || getLocales()[0]?.languageTag, // TODO: if you are not supporting multiple languages or languages with multiple directions you can set the default value to `en`
  fallbackLng: "en",
  compatibilityJSON: "v4", // Updated to v4 for i18next compatibility

  // allows integrating dynamic values into translations.
  interpolation: {
    escapeValue: false, // escape passed in values to avoid XSS injections
  },
});

// RTL is controlled by the persisted language preference (applied in Providers after Redux rehydration).
// Do NOT call I18nManager here — the language isn't known yet at module init time.
export const isRTL: boolean = I18nManager.isRTL;

export default i18n;
