import { Check } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { BRAND, RADIUS, SPACING } from "@/theme/tokens";

import { SealedHint, SoonPill } from "./soon-pill";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

const STEPS = ["PLACED", "CONFIRMED", "PREPARING", "ON_THE_WAY", "DELIVERED"] as const;
const STATIC_STEP = 2; // step 3 lit under reduced motion
const STEP_MS = 2000;
const DOT = 24;

/**
 * Sealed order-tracking card (web `OrderTrackingPreview`, landing variant). A demo order walks the
 * status chain every 2 s; it stays on step 3 under reduced motion. Phone layout: dots only, with the
 * current step's name under them.
 */
export function OrderTrackingPreview() {
  const { t } = useTranslation();
  const palette = useTeaserPalette();
  const reduced = useReducedMotion();
  const [step, setStep] = React.useState(STATIC_STEP);
  const active = reduced ? STATIC_STEP : step;

  React.useEffect(() => {
    if (reduced)
      return;
    const id = setInterval(() => setStep(current => (current + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={[TEASER_TYPE.h2, styles.title, { color: palette.text }]}>
          {t("home.teaser.track_title")}
        </Text>
        <SoonPill label={t("home.teaser.sealed")} />
      </View>
      <View style={styles.steps} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {STEPS.map((status, index) => {
          const reached = index <= active;
          const current = index === active;
          const dotColors = current
            ? { backgroundColor: BRAND.gold, borderColor: BRAND.gold }
            : { backgroundColor: palette.card, borderColor: reached ? palette.node : palette.border };
          return (
            <View key={status} style={styles.step}>
              {index > 0 && <View style={[styles.line, { backgroundColor: reached ? palette.node : palette.border }]} />}
              <View style={[styles.dot, dotColors]}>
                {reached && <Check size={14} weight="bold" color={current ? BRAND.ink : palette.gold} />}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[TEASER_TYPE.label, styles.current, { color: palette.text }]} importantForAccessibility="no" accessibilityElementsHidden>
        {t(`orders.${STEPS[active]}`)}
      </Text>
      <Text style={[TEASER_TYPE.body, styles.caption, { color: palette.textMuted }]}>{t("home.teaser.track_caption")}</Text>
      <SealedHint hint={t("home.teaser.hint_track")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md },
  title: { flex: 1 },
  steps: { marginTop: SPACING.xl, flexDirection: "row", alignItems: "flex-start" },
  step: { flex: 1, minWidth: 0, alignItems: "center" },
  // Joins this dot to the previous one: from its centre back to the previous step's centre.
  line: { position: "absolute", top: DOT / 2 - 1, height: 2, width: "100%", end: "50%" },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  current: { marginTop: SPACING.md, textAlign: "center", fontWeight: "700" },
  caption: { marginTop: SPACING.lg },
});
