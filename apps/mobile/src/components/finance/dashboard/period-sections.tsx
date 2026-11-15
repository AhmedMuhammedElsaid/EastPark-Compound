import type { Href } from "expo-router";
import type { FinanceAuditItem, FinanceDashboard } from "@/services/api/finance";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { CheckCircle, Warning } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { auditLabelKey, deriveChecks, formatCairoStamp, formatMoney } from "@/lib/finance-dashboard";
import { formatNumber } from "@/lib/format-number";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";
import { DashCard, DashRow, SectionTitle } from "./dash-ui";

/** Progress card (mockup frame 4): period, share of OK checks, bar and what is left to review. */
export function PeriodProgress({ month, okCount, total }: { month: string; okCount: number; total: number }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const percent = total > 0 ? Math.round((okCount / total) * 100) : 0;
  const review = total - okCount;
  return (
    <DashCard testID="period-progress">
      <View style={styles.progressTop}>
        <Text style={styles.muted}>{month}</Text>
        <Text style={styles.gold}>{`${formatNumber(percent, i18n.language)}%`}</Text>
      </View>
      <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.small}>{review > 0 ? t("finance.dash.period_review", { count: review }) : t("finance.dash.period_all_clear")}</Text>
    </DashCard>
  );
}

/** The advisory checklist (spec 4.1): `ok` or `warn` rows, strong warnings first, no tick boxes. */
export function ChecksCard({ data }: { data: FinanceDashboard }) {
  const { t } = useTranslation();
  const c = useChartColors();
  return (
    <DashCard testID="period-checks">
      <SectionTitle title={t("finance.dash.checks_title")} />
      {deriveChecks(data).map((check) => {
        const Icon = check.ok ? CheckCircle : Warning;
        const tone = check.ok ? c.c2 : check.strong ? c.a4 : c.c4;
        const params = { count: check.count ?? 0, status: t(`finance.dash.status_${data.period.status}`) };
        return (
          <DashRow
            key={check.key}
            icon={<Icon size={20} color={tone} weight={check.ok ? "regular" : "fill"} />}
            accent={tone}
            title={t(`finance.dash.check_${check.key}_${check.ok ? "ok" : "warn"}`, params)}
            detail={check.ok ? t("finance.dash.check_ok") : t("finance.dash.check_warn")}
            onPress={check.href ? () => router.push(check.href as Href) : undefined}
          />
        );
      })}
    </DashCard>
  );
}

/** Unapplied payments (5 oldest) with an Apply button into the flat, where slice 7 apply-credit lives. */
export function UnappliedCard({ data }: { data: FinanceDashboard }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  return (
    <DashCard testID="period-unapplied">
      <SectionTitle
        title={t("finance.dash.unapplied_title")}
        right={data.unapplied.count > 0 ? <Text style={styles.muted}>{formatMoney(data.unapplied.total)}</Text> : undefined}
      />
      {data.unapplied.oldest.length === 0
        ? <Text style={styles.muted}>{t("finance.dash.unapplied_empty")}</Text>
        : data.unapplied.oldest.map(row => (
            <View key={row.paymentId} style={styles.unappliedRow}>
              <View style={styles.unappliedMain}>
                <Text style={styles.flat}>{row.flatLabel}</Text>
                <Text style={styles.small}>
                  {t("finance.dash.unapplied_row", { method: t(`finance.method_${row.method}`), amount: formatMoney(row.unallocated), age: t("finance.dash.unapplied_age", { days: formatNumber(row.ageDays, i18n.language) }) })}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.apply, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/finance/flats/${encodeURIComponent(row.flatId)}` as Href);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("finance.dash.apply_a11y", { flat: row.flatLabel })}
              >
                <Text style={styles.applyText}>{t("finance.dash.apply")}</Text>
              </Pressable>
            </View>
          ))}
      {data.credit.netCreditFlats > 0
        ? <Text style={[styles.small, { marginTop: SPACING.sm }]}>{t("finance.dash.credits_line", { count: formatNumber(data.credit.netCreditFlats, i18n.language), amount: formatMoney(data.credit.netCreditTotal) })}</Text>
        : null}
    </DashCard>
  );
}

/** One timeline row: Cairo time, dot, mapped label (never the raw action code) and the actor. */
export function TimelineRow({ item }: { item: FinanceAuditItem }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const stamp = formatCairoStamp(item.createdAt, i18n.language);
  const label = t(auditLabelKey(item.action));
  return (
    <View style={styles.event} accessible accessibilityLabel={`${stamp}, ${label}, ${item.actor.name}`}>
      <Text style={styles.time}>{stamp}</Text>
      <View style={styles.dot} />
      <View style={styles.eventMain}>
        <Text style={styles.eventLabel}>{label}</Text>
        <Text style={styles.small}>{item.actor.name}</Text>
      </View>
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    muted: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: c.mut, textAlign: "left" },
    gold: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: c.gold },
    track: { height: 8, borderRadius: 4, backgroundColor: c.elev, overflow: "hidden", marginTop: SPACING.sm },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.gold },
    small: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: c.mut, textAlign: "left", marginTop: 2 },
    unappliedRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.xs },
    unappliedMain: { flex: 1 },
    flat: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: c.tx, textAlign: "left" },
    apply: { minHeight: 48, minWidth: 72, paddingHorizontal: SPACING.base, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, alignItems: "center", justifyContent: "center" },
    applyText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: BRAND.ink },
    event: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 56, paddingHorizontal: SPACING.base },
    time: { width: 84, fontFamily: FONT.sans, fontSize: 12, color: c.mut, textAlign: "left" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.gold },
    eventMain: { flex: 1 },
    eventLabel: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: c.tx, textAlign: "left" },
  });
}
