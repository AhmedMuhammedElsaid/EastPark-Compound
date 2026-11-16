import type { Href } from "expo-router";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { AttentionItem } from "@/lib/finance-dashboard";
import type { FinanceDashboard } from "@/services/api/finance";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Buildings, CaretRight, Clock, Wallet, Warning } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ring } from "@/components/finance/charts/ring";
import { Sparkline } from "@/components/finance/charts/sparkline";
import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { OverdueBadge } from "@/components/finance/finance-ui";
import { deltaView, deriveAttention, formatMoney, periodLabel } from "@/lib/finance-dashboard";
import { formatNumber } from "@/lib/format-number";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";
import { DashCard, DashRow, SectionTitle } from "./dash-ui";

/** Ring hero (mockup `hero()`): collection ring plus the story sentence. */
export function DashHero({ data }: { data: FinanceDashboard }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c, i18n.language), [c, i18n.language]);
  const empty = data.cohort.rate === null;
  return (
    <DashCard style={styles.hero} testID="dash-hero">
      <Ring rate={data.cohort.rate} caption={t("finance.dash.ring_caption")} />
      <View style={styles.heroText}>
        <Text style={styles.eyebrow}>
          {t("finance.dash.hero_eyebrow", { period: periodLabel(data.period.period, i18n.language), status: t(`finance.dash.status_${data.period.status}`) })}
        </Text>
        {empty
          ? <Text style={styles.heroTitle}>{t("finance.dash.hero_empty")}</Text>
          : (
              <>
                <Text style={styles.heroTitle}>{t("finance.dash.hero_story", { allocated: formatMoney(data.cohort.allocated), charges: formatMoney(data.cohort.charges) })}</Text>
                <Text style={styles.heroDetail}>
                  {t("finance.dash.hero_detail", { open: formatMoney(data.cohort.open), owing: formatNumber(data.owingFlats, i18n.language), total: formatNumber(data.totalFlats, i18n.language) })}
                </Text>
              </>
            )}
      </View>
    </DashCard>
  );
}

type Kpi = { key: "collected" | "outstanding" | "owing" | "fund"; value: string; delta: string | null; goodWhenUp: boolean; spark: Array<string | number>; color: string };

function buildKpis(data: FinanceDashboard, language: string): Kpi[] {
  return [
    { key: "collected", value: formatMoney(data.collected.at(-1)?.amount), delta: data.deltas.collected, goodWhenUp: true, spark: data.collected.map(m => m.amount), color: "c1" },
    { key: "outstanding", value: formatMoney(data.outstanding), delta: data.deltas.outstanding, goodWhenUp: false, spark: data.series.map(s => s.outstanding), color: "c4" },
    { key: "owing", value: `${formatNumber(data.owingFlats, language)} / ${formatNumber(data.totalFlats, language)}`, delta: data.deltas.owingFlats, goodWhenUp: false, spark: data.series.map(s => s.owingFlats), color: "err" },
    { key: "fund", value: formatMoney(data.fundBalance), delta: data.deltas.fundBalance, goodWhenUp: true, spark: data.series.map(s => s.fundBalance), color: "c3" },
  ];
}

