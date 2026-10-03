import type { CartItem } from "@/store/slices/cart-slice";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart, removeItem, updateQuantity } from "@/store/slices/cart-slice";
import { BRAND, FONT, LIGHT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navTitle: { flex: 1, fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    clearText: { fontFamily: FONT.sans, fontSize: 13, color: SEMANTIC.error, fontWeight: "600" },
    empty: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    browseBtn: {
      height: 48,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: SPACING.sm,
    },
    browseBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, color: colors.bg },
    scroll: { padding: SPACING.base },
    itemRow: {
      flexDirection: "row" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.md,
      alignItems: "center" as const,
    },
    itemImg: { width: 64, height: 64, borderRadius: RADIUS.sm },
    itemImgPlaceholder: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: colors.elevated },
    itemInfo: { flex: 1, gap: 4 },
    itemName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text, lineHeight: 20 },
    itemPrice: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    qtyControls: { alignItems: "center" as const, gap: SPACING.xs },
    qtyBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    qtyBtnText: { fontSize: 16, color: colors.text },
    qtyValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text },
    itemSubtotal: { fontFamily: FONT.sans, fontSize: 12, color: BRAND.gold, fontWeight: "600" },
    deleteAction: {
      width: 80,
      backgroundColor: SEMANTIC.error,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.md,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    footer: {
      position: "absolute" as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: SPACING.base,
      paddingTop: SPACING.md,
      gap: SPACING.md,
    },
    totalRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    totalLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text },
    totalValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: BRAND.gold },
    checkoutBtn: {
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    checkoutBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { items, shopName } = useAppSelector(s => s.cart);
  const isAr = i18n.language === "ar";
  const styles = useStyles();
  const colors = useAppColors();

  const total = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

  if (!items.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <CartNav styles={styles} colors={colors} />
        <View style={styles.empty}>
          <ShoppingCart size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("cart.empty")}</Text>
          <Text style={styles.emptyBody}>{t("cart.empty_subtitle")}</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.replace("/(tabs)/directory")} accessibilityRole="button" accessibilityLabel={t("directory.title")}>
            <Text style={styles.browseBtnText}>{t("directory.title")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CartNav shopName={shopName ?? undefined} onClear={() => dispatch(clearCart())} styles={styles} colors={colors} />

      <FlashList
        data={items}
        keyExtractor={(item: CartItem) => item.productId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ ...styles.scroll, paddingBottom: insets.bottom + 120 }}
        renderItem={({ item }: { item: CartItem }) => (
          <CartItemRow
            item={item}
            isAr={isAr}
            onIncrease={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }));
            }}
            onDecrease={() => {
              if (item.quantity === 1) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }));
            }}
            onDelete={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              dispatch(removeItem(item.productId));
            }}
            styles={styles}
          />
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("cart.total")}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
        <Pressable
          style={styles.checkoutBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/checkout/address");
          }}
          accessibilityRole="button"
          accessibilityLabel={t("cart.checkout")}
        >
          <Text style={styles.checkoutBtnText}>{t("cart.checkout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CartNav({ shopName, onClear, styles, colors }: { shopName?: string; onClear?: () => void; styles: any; colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.nav}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
        <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.navTitle}>{shopName || t("cart.title")}</Text>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.clear")}>
          <Text style={styles.clearText}>{t("common.clear")}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CartItemRow({
  item,
  isAr,
  onIncrease,
  onDecrease,
  onDelete,
  styles,
}: {
  item: any;
  isAr: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onDelete: () => void;
  styles: any;
}) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const name = isAr ? item.nameAr : item.name;

  const renderRightActions = () => (
    <Pressable
      style={styles.deleteAction}
      onPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={t("common.delete")}
    >
      <Trash size={22} color={LIGHT.bg} weight="bold" />
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View style={styles.itemRow}>
        {item.imageUrl
          ? <Image source={{ uri: item.imageUrl }} style={styles.itemImg} resizeMode="cover" />
          : <View style={styles.itemImgPlaceholder} />}

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
          <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
        </View>

        <View style={styles.qtyControls}>
          <Pressable style={styles.qtyBtn} onPress={onDecrease} hitSlop={8}>
            {item.quantity === 1
              ? <Trash size={16} color={SEMANTIC.error} />
              : <Minus size={16} color={colors.textMuted} />}
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable style={styles.qtyBtn} onPress={onIncrease} hitSlop={8}>
            <Plus size={16} color={BRAND.gold} />
          </Pressable>
          <Text style={styles.itemSubtotal}>{formatCurrency(item.price * item.quantity)}</Text>
        </View>
      </View>
    </Swipeable>
  );
}
