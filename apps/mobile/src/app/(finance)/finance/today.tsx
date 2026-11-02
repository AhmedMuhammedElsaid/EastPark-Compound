import type { Href } from "expo-router";
import type { FinancePayment } from "@/services/api/finance";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Receipt, UserCircle } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { FinanceFlatRowSkeleton, StatTile, StatTileSkeleton } from "@/components/finance/finance-ui";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { cairoToday, formatFinanceDate } from "@/lib/finance";
import { formatCurrency } from "@/lib/format-currency";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useFinancePayments } from "@/services/api/finance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

const TODAY_LIMIT = 100;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({
    colors,
    styles: StyleSheet.create({
      container: { flex: 1, backgroundColor: colors.bg },
      header: { gap: SPACING.base, paddingTop: SPACING.base },
      date: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "left" },
      tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
      actions: { gap: SPACING.xs },
      sectionLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.sm, textAlign: "left" },
      listContent: { paddingHorizontal: SPACING.base },
      row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 64,
        gap: SPACING.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      rowMain: { flex: 1, gap: 2 },
      rowTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text, textAlign: "left" },
      rowSub: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "left" },
      rowAmount: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
      headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.full },
      empty: { alignItems: "center", paddingVertical: SPACING.xl, gap: SPACING.sm },
      emptyIcon: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
      emptyText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" },
    }),
  }), [colors]);
}

/** Sum of 2-dp amounts in whole piastres, so no float drift. */
function sumAmounts(payments: FinancePayment[]): number {
  return payments.reduce((total, p) => total + Math.round(p.amount * 100), 0) / 100;
}

/** Finance landing (`/finance/today`): today's collections and the two quick actions. */
export default function FinanceToday() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const today = React.useMemo(() => cairoToday(), []);

  const posted = useFinancePayments({ from: today, to: today, status: "POSTED" }, TODAY_LIMIT);
  const items = posted.data?.items ?? [];
  const pendingCheques = items.filter(p => p.chequeState === "PENDING_CLEARANCE").length;
  const more = posted.data?.hasMore ? "+" : "";

  const header = (
    <View style={styles.header}>
      <Text style={styles.date}>{t("finance.today_date", { date: formatFinanceDate(today, i18n.language, { weekday: "long", day: "numeric", month: "long" }) })}</Text>
      <View style={styles.tiles}>
        {posted.isLoading
          ? (
              <>
                <StatTileSkeleton />
                <StatTileSkeleton />
              </>
            )
          : (
              <>
                <StatTile
                  label={t("finance.collected_today")}
                  value={`${formatCurrency(sumAmounts(items))}${more}`}
                  hint={t("finance.payments_count", { total: `${formatNumber(items.length, i18n.language)}${more}` })}
                />
                <StatTile label={t("finance.pending_cheques")} value={`${formatNumber(pendingCheques, i18n.language)}${more}`} hint={t("finance.pending_cheques_hint")} />
              </>
            )}
      </View>
      <View style={styles.actions}>
        <GoldButton label={t("finance.record_payment")} onPress={() => router.push("/finance/payment/new" as Href)} />
        <GoldButton label={t("finance.find_flat")} variant="outline" onPress={() => router.push("/finance/flats" as Href)} />
      </View>
      <Text style={styles.sectionLabel} accessibilityRole="header">{t("finance.todays_payments")}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("finance.title")}
        back={router.canGoBack()}
        right={(
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && { backgroundColor: colors.elevated }]}
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("profile.tab_label")}
          >
            <UserCircle size={24} color={colors.text} />
          </Pressable>
        )}
      />
      {posted.isError && !posted.data
        ? <ErrorState onRetry={() => posted.refetch()} />
        : (
            <FlashList
              data={items}
              keyExtractor={item => item.id}
              ListHeaderComponent={header}
              contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
              onRefresh={() => posted.refetch()}
              refreshing={posted.isRefetching}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => router.push(`/finance/flats/${encodeURIComponent(item.flatId)}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.receiptNo}, ${item.flatLabel}, ${formatCurrency(item.amount)}, ${t(`finance.method_${item.method}`)}`}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{item.flatLabel}</Text>
                    <Text style={styles.rowSub}>{`${item.receiptNo} · ${t(`finance.method_${item.method}`)}`}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={posted.isLoading
                ? (
                    <View>
                      <FinanceFlatRowSkeleton />
                      <FinanceFlatRowSkeleton />
                    </View>
                  )
                : (
                    <View style={styles.empty}>
                      <View style={styles.emptyIcon}><Receipt size={28} color={gold} /></View>
                      <Text style={styles.emptyText}>{t("finance.no_payments_today")}</Text>
                    </View>
                  )}
            />
          )}
    </View>
  );
}
