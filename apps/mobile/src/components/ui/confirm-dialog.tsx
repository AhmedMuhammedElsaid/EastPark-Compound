import type { ConfirmRequest } from "@/lib/confirm-dialog";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { getActiveConfirm, registerConfirmHost, settleConfirm, subscribeConfirm } from "@/lib/confirm-dialog";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { BRAND, FONT, LIGHT, OVERLAY, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;

/**
 * Renders `showConfirm()` requests as a themed, RTL-correct dialog. Mount once
 * in the root layout. Dismiss (first) resolves false; the action (last)
 * resolves true. Android Back and a tap on the scrim count as dismiss.
 */
export function ConfirmDialogHost() {
  React.useEffect(() => registerConfirmHost(), []);
  const request = React.useSyncExternalStore(subscribeConfirm, getActiveConfirm, getActiveConfirm);
  const reduceMotion = useReducedMotion();
  const colors = useAppColors();
  const styles = useStyles(colors);

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={() => request && settleConfirm(request.id, false)}
    >
      {request && <ConfirmCard request={request} styles={styles} />}
    </Modal>
  );
}

function ConfirmCard({ request, styles }: { request: ConfirmRequest; styles: ReturnType<typeof useStyles> }) {
  const { t } = useTranslation();
  const cancelLabel = request.cancelLabel ?? t("common.cancel");

  function dismiss() {
    Haptics.selectionAsync();
    settleConfirm(request.id, false);
  }

  function accept() {
    if (request.destructive)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    settleConfirm(request.id, true);
  }

  return (
    <View style={styles.overlay}>
      {/* The scrim behind the card dismisses; it is hidden from screen readers (Back / the button do the same). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
        accessible={false}
        importantForAccessibility="no"
        testID="confirm-dialog-scrim"
      />
      <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
        <Text style={styles.title} accessibilityRole="header">{request.title}</Text>
        {request.message ? <Text style={styles.message}>{request.message}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            testID="confirm-dialog-cancel"
          >
            <Text style={styles.btnCancelText} numberOfLines={2}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              request.destructive ? styles.btnDestructive : styles.btnPrimary,
              pressed && styles.pressed,
            ]}
            onPress={accept}
            accessibilityRole="button"
            accessibilityLabel={request.confirmLabel}
            testID="confirm-dialog-confirm"
          >
            <Text
              style={request.destructive ? styles.btnDestructiveText : styles.btnPrimaryText}
              numberOfLines={2}
            >
              {request.confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function useStyles(colors: Colors) {
  return React.useMemo(() => {
    // Start-aligned in both directions (the native dialog put Arabic titles on the left).
    const startText = {
      writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
      textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
    };
    const label = { fontFamily: FONT.sans, fontSize: 15, lineHeight: 22, textAlign: "center" as const };
    return StyleSheet.create({
      overlay: {
        flex: 1,
        backgroundColor: OVERLAY.scrimStrong,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: SPACING.xl,
      },
      card: {
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: RADIUS.lg,
        padding: SPACING.xl,
        width: "100%",
        maxWidth: 420,
        gap: SPACING.md,
      },
      title: { ...startText, fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text },
      message: { ...startText, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted },
      // A row flips under RTL, so dismiss sits at the start and the action at the end.
      actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
      btn: {
        flex: 1,
        minHeight: 48,
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        justifyContent: "center",
        alignItems: "center",
      },
      btnCancel: { borderWidth: 1, borderColor: colors.border },
      btnCancelText: { ...label, fontWeight: "600", color: colors.text },
      btnPrimary: { backgroundColor: BRAND.gold },
      // Ink on gold passes AA in both themes.
      btnPrimaryText: { ...label, fontWeight: "700", color: BRAND.ink },
      btnDestructive: { backgroundColor: SEMANTIC.error },
      // Warm off-white on the error red (about 5.9:1).
      btnDestructiveText: { ...label, fontWeight: "700", color: LIGHT.bg },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    });
  }, [colors]);
}
