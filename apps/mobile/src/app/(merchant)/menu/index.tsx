import type { Product } from "@/services/api/merchant";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ForkKnife, Pencil, Plus, Trash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { showConfirm } from "@/lib/confirm-dialog";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { merchantApi } from "@/services/api/merchant";
import { invalidateProductQueries } from "@/services/query/client";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base, gap: SPACING.sm },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 17, lineHeight: 26, color: colors.text, textAlign: "center" as const },
    emptyText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" as const },
    emptyBtn: { minHeight: 48, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, alignItems: "center" as const, justifyContent: "center" as const, marginTop: SPACING.sm },
    emptyBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    rowUnavailable: { opacity: 0.6 },
    rowInfo: { flex: 1, gap: 2 },
    rowName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    rowPrice: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    rowActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.xs },
    iconBtn: { width: 44, height: 44, justifyContent: "center" as const, alignItems: "center" as const },
  }), [colors]);
}

export default function MerchantMenuScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAr = i18n.language === "ar";
  const styles = useStyles();
  const colors = useAppColors();

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["merchant-products"],
    queryFn: () => merchantApi.getAllMyProducts(),
  });

  const products = data ?? [];

  const { mutate: toggleAvailability } = useMutation({
    mutationFn: ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) =>
      merchantApi.updateProduct(productId, { isAvailable }),
    onSuccess: () => invalidateProductQueries(),
    onError: () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }),
  });

  const { mutate: deleteProduct } = useMutation({
    mutationFn: (productId: string) => merchantApi.deleteProduct(productId),
    onSuccess: () => invalidateProductQueries(),
    onError: () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }),
  });

  async function handleDelete(product: Product) {
    const confirmed = await showConfirm({
      title: t("common.delete"),
      message: t("merchant.confirm_delete"),
      confirmLabel: t("common.delete"),
      destructive: true,
    });
    if (confirmed)
      deleteProduct(product.id);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("merchant.menu")}
        right={(
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(merchant)/menu/new")}
            accessibilityRole="button"
            accessibilityLabel={t("merchant.new_product")}
          >
            <Plus size={20} color={BRAND.ink} />
          </Pressable>
        )}
      />

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`product-sk-${i}`} width="100%" height={72} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
                ))}
              </View>
            )
          : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.xl }]}
                refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void refetch(); }} tintColor={BRAND.gold} />}
              >
                {products.length === 0 && (
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><ForkKnife size={36} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} /></View>
                    <Text style={styles.emptyTitle}>{t("merchant.menu")}</Text>
                    <Text style={styles.emptyText}>{t("common.no_results")}</Text>
                    <Pressable style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]} onPress={() => router.push("/(merchant)/menu/new")} accessibilityRole="button">
                      <Text style={styles.emptyBtnText}>{t("merchant.new_product")}</Text>
                    </Pressable>
                  </View>
                )}
                {products.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAr={isAr}
                    onToggle={v => toggleAvailability({ productId: product.id, isAvailable: v })}
                    onEdit={() => router.push(`/(merchant)/menu/${product.id}`)}
                    onDelete={() => handleDelete(product)}
                    styles={styles}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            )}
    </View>
  );
}

function ProductRow({
  product,
  isAr,
  onToggle,
  onEdit,
  onDelete,
  styles,
  colors,
}: {
  product: Product;
  isAr: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  styles: any;
  colors: any;
}) {
  const { t } = useTranslation();
  const name = isAr ? product.nameAr : product.name;

  return (
    <View style={[styles.row, !product.isAvailable && styles.rowUnavailable]}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowPrice}>{formatCurrency(product.price)}</Text>
      </View>
      <View style={styles.rowActions}>
        <Switch
          value={product.isAvailable}
          onValueChange={onToggle}
          accessibilityLabel={name}
          trackColor={{ true: SEMANTIC.success, false: colors.elevated }}
          thumbColor={colors.text}
        />
        <Pressable style={styles.iconBtn} onPress={onEdit} accessibilityRole="button" accessibilityLabel={t("merchant.edit_product")}>
          <Pencil size={20} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onDelete} accessibilityRole="button" accessibilityLabel={t("common.delete")}>
          <Trash size={20} color={SEMANTIC.error} />
        </Pressable>
      </View>
    </View>
  );
}