/** Horizontal snap carousel of the four KPI cards with dots (mockup `.car` + `.dots`). */
export function KpiCarousel({ data }: { data: FinanceDashboard }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c, i18n.language), [c, i18n.language]);
  const { width } = useWindowDimensions();
  const [active, setActive] = React.useState(0);
  const kpis = buildKpis(data, i18n.language);
  const cardWidth = Math.round(Math.min(width * 0.72, 300));
  const step = cardWidth + SPACING.md;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(kpis.length - 1, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / step)));
    setActive(prev => (prev === index ? prev : index));
  };
  const palette = c as Record<string, string>;
  return (
    <View style={styles.carouselWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={styles.carousel}
        testID="kpi-carousel"
      >
        {kpis.map((kpi) => {
          const delta = deltaView(kpi.delta, i18n.language);
          const good = delta.direction === "none" || delta.direction === "flat" ? null : (delta.direction === "up") === kpi.goodWhenUp;
          const chipColor = good === null ? c.mut : good ? c.c2 : c.a4;
          const label = t(`finance.dash.kpi_${kpi.key}`);
          return (
            <View
              key={kpi.key}
              style={[styles.kpi, { width: cardWidth }]}
              accessible
              accessibilityLabel={[
                t("finance.dash.kpi_a11y", { label, value: kpi.value, delta: delta.text }),
                kpi.key === "fund" ? t("finance.dash.kpi_fund_deposits", { billed: formatMoney(data.deposits.billed), collected: formatMoney(data.deposits.collected) }) : "",
              ].filter(Boolean).join(" ")}
            >
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{kpi.value}</Text>
              <View style={styles.kpiFoot}>
                <Text style={[styles.chip, { color: chipColor, borderColor: chipColor }]}>
                  {delta.direction === "up" ? "▲ " : delta.direction === "down" ? "▼ " : ""}
                  {delta.text}
                </Text>
                <Sparkline values={kpi.spark} color={palette[kpi.color] ? kpi.color : "c1"} width={92} height={34} />
              </View>
              <Text style={styles.kpiHint}>{t("finance.dash.vs_last")}</Text>
              {kpi.key === "fund" && (
                <Text style={styles.kpiHint} testID="kpi-fund-deposits">
                  {t("finance.dash.kpi_fund_deposits", { billed: formatMoney(data.deposits.billed), collected: formatMoney(data.deposits.collected) })}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {kpis.map((kpi, i) => <View key={kpi.key} style={[styles.dot, i === active && styles.dotOn]} />)}
      </View>
    </View>
  );
}

const TONE_ICON = {
  warn: Warning,
  err: Wallet,
  gold: Buildings,
  info: Clock,
} as const;

/** "What needs attention" card (mockup `attList`, spec 4.1). */
export function AttentionCard({ data }: { data: FinanceDashboard }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const items = deriveAttention(data, i18n.language);
  const accent = { warn: c.c4, err: c.a4, gold: c.c1, info: c.c3 } as const;
  return (
    <DashCard testID="dash-attention">
      <SectionTitle title={t("finance.dash.attn_title")} />
      {items.map((item: AttentionItem) => {
        const Icon = TONE_ICON[item.tone];
        const params = item.kind === "period" ? { ...item.params, status: t(`finance.dash.status_${item.params.status}`) } : item.params;
        return (
          <DashRow
            key={item.kind}
            icon={<Icon size={20} color={accent[item.tone]} />}
            accent={accent[item.tone]}
            title={t(`finance.dash.attn_${item.kind}`, params)}
            detail={t(`finance.dash.attn_${item.kind}_detail`, params)}
            onPress={() => router.push(item.href as Href)}
          />
        );
      })}
    </DashCard>
  );
}

/** One top-owing row (mockup `.mrow`): flat, owner, balance and an overdue chip; opens the flat ledger. */
export function TopOwingRow({ row }: { row: FinanceDashboard["topOwing"][number] }) {
  const { t } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const owner = row.ownerDeleted ? t("finance.dash.former_owner") : (row.ownerName ?? t("finance.no_owner"));
  return (
    <Pressable
      style={({ pressed }) => [styles.topRow, pressed && { opacity: 0.8 }]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/finance/flats/${encodeURIComponent(row.flatId)}` as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={t("finance.dash.top_a11y", { label: row.label, owner, amount: formatMoney(row.balance), days: row.daysPastDue })}
    >
      <View style={styles.topMain}>
        <Text style={styles.topLabel}>{row.label}</Text>
        <Text style={styles.topOwner} numberOfLines={1}>{owner}</Text>
      </View>
      <View style={styles.topEnd}>
        <Text style={styles.topAmount}>{formatMoney(row.balance)}</Text>
        {row.daysPastDue > 0 ? <OverdueBadge days={row.daysPastDue} /> : null}
      </View>
      <CaretRight mirrored={I18nManager.isRTL} size={18} color={c.mut} />
    </Pressable>
  );
}

/** Display serif (Cormorant) for hero and KPI figures in English only; Arabic keeps the UI font (DESIGN rule). */
function buildStyles(c: ReturnType<typeof useChartColors>, language = "en") {
  const display = language === "ar" ? FONT.sans : FONT.display;
  return StyleSheet.create({
    hero: { flexDirection: "row", alignItems: "center", gap: SPACING.base },
    heroText: { flex: 1, gap: 4 },
    eyebrow: { fontFamily: FONT.sans, fontSize: 11, lineHeight: 16, letterSpacing: 0.5, color: c.gold, textAlign: "left" },
    heroTitle: { fontFamily: display, fontWeight: "300", fontSize: 18, lineHeight: 28, color: c.tx, textAlign: "left" },
    heroDetail: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 19, color: c.mut, textAlign: "left" },
    carouselWrap: { marginTop: SPACING.md },
    carousel: { paddingHorizontal: SPACING.base, gap: SPACING.md },
    kpi: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.lg, padding: SPACING.base, gap: 4 },
    kpiLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: c.mut, textAlign: "left" },
    kpiValue: { fontFamily: display, fontWeight: "300", fontSize: 26, lineHeight: 38, color: c.tx, textAlign: "left" },
    kpiFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 34 },
    chip: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2, overflow: "hidden" },
    kpiHint: { fontFamily: FONT.sans, fontSize: 11, lineHeight: 16, color: c.mut, textAlign: "left" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: SPACING.sm },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.line },
    dotOn: { width: 18, backgroundColor: c.gold },
    topRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 64, padding: SPACING.md, marginHorizontal: SPACING.base, marginTop: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
    topMain: { flex: 1, gap: 2 },
    topLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: c.tx, textAlign: "left" },
    topOwner: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: c.mut, textAlign: "left" },
    topEnd: { alignItems: "flex-end", gap: 4 },
    topAmount: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: c.tx },
  });
}
