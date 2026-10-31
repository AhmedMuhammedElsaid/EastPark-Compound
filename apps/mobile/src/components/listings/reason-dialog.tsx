import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { LISTING_REJECT_REASON_MAX, LISTING_REJECT_REASON_MIN } from "@/lib/listings";
import { FONT, LIGHT, OVERLAY, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

const startText = {
  writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
  textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
};

/** Reject / take down: the admin types the reason the owner will read (3–500 characters). */
export function ReasonDialog({ visible, title, confirmLabel, busy, onCancel, onSubmit }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const reduceMotion = useReducedMotion();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const [reason, setReason] = React.useState("");
  const [showError, setShowError] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setReason("");
      setShowError(false);
    }
  }, [visible]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= LISTING_REJECT_REASON_MIN && trimmed.length <= LISTING_REJECT_REASON_MAX;

  function submit() {
    if (!valid) {
      setShowError(true);
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={() => !busy && onCancel()}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onCancel()} accessible={false} importantForAccessibility="no" />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.label}>{t("listings.reason_label")}</Text>
          <TextInput
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              if (showError)
                setShowError(false);
            }}
            placeholder={t("listings.reason_placeholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={LISTING_REJECT_REASON_MAX}
            autoFocus
            editable={!busy}
            accessibilityLabel={t("listings.reason_label")}
            accessibilityHint={t("listings.reason_hint")}
            style={[styles.input, showError && styles.inputError]}
          />
          <Text style={showError ? styles.error : styles.hint}>
            {t(showError ? "listings.reason_error" : "listings.reason_hint")}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.btnCancelText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnDanger, busy && styles.disabled, pressed && styles.pressed]}
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
            >
              <Text style={styles.btnDangerText}>{busy ? t("common.loading") : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  const label = { fontFamily: FONT.sans, fontSize: 15, lineHeight: 22, textAlign: "center" as const };
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: OVERLAY.scrimStrong, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.xl },
    card: {
      width: "100%",
      maxWidth: 420,
      gap: SPACING.sm,
      padding: SPACING.xl,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
    },
    title: { ...startText, fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text },
    label: { ...startText, fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text, marginTop: SPACING.sm },
    input: {
      ...startText,
      minHeight: 110,
      textAlignVertical: "top",
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
    },
    inputError: { borderColor: SEMANTIC.error },
    hint: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    error: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
    btn: { flex: 1, minHeight: 48, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, justifyContent: "center", alignItems: "center" },
    btnCancel: { borderWidth: 1, borderColor: colors.border },
    btnCancelText: { ...label, fontWeight: "600", color: colors.text },
    btnDanger: { backgroundColor: SEMANTIC.error },
    // Warm off-white on the error red (about 5.9:1), as in the confirm dialog.
    btnDangerText: { ...label, fontWeight: "700", color: LIGHT.bg },
    disabled: { opacity: 0.6 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}
