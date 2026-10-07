import type { CartItem } from "@/store/slices/cart-slice";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Minus, Plus, ShoppingCart, Trash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldButton } from "@/components/auth/gold-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart, removeItem, updateQuantity } from "@/store/slices/cart-slice";
import { BRAND, FONT, LIGHT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  const goldText = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    clearBtn: {
      minWidth: 44,
      height: 44,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    clearBtnPressed: { backgroundColor: colors.elevated },
    clearText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: SEMANTIC.error, fontWeight: "600" },
    empty: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    scroll: { padding: SPACING.base },
    itemRow: {
      flexDirection: "row" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.md,
      alignItems: "center" as const,
    },
    itemImg: { width: 72, height: 72, borderRadius: RADIUS.md },
    itemImgPlaceholder: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: colors.elevated },
    itemInfo: { flex: 1, gap: SPACING.xs },
    itemName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text, lineHeight: 22 },
    itemPrice: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    itemBottom: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
    stepper: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.full,
    },
    qtyBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    qtyBtnPressed: { opacity: 0.6 },
    qtyValue: { minWidth: 24, textAlign: "center" as const, fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: colors.text },
    itemSubtotal: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: goldText, fontWeight: "700" },
    deleteAction: {
      width: 80,
      backgroundColor: SEMANTIC.error,
      borderRadius: RADIUS.lg,
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
      gap: SPACING.xs,
    },
    totalRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    totalLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text },
    totalValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: goldText },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

type Styles = ReturnType<typeof buildStyles>;

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { items, shopName, shopNameAr } = useAppSelector(s => s.cart);
  const isAr = i18n.language === "ar";
  const { styles, colors } = useStyles();

  const total = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
  // Carts persisted before shopNameAr existed only have the English name.
  const title = (isAr ? (shopNameAr || shopName) : shopName) || t("cart.title");

  if (!items.length) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("cart.title")} />
        <View style={[styles.empty, { paddingBottom: insets.bottom + SPACING.xl }]}>
          <View style={styles.emptyIcon}>
            <ShoppingCart size={44} color={BRAND.gold} weight="duotone" />
          </View>
          <Text style={styles.emptyTitle}>{t("cart.empty")}</Text>
          <Text style={styles.emptyBody}>{t("cart.empty_subtitle")}</Text>
          <GoldButton label={t("orders.browse_shops")} onPress={() => router.replace("/(tabs)/directory")} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        right={(
          <Pressable
            style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(t("cart.clear_confirm_title"), t("cart.clear_confirm_body"), [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.clear"), style: "destructive", onPress: () => dispatch(clearCart()) },
              ]);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear")}
          >
            <Text style={styles.clearText}>{t("common.clear")}</Text>
          </Pressable>
        )}
      />

      <FlashList
        data={items}
        keyExtractor={(item: CartItem) => item.productId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ ...styles.scroll, paddingBottom: insets.bottom + 140 }}
        renderItem={({ item }: { item: CartItem }) => (
          <CartItemRow
            item={item}
            isAr={isAr}
            colors={colors}
            onIncrease={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }));
            }}
            onDecrease={() => {
              Haptics.impactAsync(item.quantity === 1 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
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
        <GoldButton label={t("cart.checkout")} onPress={() => router.push("/checkout/address")} />
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CartItemRow({
  item,
  isAr,
  colors,
  onIncrease,
  onDecrease,
  onDelete,
  styles,
}: {
  item: CartItem;
  isAr: boolean;
  colors: ReturnType<typeof useAppColors>;
  onIncrease: () => void;
  onDecrease: () => void;
  onDelete: () => void;
  styles: Styles;
}) {
  const { t } = useTranslation();
  const name = isAr ? item.nameAr : item.name;
  const qtyText = item.quantity.toLocaleString(isAr ? "ar-EG" : "en-GB");

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
          ? <Image source={{ uri: item.imageUrl }} recyclingKey={item.productId} style={styles.itemImg} contentFit="cover" />
          : <View style={styles.itemImgPlaceholder} />}

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
          <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
          <View style={styles.itemBottom}>
            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                onPress={onDecrease}
                accessibilityRole="button"
                accessibilityLabel={item.quantity === 1 ? t("common.delete") : "−"}
              >
                {item.quantity === 1
                  ? <Trash size={18} color={SEMANTIC.error} />
                  : <Minus size={18} color={colors.text} />}
              </Pressable>
              <Text style={styles.qtyValue}>{qtyText}</Text>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                onPress={onIncrease}
                accessibilityRole="button"
                accessibilityLabel="+"
              >
                <Plus size={18} color={BRAND.gold} />
              </Pressable>
            </View>
            <Text style={styles.itemSubtotal}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}
