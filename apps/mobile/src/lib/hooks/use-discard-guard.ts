import { useNavigation } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

/**
 * Asks "discard changes?" before a dirty form screen is left by any route
 * (header Back, hardware Back, swipe). Set `allowLeaveRef.current = true`
 * right before leaving on purpose, e.g. after a successful submit.
 */
export function useDiscardGuard(isDirty: boolean, allowLeaveRef: React.RefObject<boolean>) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  React.useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (!isDirty || allowLeaveRef.current)
        return;
      event.preventDefault();
      Alert.alert(t("common.discard_title"), t("common.discard_body"), [
        { text: t("common.keep_editing"), style: "cancel" },
        { text: t("common.discard"), style: "destructive", onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [navigation, isDirty, allowLeaveRef, t]);
}
