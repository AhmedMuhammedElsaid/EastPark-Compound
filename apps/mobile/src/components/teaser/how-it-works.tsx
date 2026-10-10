import type { TimelineItem } from "./teaser-timeline";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { RADIUS, SPACING } from "@/theme/tokens";

import { TeaserTimeline } from "./teaser-timeline";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

const STEPS = [1, 2, 3, 4] as const;

/**
 * The join flow (web `HowItWorks`): register the unit → the compound office approves it → an
 * invitation email arrives → the resident signs in. Same timeline as the rollout phases.
 */
export function HowItWorks() {
  const { t } = useTranslation();
  const palette = useTeaserPalette();
  const steps: TimelineItem[] = STEPS.map(step => ({
    key: `step-${step}`,
    status: "step",
    label: t(`landing.how_step_${step}_title`),
    caption: t(`landing.how_step_${step}_body`),
  }));

  return (
    <View style={[styles.section, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[TEASER_TYPE.overline, { color: palette.gold }]}>{t("landing.how_eyebrow")}</Text>
      <Text accessibilityRole="header" style={[TEASER_TYPE.h1, styles.title, { color: palette.text }]}>
        {t("landing.how_title")}
      </Text>
      <Text style={[TEASER_TYPE.body, styles.sub, { color: palette.textMuted }]}>{t("landing.how_sub")}</Text>
      <TeaserTimeline items={steps} label={t("landing.how_steps_label")} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING["2xl"] },
  title: { marginTop: SPACING.sm },
  sub: { marginTop: SPACING.sm },
});
