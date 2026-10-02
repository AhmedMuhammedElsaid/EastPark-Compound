import type { Product } from "@/services/api/merchant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ForkKnife, Pencil, Plus, Trash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

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
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base, gap: SPACING.sm },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    rowUnavailable: { opacity: 0.6 },
    rowInfo: { flex: 1, gap: 4 },
    rowName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    rowPrice: { fontFamily: FONT.sans, fontSize: 13, color: BRAND.gold },
    rowActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    editBtn: { width: 32, height: 32, justifyContent: "center" as const, alignItems: "center" as const },
    deleteBtn: { width: 32, height: 32, justifyContent: "center" as const, alignItems: "center" as const },
  }), [colors]);
}

export default function MerchantMenuScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAr = i18n.language === "ar";
  const styles = useStyles();
  const colors = useAppColors();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["merchant-products"],
    queryFn: () => merchantApi.getMyProducts({ limit: 100, includeUnavailable: true }),
  });

  const products = data?.data.data.items ?? [];

  const { mutate: toggleAvailability } = useMutation({
    mutationFn: ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) =>
      merchantApi.updateProduct(productId, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-products"] }),
    onError: () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }),
  });

  const { mutate: deleteProduct } = useMutation({
    mutationFn: (productId: string) => merchantApi.deleteProduct(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-products"] }),
    onError: () => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }),
  });

  function handleDelete(product: Product) {
    Alert.alert(
      t("common.delete"),
      t("merchant.confirm_delete"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: () => deleteProduct(product.id) },
      ],
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("merchant.menu")}</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/(merchant)/menu/new")}>
          <Plus size={20} color={colors.bg} />
        </Pressable>
      </View>

      {isLoading
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
                  <ForkKnife size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>{t("common.no_results")}</Text>
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
          trackColor={{ true: SEMANTIC.success, false: colors.elevated }}
          thumbColor={colors.text}
        />
        <Pressable style={styles.editBtn} onPress={onEdit} hitSlop={8}>
          <Pencil size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <Trash size={18} color={SEMANTIC.error} />
        </Pressable>
      </View>
    </View>
  );
}
