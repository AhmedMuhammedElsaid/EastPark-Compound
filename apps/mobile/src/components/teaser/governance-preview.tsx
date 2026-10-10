import { Bank, Lock } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { RADIUS, SPACING } from "@/theme/tokens";

import { SealedHint, SoonPill, TeaserPoints } from "./soon-pill";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

// Static illustrative bars; widths are decorative and never represent real votes.
const BARS = ["80%", "60%", "40%"] as const;

/**
 * Sealed governance card (web `GovernancePreview`, landing variant: not a link). The web blurs the
 * vote bars; RN has no cheap blur, so they are drawn faint instead.
 */
export function GovernancePreview({ body, points }: { body: string; points: string[] }) {
  const { t } = useTranslation();
  const palette = useTeaserPalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: palette.muted }]}>
          <Bank size={20} color={palette.gold} />
        </View>
        <SoonPill label={t("home.teaser.sealed")} />
      </View>
      <Text accessibilityRole="header" style={[TEASER_TYPE.h2, styles.title, { color: palette.text }]}>
        {t("home.teaser.gov_title")}
      </Text>
      <Text style={[TEASER_TYPE.body, styles.body, { color: palette.textMuted }]}>{body}</Text>
      <View style={styles.points}><TeaserPoints points={points} /></View>
      <View style={styles.bars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {BARS.map((width, index) => (
          <View key={width} style={styles.barRow}>
            <Text numberOfLines={1} style={[TEASER_TYPE.caption, styles.barLabel, { color: palette.textMuted }]}>
              {`${t("home.teaser.gov_option")} ${index + 1}`}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: palette.muted }]}>
              <View style={[styles.barFill, { width, backgroundColor: `${palette.textMuted}40` }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.sealed}>
        <Lock size={16} color={palette.gold} />
        <Text style={[TEASER_TYPE.label, styles.sealedText, { color: palette.gold }]}>{t("home.teaser.gov_sealed")}</Text>
      </View>
      <SealedHint hint={t("home.teaser.hint_gov")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { marginTop: SPACING.base },
  body: { marginTop: SPACING.sm },
  points: { marginTop: SPACING.base },
  bars: { marginTop: SPACING.lg, gap: SPACING.md },
  barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  barLabel: { width: 64, fontWeight: "400" },
  barTrack: { flex: 1, height: 12, borderRadius: RADIUS.full, overflow: "hidden" },
  barFill: { height: 12, borderRadius: RADIUS.full },
  sealed: { marginTop: SPACING.base, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  sealedText: { fontWeight: "700" },
});
