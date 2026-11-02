import type { FinancePaymentResult } from "@/services/api/finance";
import { CheckCircle } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { balanceLabel, formatFinanceDate } from "@/lib/finance";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = {
  result: FinancePaymentResult;
  onAnother: () => void;
  onOpenFlat: () => void;
  onDone: () => void;
};

/** Success state of the payment form: the receipt number is the thing the accountant hands over. */
export function PaymentReceipt({ result, onAnother, onOpenFlat, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const reduceMotion = useReducedMotion();
  const scale = React.useRef(new Animated.Value(reduceMotion ? 1 : 0.6)).current;

  React.useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [reduceMotion, scale]);

  const styles = React.useMemo(() => StyleSheet.create({
    scroll: { padding: SPACING.base, gap: SPACING.base, alignItems: "stretch" },
    hero: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.lg },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, lineHeight: 30, color: colors.text, textAlign: "center" },
    receiptLabel: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "center" },
    receiptNo: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 28, lineHeight: 40, color: colors.text, textAlign: "center", letterSpacing: 0.5 },
    card: { gap: SPACING.sm, padding: SPACING.base, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    row: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.md },
    key: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted },
    value: { flexShrink: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text, textAlign: "right" },
    note: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "center" },
  }), [colors]);

  const rows: [string, string][] = [
    [t("finance.flat"), result.flatLabel],
    [t("finance.amount"), formatCurrency(result.amount)],
    [t("finance.method"), t(`finance.method_${result.method}`)],
    [t("finance.received_on"), formatFinanceDate(result.receivedAt, i18n.language)],
    [t("finance.allocated"), formatCurrency(result.allocatedAmount)],
    [t("finance.new_balance"), balanceLabel(t, result.flatTotals.balance)],
  ];
  if (result.unallocatedAmount > 0)
    rows.push([t("finance.kept_as_credit"), formatCurrency(result.unallocatedAmount)]);

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}>
      <View style={styles.hero} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${t("finance.payment_recorded")}. ${t("finance.receipt_no")} ${result.receiptNo}`}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <CheckCircle size={72} color={SEMANTIC.success} weight="fill" />
        </Animated.View>
        <Text style={styles.title}>{t("finance.payment_recorded")}</Text>
        <Text style={styles.receiptLabel}>{t("finance.receipt_no")}</Text>
        <Text style={styles.receiptNo} selectable>{result.receiptNo}</Text>
      </View>
      <View style={styles.card}>
        {rows.map(([key, value]) => (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{key}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      {result.chequeState === "PENDING_CLEARANCE" ? <Text style={styles.note}>{t("finance.cheque_pending_note")}</Text> : null}
      <GoldButton label={t("finance.record_another")} onPress={onAnother} />
      <GoldButton label={t("finance.open_flat")} variant="outline" onPress={onOpenFlat} />
      <GoldButton label={t("common.done")} variant="ghost" onPress={onDone} />
    </ScrollView>
  );
}
