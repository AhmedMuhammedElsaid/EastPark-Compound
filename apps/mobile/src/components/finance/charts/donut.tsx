import type { DashMethod } from "./types";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import { isZeroMoney, percentTenths, piastersToDecimal, sumMoney, sumPiasters } from "@/lib/decimal-money";
import { formatMoney } from "@/lib/format-money";
import { FONT, SPACING } from "@/theme/tokens";

import { compactMoney, donutSegments, percentLabel } from "./geometry";
import { useChartColors } from "./use-chart-colors";

type Props = {
  /** `receiptsByMethod`: only `gross` is drawn; reversals show on the line below. */
  methods: readonly DashMethod[];
  size?: number;
};

const COLOR_KEY = { CASH: "c1", BANK_TRANSFER: "c3", INSTAPAY: "c2", CHEQUE: "c4" } as const;
const STROKE = 16;

/** Payment-method donut (mockup `donut`) with legend rows and the "Reversed" line (spec section 6 item 11). */
export function Donut({ methods, size = 168 }: Props) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const r = size / 2 - 14;
  const circumference = 2 * Math.PI * r;
  const { segments } = donutSegments(methods, circumference);
  // Exact sums: only positive gross is drawn; reversed and net are summed as whole piasters.
  const grossTotal = piastersToDecimal(sumPiasters(methods.map(m => (m.gross.startsWith("-") ? "0" : m.gross))));
  const hasReceipts = !isZeroMoney(grossTotal);
  const reversed = sumMoney(methods.map(m => m.reversed));
  const net = sumMoney(methods.map(m => m.net));
  const label = (m: DashMethod["method"]) => t(`finance.method_${m}`);
  const share = (gross: string) => percentLabel(percentTenths(gross.startsWith("-") ? "0" : gross, grossTotal), i18n.language);
  const summary = hasReceipts
    ? methods.map(m => `${label(m.method)}: ${formatMoney(m.gross)} (${share(m.gross)})`).join(", ")
    : t("finance.dash.no_receipts");
  const total = hasReceipts ? 1 : 0;

  return (
    <View>
      <View style={styles.center}>
        <View accessible accessibilityRole="image" accessibilityLabel={`${t("finance.dash.methods_title")}. ${summary}`} style={{ width: size, height: size }} testID="donut">
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.elev} strokeWidth={STROKE} />
            {segments.filter(s => s.length > 0).map(s => (
              <Circle
                key={s.method}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={c[COLOR_KEY[s.method]]}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(0, s.length - 2)} ${circumference}`}
                strokeDashoffset={-s.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ))}
            {total > 0
              ? (
                  <>
                    <SvgText x={size / 2} y={size * 0.5} textAnchor="middle" fontFamily={FONT.sans} fontWeight="300" fontSize={20} fill={c.tx}>{compactMoney(grossTotal, i18n.language)}</SvgText>
                    <SvgText x={size / 2} y={size * 0.5 + 18} textAnchor="middle" fontFamily={FONT.sans} fontSize={11} fill={c.mut}>{t("finance.dash.egp")}</SvgText>
                  </>
                )
              : <SvgText x={size / 2} y={size * 0.52} textAnchor="middle" fontFamily={FONT.sans} fontSize={13} fill={c.mut}>{t("finance.dash.no_receipts")}</SvgText>}
          </Svg>
        </View>
      </View>
      <View>
        {methods.map((m) => {
          const seg = segments.find(s => s.method === m.method);
          return (
            <View key={m.method} style={styles.row} accessible accessibilityLabel={`${label(m.method)}: ${formatMoney(m.gross)}`}>
              <View style={styles.rowName}>
                <View style={[styles.swatch, { backgroundColor: c[COLOR_KEY[m.method]] }]} />
                <Text style={styles.rowText}>{label(m.method)}</Text>
              </View>
              <Text style={styles.rowText}>
                {formatMoney(m.gross)}
                {" "}
                <Text style={styles.muted}>{seg && total > 0 ? share(m.gross) : ""}</Text>
              </Text>
            </View>
          );
        })}
      </View>
      {!isZeroMoney(reversed)
        ? (
            <Text style={styles.reversed} testID="donut-reversed">
              {t("finance.dash.reversed_line", { reversed: formatMoney(reversed), net: formatMoney(net) })}
            </Text>
          )
        : null}
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    center: { alignItems: "center", marginBottom: SPACING.sm },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    rowName: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    rowText: { fontFamily: FONT.sans, fontSize: 13, color: c.tx },
    muted: { color: c.mut, fontSize: 12 },
    reversed: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: c.mut, marginTop: SPACING.sm, textAlign: "left" },
  });
}
