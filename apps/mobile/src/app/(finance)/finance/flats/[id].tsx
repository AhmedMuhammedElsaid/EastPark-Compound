import type { Href } from "expo-router";
import type { FinanceOpenCharge, FinancePayment } from "@/services/api/finance";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Phone } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { FinanceFlatRowSkeleton, OverdueBadge, StatTile, StatTileSkeleton } from "@/components/finance/finance-ui";
import { useRefocusEffect } from "@/components/finance/use-refocus-effect";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showConfirm } from "@/lib/confirm-dialog";
import { amountToString, balanceLabel, financeErrorKey, formatFinanceDate } from "@/lib/finance";
import { formatCurrency } from "@/lib/format-currency";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { financeApi, financeKeys, useFinanceFlat, useFinancePayments } from "@/services/api/finance";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const RECENT_PAYMENTS = 10;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({
    colors,
    styles: StyleSheet.create({
      container: { flex: 1, backgroundColor: colors.bg },
      listContent: { paddingHorizontal: SPACING.base },
      header: { gap: SPACING.base, paddingTop: SPACING.base },
      card: { gap: SPACING.xs, padding: SPACING.base, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
      cardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
      cardMain: { flex: 1, gap: 2 },
      ownerLabel: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "left" },
      ownerName: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "left" },
      ownerSub: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "left" },
      callBtn: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs,
        paddingHorizontal: SPACING.base,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.elevated,
      },
      callText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
      notice: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: SEMANTIC.warning },
      noticeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: DARK.bg, textAlign: "left" },
      sectionLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.sm, textAlign: "left" },
      line: {
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
      lineMain: { flex: 1, gap: 2 },
      lineTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text, textAlign: "left" },
      lineSub: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "left" },
      lineEnd: { alignItems: "flex-end", gap: SPACING.xs },
      lineAmount: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
      voided: { textDecorationLine: "line-through", color: colors.textMuted },
      tag: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: colors.elevated },
      tagText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: colors.text },
      emptyText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, paddingVertical: SPACING.md, textAlign: "left" },
      footer: { gap: SPACING.sm },
    }),
  }), [colors]);
}

/** Finance flat ledger (`/finance/flats/[id]`): totals, owner contact, open charges, recent payments. */
// eslint-disable-next-line max-lines-per-function
export default function FinanceFlatScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const { id } = useLocalSearchParams<{ id: string }>();
  const flat = useFinanceFlat(id);
  const payments = useFinancePayments({ flatId: id }, RECENT_PAYMENTS, !!id);
  const queryClient = useQueryClient();
  // The ledger stays mounted under "Record payment": reload it whenever it is shown again.
  useRefocusEffect(() => {
    if (id) {
      flat.refetch();
      payments.refetch();
    }
  });

  const applyCredit = useMutation({
    mutationFn: (expectedCredit: string) => financeApi.applyCredit(id as string, expectedCredit).then(r => r.data.data),
    onSuccess: (result) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showMessage({ message: t("finance.credit_applied", { amount: formatCurrency(result.applied) }), type: "success", backgroundColor: SEMANTIC.success });
      return queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showMessage({ message: t(financeErrorKey(error) as any), type: "danger", backgroundColor: SEMANTIC.error });
      flat.refetch();
    },
  });

  if (flat.isError && !flat.data)
    return <DetailErrorScreen onRetry={() => flat.refetch()} message={t(financeErrorKey(flat.error) as any)} />;

  const data = flat.data;

  async function onApplyCredit() {
    if (!data)
      return;
    const amount = formatCurrency(data.availableCredit);
    const ok = await showConfirm({
      title: t("finance.apply_credit"),
      message: t("finance.apply_credit_confirm", { amount, flat: data.label }),
      confirmLabel: t("finance.apply_credit"),
    });
    if (ok)
      applyCredit.mutate(amountToString(data.availableCredit));
  }

  const header = (
    <View style={styles.header}>
      {!data
        ? (
            <>
              <StatTileSkeleton />
              <View style={styles.tiles}>
                <StatTileSkeleton />
                <StatTileSkeleton />
              </View>
            </>
          )
        : (
            <>
              {!data.isActive && (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>{t("finance.flat_inactive")}</Text>
                </View>
              )}
              <View style={styles.card}>
                <Text style={styles.ownerLabel}>{t("finance.owner")}</Text>
                <View style={styles.cardRow}>
                  <View style={styles.cardMain}>
                    <Text style={styles.ownerName}>{data.owner?.name ?? t("finance.no_owner")}</Text>
                    {data.owner
                      ? <Text style={styles.ownerSub}>{t("finance.owner_since", { date: formatFinanceDate(data.owner.since, i18n.language) })}</Text>
                      : null}
                  </View>
                  {data.owner?.phone
                    ? (
                        <Pressable
                          style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            Linking.openURL(`tel:${data.owner?.phone}`).catch(() =>
                              showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }));
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("finance.call_owner", { phone: data.owner.phone })}
                        >
                          <Phone size={18} color={gold} />
                          <Text style={styles.callText}>{t("finance.call")}</Text>
                        </Pressable>
                      )
                    : null}
                </View>
              </View>
              <View style={styles.tiles}>
                <StatTile label={t("finance.balance")} value={balanceLabel(t, data.balance)} hint={t("finance.as_of", { date: formatFinanceDate(data.asOf, i18n.language) })} />
              </View>
              <View style={styles.tiles}>
                <StatTile
                  label={t("finance.overdue")}
                  value={formatCurrency(data.overdueAmount)}
                  hint={data.oldestDueDays && data.overdueAmount > 0 ? t("finance.overdue_days", { days: formatNumber(data.oldestDueDays, i18n.language) }) : undefined}
                />
                <StatTile label={t("finance.available_credit")} value={formatCurrency(data.availableCredit)} />
              </View>
              <GoldButton
                label={t("finance.record_payment")}
                onPress={() => router.push(`/finance/payment/new?flatId=${encodeURIComponent(data.id)}` as Href)}
              />
              {data.availableCredit > 0 && data.openCharges.length > 0 && (
                <GoldButton
                  label={t("finance.apply_credit")}
                  variant="outline"
                  loading={applyCredit.isPending}
                  onPress={onApplyCredit}
                />
              )}
              <Text style={styles.sectionLabel} accessibilityRole="header">{t("finance.open_charges")}</Text>
            </>
          )}
    </View>
  );

  const footer = data
    ? (
        <View style={styles.footer}>
          <Text style={styles.sectionLabel} accessibilityRole="header">{t("finance.recent_payments")}</Text>
          {payments.isLoading
            ? <FinanceFlatRowSkeleton />
            : (payments.data?.items ?? []).length === 0
                ? <Text style={styles.emptyText}>{t("finance.no_payments")}</Text>
                : payments.data?.items.map(p => <PaymentLine key={p.id} payment={p} styles={styles} />)}
        </View>
      )
    : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={data?.label ?? t("finance.flat")} />
      <FlashList
        data={data?.openCharges ?? []}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
        onRefresh={() => {
          flat.refetch();
          payments.refetch();
        }}
        refreshing={flat.isRefetching}
        renderItem={({ item }) => <ChargeLine charge={item} asOf={data?.asOf} styles={styles} />}
        ListEmptyComponent={data
          ? <Text style={styles.emptyText}>{t("finance.no_open_charges")}</Text>
          : <FinanceFlatRowSkeleton />}
      />
    </View>
  );
}

