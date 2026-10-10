import { useNavigation } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { showConfirm } from "@/lib/confirm-dialog";

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
      void showConfirm({
        title: t("common.discard_title"),
        message: t("common.discard_body"),
        confirmLabel: t("common.discard"),
        cancelLabel: t("common.keep_editing"),
        destructive: true,
      }).then((confirmed) => {
        if (confirmed)
          navigation.dispatch(event.data.action);
      });
    });
  }, [navigation, isDirty, allowLeaveRef, t]);
}
