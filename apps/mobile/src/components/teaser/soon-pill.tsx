import { Check, Lock } from "phosphor-react-native";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { RADIUS, SPACING } from "@/theme/tokens";

import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

/** Small gold-outlined "Sealed" marker used on every teaser card. */
export function SoonPill({ label }: { label: string }) {
  const palette = useTeaserPalette();
  return (
    <View style={[styles.pill, { borderColor: `${palette.gold}99`, backgroundColor: palette.card }]}>
      <Lock size={14} color={palette.gold} />
      <Text style={[TEASER_TYPE.caption, { color: palette.gold }]}>{label}</Text>
    </View>
  );
}

/** The hint line under a sealed card. Always visible: touch screens have no hover to reveal it. */
export function SealedHint({ hint }: { hint: string }) {
  const palette = useTeaserPalette();
  return (
    <Text style={[styles.hint, TEASER_TYPE.label, { borderTopColor: palette.border, color: palette.textMuted }]}>
      {hint}
    </Text>
  );
}

/** Checklist of what a feature does (the landing page's longer copy). */
export function TeaserPoints({ points }: { points: string[] }) {
  const palette = useTeaserPalette();
  return (
    <View style={styles.points}>
      {points.map(point => (
        <View key={point} style={styles.point}>
          <Check size={16} color={palette.gold} style={styles.pointIcon} />
          <Text style={[TEASER_TYPE.body, styles.pointText, { color: palette.text }]}>{point}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  hint: { marginTop: SPACING.base, paddingTop: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth },
  points: { gap: SPACING.sm },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pointIcon: { marginTop: 3 },
  pointText: { flex: 1 },
});