function ChargeLine({ charge, asOf, styles }: { charge: FinanceOpenCharge; asOf?: string; styles: ReturnType<typeof useStyles>["styles"] }) {
  const { t, i18n } = useTranslation();
  const description = i18n.language === "ar" ? charge.descriptionAr || charge.description : charge.description || charge.descriptionAr;
  const overdueDays = asOf && charge.dueDate < asOf
    ? Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${charge.dueDate}T00:00:00Z`)) / 86_400_000)
    : 0;
  const due = formatFinanceDate(charge.dueDate, i18n.language);
  return (
    <View style={styles.line} accessible accessibilityLabel={`${description}, ${t("finance.due_on", { date: due })}, ${formatCurrency(charge.openAmount)}`}>
      <View style={styles.lineMain}>
        <Text style={styles.lineTitle} numberOfLines={2}>{description}</Text>
        <Text style={styles.lineSub}>{`${t(`finance.kind_${charge.kind}`)} · ${t("finance.due_on", { date: due })}`}</Text>
      </View>
      <View style={styles.lineEnd}>
        <Text style={styles.lineAmount}>{formatCurrency(charge.openAmount)}</Text>
        {overdueDays > 0 ? <OverdueBadge days={overdueDays} /> : null}
      </View>
    </View>
  );
}

function PaymentLine({ payment, styles }: { payment: FinancePayment; styles: ReturnType<typeof useStyles>["styles"] }) {
  const { t, i18n } = useTranslation();
  const isVoid = payment.status === "VOID";
  const tag = isVoid
    ? t("finance.status_void")
    : payment.chequeState === "PENDING_CLEARANCE"
      ? t("finance.cheque_pending")
      : payment.chequeState === "BOUNCED"
        ? t("finance.cheque_bounced")
        : null;
  const sub = `${formatFinanceDate(payment.receivedAt, i18n.language)} · ${t(`finance.method_${payment.method}`)}`;
  return (
    <View style={styles.line} accessible accessibilityLabel={`${payment.receiptNo}, ${sub}, ${formatCurrency(payment.amount)}${tag ? `, ${tag}` : ""}`}>
      <View style={styles.lineMain}>
        <Text style={styles.lineTitle}>{payment.receiptNo}</Text>
        <Text style={styles.lineSub}>{sub}</Text>
      </View>
      <View style={styles.lineEnd}>
        <Text style={[styles.lineAmount, isVoid && styles.voided]}>{formatCurrency(payment.amount)}</Text>
        {tag ? <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View> : null}
      </View>
    </View>
  );
}
