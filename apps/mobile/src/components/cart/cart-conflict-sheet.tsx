import * as Haptics from "expo-haptics";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearAndAdd, dismissConflict } from "@/store/slices/cart-slice";
import { BRAND, FONT, OVERLAY, RADIUS, SPACING } from "@/theme/tokens";

/**
 * Global modal that appears when the user tries to add a product from a
 * different shop while there are already items in the cart.
 * Connected to Redux cartSlice.showConflictSheet.
 */
export function CartConflictSheet() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { showConflictSheet, shopName, shopNameAr } = useAppSelector(s => s.cart);
  const colors = useAppColors();
  const styles = useStyles(colors);

  if (!showConflictSheet)
    return null;

  // The body names the shop already in the cart (the one that would be cleared).
  const conflictingShop = (i18n.language === "ar" ? shopNameAr || shopName : shopName) ?? "";

  return (
    <Modal
      visible={showConflictSheet}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => dispatch(dismissConflict())}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">{t("cart.shop_conflict_title")}</Text>
          <Text style={styles.body}>
            {t("cart.shop_conflict_body", { shopName: conflictingShop })}
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}
              onPress={() => dispatch(dismissConflict())}
              accessibilityRole="button"
            >
              <Text style={styles.btnOutlineText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnGold, pressed && styles.pressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                dispatch(clearAndAdd());
              }}
              accessibilityRole="button"
            >
              <Text style={styles.btnGoldText}>{t("cart.clear_and_add")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: OVERLAY.scrimStrong,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: SPACING.xl,
        },
        sheet: {
          backgroundColor: colors.elevated,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: RADIUS.lg,
          padding: SPACING.xl,
          width: "100%",
          gap: SPACING.md,
        },
        title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text },
        body: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 22 },
        actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
        btn: {
          flex: 1,
          height: 48,
          borderRadius: RADIUS.full,
          paddingHorizontal: SPACING.md,
          justifyContent: "center",
          alignItems: "center",
        },
        btnOutline: { borderWidth: 1, borderColor: colors.border },
        btnOutlineText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21, color: colors.text },
        btnGold: { backgroundColor: BRAND.gold },
        // Ink on gold passes AA in both themes; colors.bg (off-white in light) does not.
        btnGoldText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 21, color: BRAND.ink },
        pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      }),
    [colors],
  );
}
